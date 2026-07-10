// backend/packages/shared/src/webapp.ts
//
// Express plumbing shared by every feature Lambda: the auth-context middleware,
// an async route wrapper, and a uniform error handler. This keeps each feature's
// handler.ts to just its routes.

import express, { type Express, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { getAuthFromRequest, HttpError, type AuthContext } from './http';

/** Express Request augmented with the resolved auth context. */
export interface AuthedRequest extends Request {
  auth: AuthContext;
}

/**
 * How to derive the caller identity from a request. Production uses
 * getAuthFromRequest (reads the API Gateway authorizer context). Tests inject a
 * stub so they can drive the app with supertest without a real authorizer.
 */
export type AuthProvider = (req: Request) => AuthContext | null;

/**
 * Build a base Express app with JSON body parsing + an auth-context middleware.
 * Callers mount their routes on the returned app. `getAuth` defaults to the real
 * API-Gateway extractor; pass a stub in tests.
 */
export function createFeatureApp(getAuth: AuthProvider = getAuthFromRequest, jsonLimit = '25mb'): Express {
  const app = express();
  app.use(express.json({ limit: jsonLimit }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    const auth = getAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    (req as AuthedRequest).auth = auth;
    next();
  });
  return app;
}

/** Wrap an async route so thrown errors reach Express's error handler. */
export function asyncHandler(
  fn: (req: AuthedRequest, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req as AuthedRequest, res).catch(next);
  };
}

/**
 * Terminal error-handling middleware. Maps HttpError to its status/code and
 * everything else to a 500. Mount this last, after all routes.
 */
export function errorHandler(): (err: unknown, req: Request, res: Response, next: NextFunction) => void {
  return (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
}
