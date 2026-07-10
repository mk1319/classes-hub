// backend/resources/src/handler.ts
import serverlessHttp from 'serverless-http';
import {
  asyncHandler,
  badRequest,
  createFeatureApp,
  errorHandler,
  type AuthProvider,
} from '@classes-hub/shared';
import { createResourceSchema, listQuerySchema, updateResourceSchema } from './schema';
import {
  createResource,
  deleteResource,
  getResource,
  getResourceFile,
  listResources,
  updateResource,
} from './resources';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('INVALID_ID');
  return id;
}

export function buildApp(getAuth?: AuthProvider) {
  const app = createFeatureApp(getAuth);

  app.post('/resources', asyncHandler(async (req, res) => {
    const p = createResourceSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.status(201).json(await createResource(req.auth, p.data));
  }));

  app.get('/resources', asyncHandler(async (req, res) => {
    const p = listQuerySchema.safeParse(req.query);
    if (!p.success) throw badRequest('INVALID_QUERY');
    res.json(await listResources(req.auth, p.data));
  }));

  app.get('/resources/:id/file', asyncHandler(async (req, res) => {
    const file = await getResourceFile(req.auth, parseId(req.params.id));
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.file_data);
  }));

  app.get('/resources/:id', asyncHandler(async (req, res) => {
    res.json(await getResource(req.auth, parseId(req.params.id)));
  }));

  app.patch('/resources/:id', asyncHandler(async (req, res) => {
    const p = updateResourceSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await updateResource(req.auth, parseId(req.params.id), p.data));
  }));

  app.delete('/resources/:id', asyncHandler(async (req, res) => {
    await deleteResource(req.auth, parseId(req.params.id));
    res.status(204).end();
  }));

  app.use(errorHandler());
  return app;
}

export const handler = serverlessHttp(buildApp());
