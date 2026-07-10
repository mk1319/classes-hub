// backend/tenants/src/handler.ts
import serverlessHttp from 'serverless-http';
import {
  asyncHandler,
  createFeatureApp,
  errorHandler,
  badRequest,
  type AuthProvider,
} from '@classes-hub/shared';
import { createTenantSchema, updateTenantSchema } from './schema';
import { createTenant, getTenant, listTenants, updateTenant } from './tenants';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('INVALID_ID');
  return id;
}

/** Exported for tests: builds the Express app with an injectable auth provider. */
export function buildApp(getAuth?: AuthProvider) {
  const app = createFeatureApp(getAuth);

  app.post(
    '/tenants',
    asyncHandler(async (req, res) => {
      const parsed = createTenantSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest('INVALID_BODY');
      res.status(201).json(await createTenant(req.auth, parsed.data));
    })
  );

  app.get(
    '/tenants',
    asyncHandler(async (req, res) => {
      res.json(await listTenants(req.auth));
    })
  );

  app.get(
    '/tenants/:id',
    asyncHandler(async (req, res) => {
      res.json(await getTenant(req.auth, parseId(req.params.id)));
    })
  );

  app.patch(
    '/tenants/:id',
    asyncHandler(async (req, res) => {
      const parsed = updateTenantSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest('INVALID_BODY');
      res.json(await updateTenant(req.auth, parseId(req.params.id), parsed.data));
    })
  );

  app.use(errorHandler());
  return app;
}

export const handler = serverlessHttp(buildApp());
