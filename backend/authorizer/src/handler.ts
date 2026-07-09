import type { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import { getPool, verifySessionToken } from '@classes-hub/shared';

export async function handler(
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
  const token = event.authorizationToken?.replace(/^Bearer\s+/i, '') ?? '';

  let claims;
  try {
    claims = verifySessionToken(token);
  } catch {
    throw new Error('Unauthorized');
  }

  const pool = getPool();
  const sessionResult = await pool.query('SELECT is_active FROM sessions WHERE id = $1', [claims.sessionId]);

  if (sessionResult.rowCount === 0 || !sessionResult.rows[0].is_active) {
    throw new Error('Unauthorized');
  }

  return {
    principalId: String(claims.userId),
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn,
        },
      ],
    },
    context: {
      userId: String(claims.userId),
      tenantId: claims.tenantId === null ? '' : String(claims.tenantId),
      role: claims.role,
      sessionId: String(claims.sessionId),
    },
  };
}
