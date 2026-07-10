// backend/tenants/src/tenants.ts
//
// Super-admin-only tenant management. The super-admin is the platform owner
// (Mukesh) — the only role whose JWT carries a null tenantId. Every function
// here re-checks that role, so tenant CRUD can never be reached by a tenant's
// own admin. See plan/01-architecture.md and plan/15-account-security-anti-fraud.md.

import { getPool, notFound, requireRole, SUPER_ADMIN, type AuthContext } from '@classes-hub/shared';
import type { CreateTenantInput, UpdateTenantInput } from './schema';

export interface Tenant {
  id: number;
  name: string;
  branding: Record<string, unknown>;
  created_at: string;
}

export async function createTenant(ctx: AuthContext, input: CreateTenantInput): Promise<Tenant> {
  requireRole(ctx, SUPER_ADMIN);
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO tenants (name, branding) VALUES ($1, $2)
     RETURNING id, name, branding, created_at`,
    [input.name, JSON.stringify(input.branding ?? {})]
  );
  return result.rows[0];
}

export async function listTenants(ctx: AuthContext): Promise<Tenant[]> {
  requireRole(ctx, SUPER_ADMIN);
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, branding, created_at FROM tenants ORDER BY name ASC`
  );
  return result.rows;
}

export async function getTenant(ctx: AuthContext, id: number): Promise<Tenant> {
  requireRole(ctx, SUPER_ADMIN);
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, branding, created_at FROM tenants WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) throw notFound('TENANT_NOT_FOUND');
  return result.rows[0];
}

export async function updateTenant(
  ctx: AuthContext,
  id: number,
  input: UpdateTenantInput
): Promise<Tenant> {
  requireRole(ctx, SUPER_ADMIN);
  const pool = getPool();
  // Merge branding into the existing jsonb rather than replacing it, so a
  // partial branding update doesn't wipe unspecified keys.
  const result = await pool.query(
    `UPDATE tenants
        SET name = COALESCE($2, name),
            branding = CASE WHEN $3::jsonb IS NULL THEN branding ELSE branding || $3::jsonb END
      WHERE id = $1
      RETURNING id, name, branding, created_at`,
    [id, input.name ?? null, input.branding ? JSON.stringify(input.branding) : null]
  );
  if (result.rowCount === 0) throw notFound('TENANT_NOT_FOUND');
  return result.rows[0];
}
