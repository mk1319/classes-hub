// backend/dev-server.ts
//
// Local all-in-one dev server: mounts every feature's Express app behind a
// JWT-decoding middleware that reproduces what the API Gateway custom authorizer
// does in production (verify token + check the session is active, then inject the
// authorizer context). NOT for production — SAM/API Gateway is the real entry
// point. This exists so the dashboard/app can run against a live backend locally
// without Docker/SAM. Run: esbuild-bundle then `node dev-server.cjs`.

import express from 'express';
import { getPool, verifySessionToken } from '@classes-hub/shared';
import { app as authApp } from './auth/src/handler';
import { buildApp as tenants } from './tenants/src/handler';
import { buildApp as users } from './users/src/handler';
import { buildApp as courses } from './courses/src/handler';
import { buildApp as tests } from './tests/src/handler';
import { buildApp as timetable } from './timetable/src/handler';
import { buildApp as notifications } from './notifications/src/handler';
import { buildApp as uploads } from './uploads/src/handler';
import { buildApp as resources } from './resources/src/handler';
import { buildApp as syllabus } from './syllabus/src/handler';

const root = express();
root.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Public auth route.
root.use(authApp);

// Authorizer shim: verify JWT + active session, then inject the same context
// shape the real authorizer produces (strings on requestContext.authorizer).
async function authorize(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  try {
    const claims = verifySessionToken(token);
    const s = await getPool().query('SELECT is_active FROM sessions WHERE id = $1', [claims.sessionId]);
    if (s.rowCount === 0 || !s.rows[0].is_active) throw new Error('inactive');
    (req as unknown as { apiGateway: unknown }).apiGateway = {
      event: {
        requestContext: {
          authorizer: {
            userId: String(claims.userId),
            tenantId: claims.tenantId == null ? '' : String(claims.tenantId),
            role: claims.role,
            sessionId: String(claims.sessionId),
          },
        },
      },
    };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Every feature app, behind the authorizer shim. Order doesn't matter — each app
// only matches its own paths and 404s otherwise, so we chain them.
const features = [tenants(), users(), courses(), tests(), timetable(), notifications(), uploads(), resources(), syllabus()];
root.use(authorize);
for (const f of features) root.use(f);

const port = Number(process.env.PORT ?? 3000);
root.listen(port, () => console.log(`dev backend on http://localhost:${port}`));
