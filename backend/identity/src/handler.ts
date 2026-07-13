import serverlessHttp from 'serverless-http';
import {
  createFeatureApp,
  asyncHandler,
  errorHandler,
  getAuthFromRequest,
  unauthorized,
  badRequest,
} from '@classes-hub/shared';
import { login, logout } from './login';
import { loginSchema } from './schema';

// Public routes — API Gateway wires these with Auth: NONE (see template.yaml).
export const publicApp = createFeatureApp();
publicApp.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('BAD_REQUEST', 'Invalid request body');
    try {
      const result = await login(parsed.data);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
        throw unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
      }
      throw err;
    }
  })
);
publicApp.use(errorHandler);

// Authenticated routes — behind the custom authorizer.
export const authedApp = createFeatureApp();
authedApp.post(
  '/auth/logout',
  asyncHandler(async (req, res) => {
    const auth = getAuthFromRequest(req);
    if (!auth) throw unauthorized();
    await logout(auth.sessionId);
    res.status(204).send();
  })
);
authedApp.use(errorHandler);

// Combined app for the real Lambda — API Gateway decides which incoming
// requests carry authorizer context; this handler just serves whichever
// path it's given.
const combined = createFeatureApp();
combined.use(publicApp);
combined.use(authedApp);
combined.use(errorHandler);

export const handler = serverlessHttp(combined);
