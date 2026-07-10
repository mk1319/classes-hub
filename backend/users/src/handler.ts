// backend/users/src/handler.ts
import serverlessHttp from 'serverless-http';
import {
  asyncHandler,
  badRequest,
  createFeatureApp,
  errorHandler,
  type AuthProvider,
} from '@classes-hub/shared';
import { bulkImportSchema, createUserSchema, listUsersQuerySchema, updateUserSchema } from './schema';
import {
  bulkImport,
  createUser,
  deleteUser,
  getUser,
  getUserSessions,
  listUsers,
  updateUser,
} from './users';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('INVALID_ID');
  return id;
}

export function buildApp(getAuth?: AuthProvider) {
  const app = createFeatureApp(getAuth);

  app.post(
    '/users/bulk-import',
    asyncHandler(async (req, res) => {
      const parsed = bulkImportSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest('INVALID_BODY');
      res.status(200).json(await bulkImport(req.auth, parsed.data.csv));
    })
  );

  app.post(
    '/users',
    asyncHandler(async (req, res) => {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest('INVALID_BODY');
      res.status(201).json(await createUser(req.auth, parsed.data));
    })
  );

  app.get(
    '/users',
    asyncHandler(async (req, res) => {
      const parsed = listUsersQuerySchema.safeParse(req.query);
      if (!parsed.success) throw badRequest('INVALID_QUERY');
      res.json(await listUsers(req.auth, parsed.data.role));
    })
  );

  app.get(
    '/users/:id/sessions',
    asyncHandler(async (req, res) => {
      res.json(await getUserSessions(req.auth, parseId(req.params.id)));
    })
  );

  app.get(
    '/users/:id',
    asyncHandler(async (req, res) => {
      res.json(await getUser(req.auth, parseId(req.params.id)));
    })
  );

  app.patch(
    '/users/:id',
    asyncHandler(async (req, res) => {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest('INVALID_BODY');
      res.json(await updateUser(req.auth, parseId(req.params.id), parsed.data));
    })
  );

  app.delete(
    '/users/:id',
    asyncHandler(async (req, res) => {
      await deleteUser(req.auth, parseId(req.params.id));
      res.status(204).end();
    })
  );

  app.use(errorHandler());
  return app;
}

export const handler = serverlessHttp(buildApp());
