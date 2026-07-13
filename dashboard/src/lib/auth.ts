// dashboard/src/lib/auth.ts
//
// Client-side token storage + JWT decode for UI purposes only — the backend
// re-verifies every call via the authorizer.

const TOKEN_KEY = 'classeshub_token';

export interface SessionClaims {
  userId: number;
  role: string;
  sessionId: number;
  name: string;
  exp: number;
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

function decodeToken(token: string): SessionClaims | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload)) as SessionClaims;
  } catch {
    return null;
  }
}

export function getSession(): SessionClaims | null {
  const token = getToken();
  if (!token) return null;
  const claims = decodeToken(token);
  if (!claims) return null;
  if (claims.exp * 1000 < Date.now()) {
    clearToken();
    return null;
  }
  return claims;
}
