// backend/notifications/src/schema.ts
import { z } from 'zod';

export const createAnnouncementSchema = z
  .object({
    scope: z.enum(['tenant', 'course', 'batch']),
    // Required for course/batch scope; must be omitted for tenant-wide.
    scopeId: z.number().int().positive().optional(),
    title: z.string().min(1),
    body: z.string().min(1),
  })
  .refine((v) => (v.scope === 'tenant' ? v.scopeId === undefined : v.scopeId !== undefined), {
    message: 'scopeId is required for course/batch scope and forbidden for tenant scope',
  });

export const registerTokenSchema = z.object({ token: z.string().min(1) });

export const listQuerySchema = z.object({
  scope: z.enum(['tenant', 'course', 'batch']).optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
