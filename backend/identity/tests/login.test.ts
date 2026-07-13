import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import { getPool, verifySessionToken } from '@classes-hub/shared';
import { login, logout } from '../src/login';

// Poll pg_stat_activity until some backend is blocked waiting on a lock while
// running an UPDATE on sessions for this user. Used by the concurrency
// regression test to guarantee login-B's UPDATE has taken its snapshot and is
// parked on the row lock BEFORE the rival transaction inserts + commits.
async function waitForBlockedUpdate(pool: Pool, userId: number, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await pool.query(
      `SELECT count(*)::int AS n
         FROM pg_stat_activity
        WHERE wait_event_type = 'Lock'
          AND state = 'active'
          AND query ILIKE 'UPDATE sessions SET is_active = false WHERE user_id = $1%'`
    );
    if (res.rows[0].n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('timed out waiting for login UPDATE to block on the row lock');
}

describe('login', () => {
  let userId: number;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const userResult = await pool.query(
      `INSERT INTO users (role, email, password_hash, name)
       VALUES ('teacher', 'teacher@example.com', $1, 'Test Teacher') RETURNING id`,
      [passwordHash]
    );
    userId = userResult.rows[0].id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('returns a valid JWT for correct credentials', async () => {
    const result = await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });
    const claims = verifySessionToken(result.token);
    expect(claims.userId).toBe(userId);
    expect(claims.role).toBe('teacher');
  });

  it('rejects an incorrect password', async () => {
    await expect(
      login({ email: 'teacher@example.com', password: 'wrong-password', deviceId: 'device-1' })
    ).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('rejects an unknown email', async () => {
    await expect(
      login({ email: 'nobody@example.com', password: 'whatever', deviceId: 'device-1' })
    ).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('deactivates the previous session when logging in again', async () => {
    const first = await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });
    const firstClaims = verifySessionToken(first.token);

    await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-2' });

    const sessionResult = await getPool().query('SELECT is_active FROM sessions WHERE id = $1', [firstClaims.sessionId]);
    expect(sessionResult.rows[0].is_active).toBe(false);
  });

  it('leaves exactly one active session after concurrent logins for the same user', async () => {
    await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-0' });

    // Both concurrent logins must resolve without throwing (no raw 23505 leaking
    // through) — not merely leave a consistent final count.
    const results = await Promise.all([
      login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' }),
      login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-2' }),
    ]);
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(typeof r.token).toBe('string');
    }

    const activeResult = await getPool().query(
      'SELECT count(*)::int AS count FROM sessions WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    expect(activeResult.rows[0].count).toBe(1);
  });

  // Regression test for the READ COMMITTED concurrent-login race (Task 3 review).
  //
  // We force the EXACT interleaving the reviewer reproduced. A "rival" raw
  // transaction (A) commits a new active session while login-B's own UPDATE is
  // blocked mid-transaction, so B's UPDATE snapshot (taken at statement start,
  // before A committed) never sees A's inserted row. B therefore deactivates
  // only the pre-existing session, and B's subsequent INSERT collides with A's
  // active row on the sessions_one_active_per_user partial unique index
  // (Postgres 23505). Against the OLD code that raw error propagates out of
  // login(); against the fixed code login() retries and resolves cleanly.
  //
  // Forcing recipe (verified 10/10 deterministic at the raw-SQL level):
  //   1. A: BEGIN, UPDATE sessions ... (takes the row lock on the seeded row R;
  //      does NOT insert yet).
  //   2. B = login(): its BEGIN + UPDATE fire and BLOCK on R's lock. B's UPDATE
  //      snapshot is fixed here — before A inserts anything.
  //   3. A: INSERT a new active session, then COMMIT (releases R's lock).
  //   4. B's UPDATE unblocks, sees only R (never A's insert), deactivates R,
  //      then B's INSERT hits 23505. Old code throws it; fixed code retries.
  //
  // The ordering "B's UPDATE blocks BEFORE A inserts" is what makes this
  // deterministic — a blocked UPDATE snapshotting before the rival INSERT
  // provably cannot see that INSERT.
  it('login() resolves (retries past a forced 23505) when a rival transaction wins the active-session race', async () => {
    const pool = getPool();

    // Seed the pre-existing active session (row R) that the UPDATE will contend over.
    await pool.query(`INSERT INTO sessions (user_id, device_id) VALUES ($1, 'device-R')`, [userId]);

    // Rival transaction A: lock R via UPDATE, but do not insert yet.
    const rival = await pool.connect();
    await rival.query('BEGIN');
    await rival.query('UPDATE sessions SET is_active = false WHERE user_id = $1', [userId]);

    // Start login-B. Its transaction's UPDATE will block on R's lock held by A,
    // fixing B's snapshot before A inserts its own active row.
    const loginB = login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-B' });

    // Wait until B's UPDATE is actually blocked on the lock (poll pg_stat_activity)
    // so the ordering is guaranteed rather than timing-hoped.
    await waitForBlockedUpdate(pool, userId);

    // Now A inserts a NEW active session and commits — this is the row B's stale
    // snapshot will miss, and the row B's later INSERT will collide with.
    await rival.query(`INSERT INTO sessions (user_id, device_id) VALUES ($1, 'device-A')`, [userId]);
    await rival.query('COMMIT');
    rival.release();

    // The crux: B's login() must RESOLVE, not reject with a raw 23505. Old code
    // rejects here; the fixed code retries its deactivate+insert and succeeds.
    const result = await loginB;
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);

    const activeResult = await pool.query(
      'SELECT count(*)::int AS count FROM sessions WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    expect(activeResult.rows[0].count).toBe(1);
  });

  it('logout deactivates the current session', async () => {
    const result = await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });
    const claims = verifySessionToken(result.token);

    await logout(claims.sessionId);

    const sessionResult = await getPool().query('SELECT is_active FROM sessions WHERE id = $1', [claims.sessionId]);
    expect(sessionResult.rows[0].is_active).toBe(false);
  });
});
