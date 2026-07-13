// backend/dev-server.ts
//
// Local all-in-one dev server: mounts identity's public/authed apps behind a
// JWT-decoding middleware that reproduces what the API Gateway custom
// authorizer does in production (verify token + check the session is active,
// then inject the authorizer context). NOT for production — SAM/API Gateway is
// the real entry point. This exists so the dashboard can run against a live
// backend locally without Docker/SAM.
// Run: npm run dev (esbuild-bundles this to dev-server.cjs, then runs it).

import express from 'express';
import { getPool, verifySessionToken } from '@classes-hub/shared';
import { publicApp, authedApp } from './identity/src/handler';

const root = express();
root.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Public routes (no authorizer) — currently just POST /auth/login.
root.use(publicApp);

// Authorizer shim: verify JWT + active session, then inject the same context
// shape the real authorizer produces.
async function authorize(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  try {
    const claims = verifySessionToken(token);
    const s = await getPool().query('SELECT is_active FROM sessions WHERE id = $1', [claims.sessionId]);
    if (s.rowCount === 0 || !s.rows[0].is_active) throw new Error('inactive');
    (req as unknown as { requestContext: unknown }).requestContext = {
      authorizer: {
        userId: String(claims.userId),
        role: claims.role,
        sessionId: String(claims.sessionId),
      },
    };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Everything else (currently just POST /auth/logout) — behind the authorizer shim.
root.use(authorize);
root.use(authedApp);

const port = Number(process.env.PORT ?? 3000);
root.listen(port, () => console.log(`dev backend on http://localhost:${port}`));
