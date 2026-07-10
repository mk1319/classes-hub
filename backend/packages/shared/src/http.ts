// backend/packages/shared/src/http.ts
//
// Cross-feature HTTP helpers shared by every feature Lambda.
//
// The custom API Gateway authorizer (backend/authorizer) puts the verified
// caller identity into the request context. serverless-http surfaces the raw
// API Gateway event on `req.apiGateway.event`, so every feature reads *who is
// calling* from there — never from the request body/query (see
// backend/CLAUDE.md: never trust a tenantId from the request).

export interface AuthContext {
  userId: number;
  /** null only for the super-admin, who is not scoped to a tenant. */
  tenantId: number | null;
  role: string;
  sessionId: number;
}

/**
 * Extract the authenticated caller from an Express request that was produced by
 * serverless-http wrapping an API-Gateway-authorized Lambda. Returns null when
 * no authorizer context is present (which should never happen behind the
 * authorizer, but is treated as unauthorized rather than trusted).
 */
export function getAuthFromRequest(req: unknown): AuthContext | null {
  const r = req as {
    apiGateway?: { event?: { requestContext?: { authorizer?: Record<string, unknown> } } };
    requestContext?: { authorizer?: Record<string, unknown> };
  };
  const a =
    r?.apiGateway?.event?.requestContext?.authorizer ??
    r?.requestContext?.authorizer;
  if (!a || a.userId == null) return null;
  const tenantRaw = a.tenantId;
  return {
    userId: Number(a.userId),
    tenantId:
      tenantRaw === '' || tenantRaw == null ? null : Number(tenantRaw),
    role: String(a.role),
    sessionId: Number(a.sessionId),
  };
}

/** An error carrying an HTTP status + stable machine code, mapped to a JSON body by sendError. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = 'HttpError';
  }
}

export const badRequest = (code = 'BAD_REQUEST', message?: string) =>
  new HttpError(400, code, message);
export const unauthorized = (code = 'UNAUTHORIZED', message?: string) =>
  new HttpError(401, code, message);
export const forbidden = (code = 'FORBIDDEN', message?: string) =>
  new HttpError(403, code, message);
export const notFound = (code = 'NOT_FOUND', message?: string) =>
  new HttpError(404, code, message);

/** Roles allowed to manage tenant-wide data (create users, courses, etc.). */
export const ADMIN_ROLES = ['tutor', 'admin'] as const;
export const SUPER_ADMIN = 'super_admin';

export function isAdmin(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/** Throws 403 unless the caller's role is in the allowed list. */
export function requireRole(ctx: AuthContext, ...roles: string[]): void {
  if (!roles.includes(ctx.role)) {
    throw forbidden('FORBIDDEN', `Requires one of: ${roles.join(', ')}`);
  }
}

/** Throws unless the caller belongs to a tenant (i.e. is not the super-admin). */
export function requireTenant(ctx: AuthContext): number {
  if (ctx.tenantId == null) {
    throw forbidden('TENANT_REQUIRED', 'This endpoint is not available to the super-admin');
  }
  return ctx.tenantId;
}
