// dashboard/src/lib/auth.ts
//
// JWT storage + decoding. The token is the single source of truth for who's
// logged in and their role/tenant (mirrors the backend's SessionClaims). We
// decode it client-side only to drive UI (nav, guards) — the backend re-verifies
// on every request, so a tampered token buys nothing.

const TOKEN_KEY = 'classeshub.token';

export interface SessionClaims {
  userId: number;
  tenantId: number | null;
  role: string;
  sessionId: number;
  exp?: number;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function decodeClaims(token: string): SessionClaims | null {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return json as SessionClaims;
  } catch {
    return null;
  }
}

export function currentClaims(): SessionClaims | null {
  const token = getToken();
  if (!token) return null;
  const claims = decodeClaims(token);
  if (!claims) return null;
  if (claims.exp && claims.exp * 1000 < Date.now()) {
    clearToken();
    return null;
  }
  return claims;
}

export function isSuperAdmin(role: string | undefined): boolean {
  return role === 'super_admin';
}
export function isAdmin(role: string | undefined): boolean {
  return role === 'tutor' || role === 'admin';
}
export function isStaff(role: string | undefined): boolean {
  return isAdmin(role) || role === 'teacher';
}
