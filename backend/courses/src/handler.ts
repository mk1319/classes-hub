// backend/courses/src/handler.ts
import serverlessHttp from 'serverless-http';
import {
  asyncHandler,
  badRequest,
  createFeatureApp,
  errorHandler,
  type AuthProvider,
} from '@classes-hub/shared';
import {
  assignTeacherSchema,
  createBatchSchema,
  createCourseSchema,
  createSubjectSchema,
  enrollStudentSchema,
  updateBatchSchema,
  updateCourseSchema,
  updateSubjectSchema,
} from './schema';
import {
  assignTeacher,
  createBatch,
  createCourse,
  createSubject,
  deleteBatch,
  deleteCourse,
  deleteSubject,
  enrollStudent,
  getBatch,
  getCourse,
  listBatches,
  listCourses,
  listEnrollments,
  listSubjects,
  listTeachers,
  removeTeacher,
  unenrollStudent,
  updateBatch,
  updateCourse,
  updateSubject,
} from './courses';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('INVALID_ID');
  return id;
}

export function buildApp(getAuth?: AuthProvider) {
  const app = createFeatureApp(getAuth);

  // Courses
  app.post('/courses', asyncHandler(async (req, res) => {
    const p = createCourseSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.status(201).json(await createCourse(req.auth, p.data));
  }));
  app.get('/courses', asyncHandler(async (req, res) => {
    res.json(await listCourses(req.auth));
  }));
  app.get('/courses/:courseId', asyncHandler(async (req, res) => {
    res.json(await getCourse(req.auth, parseId(req.params.courseId)));
  }));
  app.patch('/courses/:courseId', asyncHandler(async (req, res) => {
    const p = updateCourseSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await updateCourse(req.auth, parseId(req.params.courseId), p.data));
  }));
  app.delete('/courses/:courseId', asyncHandler(async (req, res) => {
    await deleteCourse(req.auth, parseId(req.params.courseId));
    res.status(204).end();
  }));

  // Subjects (nested under a course)
  app.post('/courses/:courseId/subjects', asyncHandler(async (req, res) => {
    const p = createSubjectSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.status(201).json(await createSubject(req.auth, parseId(req.params.courseId), p.data.name));
  }));
  app.get('/courses/:courseId/subjects', asyncHandler(async (req, res) => {
    res.json(await listSubjects(req.auth, parseId(req.params.courseId)));
  }));
  app.patch('/courses/:courseId/subjects/:subjectId', asyncHandler(async (req, res) => {
    const p = updateSubjectSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await updateSubject(req.auth, parseId(req.params.courseId), parseId(req.params.subjectId), p.data.name));
  }));
  app.delete('/courses/:courseId/subjects/:subjectId', asyncHandler(async (req, res) => {
    await deleteSubject(req.auth, parseId(req.params.courseId), parseId(req.params.subjectId));
    res.status(204).end();
  }));

  // Batches (nested under a subject for create/list; addressed directly otherwise)
  app.post('/subjects/:subjectId/batches', asyncHandler(async (req, res) => {
    const p = createBatchSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.status(201).json(await createBatch(req.auth, parseId(req.params.subjectId), p.data));
  }));
  app.get('/subjects/:subjectId/batches', asyncHandler(async (req, res) => {
    res.json(await listBatches(req.auth, parseId(req.params.subjectId)));
  }));
  app.get('/batches/:batchId', asyncHandler(async (req, res) => {
    res.json(await getBatch(req.auth, parseId(req.params.batchId)));
  }));
  app.patch('/batches/:batchId', asyncHandler(async (req, res) => {
    const p = updateBatchSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.json(await updateBatch(req.auth, parseId(req.params.batchId), p.data));
  }));
  app.delete('/batches/:batchId', asyncHandler(async (req, res) => {
    await deleteBatch(req.auth, parseId(req.params.batchId));
    res.status(204).end();
  }));

  // Teacher assignment
  app.post('/batches/:batchId/teachers', asyncHandler(async (req, res) => {
    const p = assignTeacherSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    await assignTeacher(req.auth, parseId(req.params.batchId), p.data.userId);
    res.status(204).end();
  }));
  app.get('/batches/:batchId/teachers', asyncHandler(async (req, res) => {
    res.json(await listTeachers(req.auth, parseId(req.params.batchId)));
  }));
  app.delete('/batches/:batchId/teachers/:userId', asyncHandler(async (req, res) => {
    await removeTeacher(req.auth, parseId(req.params.batchId), parseId(req.params.userId));
    res.status(204).end();
  }));

  // Enrollment
  app.post('/batches/:batchId/enrollments', asyncHandler(async (req, res) => {
    const p = enrollStudentSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    await enrollStudent(req.auth, parseId(req.params.batchId), p.data.studentId);
    res.status(204).end();
  }));
  app.get('/batches/:batchId/enrollments', asyncHandler(async (req, res) => {
    res.json(await listEnrollments(req.auth, parseId(req.params.batchId)));
  }));
  app.delete('/batches/:batchId/enrollments/:studentId', asyncHandler(async (req, res) => {
    await unenrollStudent(req.auth, parseId(req.params.batchId), parseId(req.params.studentId));
    res.status(204).end();
  }));

  app.use(errorHandler());
  return app;
}

export const handler = serverlessHttp(buildApp());
