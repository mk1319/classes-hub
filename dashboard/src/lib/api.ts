// dashboard/src/lib/api.ts
//
// The single API client. NOTHING in the app calls fetch directly — routes and
// components go through features/<name>/api.ts, which use this (see
// dashboard/CLAUDE.md). Attaches the JWT, unwraps JSON, and signs the user out
// on a 401 (the single-active-session enforcement returns 401 when a session is
// deactivated elsewhere — plan/15-account-security-anti-fraud.md).

import { clearToken, getToken } from './auth';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip the Authorization header (login only). */
  anonymous?: boolean;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!opts.anonymous) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !opts.anonymous) {
    clearToken();
    // Hard redirect to login; the session is no longer valid.
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
  }

  if (!res.ok) {
    let code: string | undefined;
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error ?? message;
      code = data.code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Absolute URL for a resource file stream (opened directly, not via fetch). */
export function fileUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
