export interface AuthContext {
  userId: number;
  role: string;
  sessionId: number;
}

/**
 * Extract the authenticated caller. Checks `apiGateway.event.requestContext.authorizer`
 * (the real serverless-http/API-Gateway shape) first, falling back to a plain
 * `requestContext.authorizer` (used by the local dev-server shim and by tests
 * that inject auth context directly without going through serverless-http).
 */
export function getAuthFromRequest(req: unknown): AuthContext | null {
  const r = req as {
    apiGateway?: { event?: { requestContext?: { authorizer?: Record<string, unknown> } } };
    requestContext?: { authorizer?: Record<string, unknown> };
  };
  const a = r?.apiGateway?.event?.requestContext?.authorizer ?? r?.requestContext?.authorizer;
  if (!a || a.userId == null) return null;
  return {
    userId: Number(a.userId),
    role: String(a.role),
    sessionId: Number(a.sessionId),
  };
}

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

export const badRequest = (code = 'BAD_REQUEST', message?: string) => new HttpError(400, code, message);
export const unauthorized = (code = 'UNAUTHORIZED', message?: string) => new HttpError(401, code, message);
export const forbidden = (code = 'FORBIDDEN', message?: string) => new HttpError(403, code, message);
export const notFound = (code = 'NOT_FOUND', message?: string) => new HttpError(404, code, message);

/** Throws 403 unless the caller's role is in the allowed list. */
export function requireRole(ctx: AuthContext, ...roles: string[]): void {
  if (!roles.includes(ctx.role)) {
    throw forbidden('FORBIDDEN', `Requires one of: ${roles.join(', ')}`);
  }
}
