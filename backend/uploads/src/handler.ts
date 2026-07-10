// backend/uploads/src/handler.ts
import serverlessHttp from 'serverless-http';
import { z } from 'zod';
import {
  asyncHandler,
  badRequest,
  createFeatureApp,
  errorHandler,
  forbidden,
  requireTenant,
  type AuthProvider,
} from '@classes-hub/shared';
import { buildKey, defaultPresign, isAllowedContentType, type PresignFn } from './presign';

const presignRequestSchema = z.object({ contentType: z.string().min(1) });

export function buildApp(getAuth?: AuthProvider, presign: PresignFn = defaultPresign) {
  const app = createFeatureApp(getAuth);

  app.post('/uploads/presign', asyncHandler(async (req, res) => {
    const tenantId = requireTenant(req.auth);
    // Only staff upload images (question/solution images); students never do.
    if (req.auth.role === 'student') throw forbidden('STAFF_ONLY');
    const p = presignRequestSchema.safeParse(req.body);
    if (!p.success) throw badRequest('INVALID_BODY');
    if (!isAllowedContentType(p.data.contentType)) throw badRequest('UNSUPPORTED_TYPE');

    const key = buildKey(tenantId, p.data.contentType);
    const url = await presign(key, p.data.contentType);
    res.json({ url, key });
  }));

  app.use(errorHandler());
  return app;
}

export const handler = serverlessHttp(buildApp());
