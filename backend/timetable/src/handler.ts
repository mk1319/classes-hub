// backend/timetable/src/handler.ts
import serverlessHttp from 'serverless-http';
import {
  asyncHandler,
  badRequest,
  createFeatureApp,
  errorHandler,
  type AuthProvider,
} from '@classes-hub/shared';
import { createSessionSchema, listQuerySchema, updateSessionSchema } from './schema';
import { createSessions, deleteSession, listSessions, updateSession } from './timetable';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('INVALID_ID');
  return id;
}

export function buildApp(getAuth?: AuthProvider) {
  const app = createFeatureApp(getAuth);

  app.post('/batches/:batchId/sessions', asyncHandler(async (req, res) => {
    const p = createSessionSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.status(201).json(await createSessions(req.auth, parseId(req.params.batchId), p.data));
  }));

  app.get('/batches/:batchId/sessions', asyncHandler(async (req, res) => {
    const p = listQuerySchema.safeParse(req.query);
    if (!p.success) throw badRequest('INVALID_QUERY');
    res.json(await listSessions(req.auth, parseId(req.params.batchId), p.data.from, p.data.to));
  }));

  app.patch('/batches/:batchId/sessions/:sessionId', asyncHandler(async (req, res) => {
    const p = updateSessionSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await updateSession(req.auth, parseId(req.params.batchId), parseId(req.params.sessionId), p.data));
  }));

  app.delete('/batches/:batchId/sessions/:sessionId', asyncHandler(async (req, res) => {
    const series = req.query.series === 'true';
    await deleteSession(req.auth, parseId(req.params.batchId), parseId(req.params.sessionId), series);
    res.status(204).end();
  }));

  app.use(errorHandler());
  return app;
}

export const handler = serverlessHttp(buildApp());
