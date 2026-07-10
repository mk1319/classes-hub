// backend/syllabus/src/handler.ts
import serverlessHttp from 'serverless-http';
import {
  asyncHandler,
  badRequest,
  createFeatureApp,
  errorHandler,
  type AuthProvider,
} from '@classes-hub/shared';
import { createChapterSchema, createCoverageSchema, updateChapterSchema, updateCoverageSchema } from './schema';
import {
  createChapter,
  createCoverage,
  deleteChapter,
  deleteCoverage,
  listChapters,
  listCoverage,
  updateChapter,
  updateCoverage,
} from './syllabus';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('INVALID_ID');
  return id;
}

export function buildApp(getAuth?: AuthProvider) {
  const app = createFeatureApp(getAuth);

  // Chapters (per subject)
  app.post('/subjects/:subjectId/chapters', asyncHandler(async (req, res) => {
    const p = createChapterSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.status(201).json(await createChapter(req.auth, parseId(req.params.subjectId), p.data));
  }));
  app.get('/subjects/:subjectId/chapters', asyncHandler(async (req, res) => {
    res.json(await listChapters(req.auth, parseId(req.params.subjectId)));
  }));
  app.patch('/subjects/:subjectId/chapters/:chapterId', asyncHandler(async (req, res) => {
    const p = updateChapterSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await updateChapter(req.auth, parseId(req.params.subjectId), parseId(req.params.chapterId), p.data));
  }));
  app.delete('/subjects/:subjectId/chapters/:chapterId', asyncHandler(async (req, res) => {
    await deleteChapter(req.auth, parseId(req.params.subjectId), parseId(req.params.chapterId));
    res.status(204).end();
  }));

  // Coverage (per batch)
  app.post('/batches/:batchId/coverage', asyncHandler(async (req, res) => {
    const p = createCoverageSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.status(201).json(await createCoverage(req.auth, parseId(req.params.batchId), p.data));
  }));
  app.get('/batches/:batchId/coverage', asyncHandler(async (req, res) => {
    res.json(await listCoverage(req.auth, parseId(req.params.batchId)));
  }));
  app.patch('/batches/:batchId/coverage/:coverageId', asyncHandler(async (req, res) => {
    const p = updateCoverageSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await updateCoverage(req.auth, parseId(req.params.batchId), parseId(req.params.coverageId), p.data));
  }));
  app.delete('/batches/:batchId/coverage/:coverageId', asyncHandler(async (req, res) => {
    await deleteCoverage(req.auth, parseId(req.params.batchId), parseId(req.params.coverageId));
    res.status(204).end();
  }));

  app.use(errorHandler());
  return app;
}

export const handler = serverlessHttp(buildApp());
