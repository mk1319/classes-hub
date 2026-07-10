// backend/tests/src/handler.ts
import serverlessHttp from 'serverless-http';
import {
  asyncHandler,
  badRequest,
  createFeatureApp,
  errorHandler,
  type AuthProvider,
} from '@classes-hub/shared';
import {
  createQuestionSchema,
  createTestSchema,
  gradeAttemptSchema,
  submitAttemptSchema,
  updateQuestionSchema,
  updateTestSchema,
} from './schema';
import {
  createQuestion,
  createTest,
  deleteQuestion,
  deleteTest,
  getQuestion,
  getResult,
  getTest,
  gradeAttempt,
  listQuestions,
  listTests,
  startAttempt,
  submitAttempt,
  updateQuestion,
  updateTest,
} from './tests';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('INVALID_ID');
  return id;
}
function optInt(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function buildApp(getAuth?: AuthProvider) {
  const app = createFeatureApp(getAuth);

  // Question bank
  app.post('/questions', asyncHandler(async (req, res) => {
    const p = createQuestionSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.status(201).json(await createQuestion(req.auth, p.data));
  }));
  app.get('/questions', asyncHandler(async (req, res) => {
    res.json(await listQuestions(req.auth, { subjectId: optInt(req.query.subjectId), type: req.query.type as string | undefined }));
  }));
  app.get('/questions/:id', asyncHandler(async (req, res) => {
    res.json(await getQuestion(req.auth, parseId(req.params.id)));
  }));
  app.patch('/questions/:id', asyncHandler(async (req, res) => {
    const p = updateQuestionSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await updateQuestion(req.auth, parseId(req.params.id), p.data));
  }));
  app.delete('/questions/:id', asyncHandler(async (req, res) => {
    await deleteQuestion(req.auth, parseId(req.params.id));
    res.status(204).end();
  }));

  // Tests
  app.post('/tests', asyncHandler(async (req, res) => {
    const p = createTestSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.status(201).json(await createTest(req.auth, p.data));
  }));
  app.get('/tests', asyncHandler(async (req, res) => {
    res.json(await listTests(req.auth, optInt(req.query.batchId)));
  }));
  app.get('/tests/:id', asyncHandler(async (req, res) => {
    res.json(await getTest(req.auth, parseId(req.params.id)));
  }));
  app.patch('/tests/:id', asyncHandler(async (req, res) => {
    const p = updateTestSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await updateTest(req.auth, parseId(req.params.id), p.data));
  }));
  app.delete('/tests/:id', asyncHandler(async (req, res) => {
    await deleteTest(req.auth, parseId(req.params.id));
    res.status(204).end();
  }));

  // Attempts
  app.post('/tests/:testId/attempts', asyncHandler(async (req, res) => {
    res.status(201).json(await startAttempt(req.auth, parseId(req.params.testId)));
  }));
  app.patch('/attempts/:id/grade', asyncHandler(async (req, res) => {
    const p = gradeAttemptSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await gradeAttempt(req.auth, parseId(req.params.id), p.data));
  }));
  app.get('/attempts/:id/result', asyncHandler(async (req, res) => {
    res.json(await getResult(req.auth, parseId(req.params.id)));
  }));
  app.patch('/attempts/:id', asyncHandler(async (req, res) => {
    const p = submitAttemptSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await submitAttempt(req.auth, parseId(req.params.id), p.data));
  }));

  app.use(errorHandler());
  return app;
}

export const handler = serverlessHttp(buildApp());
