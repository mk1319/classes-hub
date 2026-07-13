import jwt from 'jsonwebtoken';

export interface SessionClaims {
  userId: number;
  role: string;
  sessionId: number;
  name: string;
}

const ALGORITHM = 'HS256';
const EXPIRES_IN = '12h';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export function signSessionToken(claims: SessionClaims): string {
  return jwt.sign(claims, getSecret(), { algorithm: ALGORITHM, expiresIn: EXPIRES_IN });
}

export function verifySessionToken(token: string): SessionClaims {
  const decoded = jwt.verify(token, getSecret(), { algorithms: [ALGORITHM] });
  return decoded as unknown as SessionClaims;
}
