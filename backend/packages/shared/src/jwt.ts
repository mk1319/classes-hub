import jwt from 'jsonwebtoken';

export interface SessionClaims {
  userId: number;
  tenantId: number | null;
  role: string;
  sessionId: number;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export function signSessionToken(claims: SessionClaims): string {
  return jwt.sign(claims, getSecret(), { expiresIn: '12h', algorithm: 'HS256' });
}

export function verifySessionToken(token: string): SessionClaims {
  return jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as SessionClaims;
}
