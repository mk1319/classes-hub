// backend/notifications/src/handler.ts
import serverlessHttp from 'serverless-http';
import {
  asyncHandler,
  badRequest,
  createFeatureApp,
  errorHandler,
  type AuthProvider,
} from '@classes-hub/shared';
import { createAnnouncementSchema, listQuerySchema, registerTokenSchema } from './schema';
import { createAnnouncement, listAnnouncements, registerToken } from './notifications';

export function buildApp(getAuth?: AuthProvider) {
  const app = createFeatureApp(getAuth);

  app.post('/announcements', asyncHandler(async (req, res) => {
    const p = createAnnouncementSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    res.status(201).json(await createAnnouncement(req.auth, p.data));
  }));

  app.get('/announcements', asyncHandler(async (req, res) => {
    const p = listQuerySchema.safeParse(req.query);
    if (!p.success) throw badRequest('INVALID_QUERY');
    res.json(await listAnnouncements(req.auth, p.data.scope));
  }));

  // Device token registration for push (used by the Flutter app at login).
  app.post('/announcements/tokens', asyncHandler(async (req, res) => {
    const p = registerTokenSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    await registerToken(req.auth, p.data.token);
    res.status(204).end();
  }));

  app.use(errorHandler());
  return app;
}

export const handler = serverlessHttp(buildApp());
