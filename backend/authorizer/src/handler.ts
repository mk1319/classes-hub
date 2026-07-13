import { getPool, verifySessionToken } from '@classes-hub/shared';

interface AuthorizerEvent {
  authorizationToken?: string;
  headers?: Record<string, string>;
  methodArn: string;
}

interface AuthorizerResult {
  principalId: string;
  policyDocument: {
    Version: string;
    Statement: Array<{ Action: string; Effect: string; Resource: string }>;
  };
  context: { userId: string; role: string; sessionId: string };
}

function generatePolicy(principalId: string, resource: string, context: AuthorizerResult['context']): AuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: resource }],
    },
    context,
  };
}

export async function handler(event: AuthorizerEvent): Promise<AuthorizerResult> {
  const raw = event.authorizationToken ?? event.headers?.Authorization ?? '';
  const token = raw.replace(/^Bearer\s+/i, '');
  try {
    const claims = verifySessionToken(token);
    const result = await getPool().query('SELECT is_active FROM sessions WHERE id = $1', [claims.sessionId]);
    if (result.rowCount === 0 || !result.rows[0].is_active) {
      throw new Error('inactive');
    }
    return generatePolicy(String(claims.userId), event.methodArn, {
      userId: String(claims.userId),
      role: claims.role,
      sessionId: String(claims.sessionId),
    });
  } catch {
    throw new Error('Unauthorized');
  }
}
