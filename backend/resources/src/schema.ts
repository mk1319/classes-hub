// backend/resources/src/schema.ts
import { z } from 'zod';

export const resourceType = z.enum(['pdf', 'document', 'image', 'video']);

const scope = {
  subjectId: z.number().int().positive().optional(),
  batchId: z.number().int().positive().optional(),
};

// Upload payloads carry the file inline as base64 — simplest path through API
// Gateway/JSON, and uploads are the exception (links are preferred for large
// files per plan/10-resources-feature.md).
const uploadFile = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  dataBase64: z.string().min(1),
});

export const createResourceSchema = z
  .object({
    ...scope,
    type: resourceType,
    title: z.string().min(1),
    storageType: z.enum(['upload', 'link']),
    linkUrl: z.string().url().optional(),
    isDownloadable: z.boolean().optional(),
    file: uploadFile.optional(),
  })
  .refine((v) => (v.subjectId ? 1 : 0) + (v.batchId ? 1 : 0) === 1, {
    message: 'Set exactly one of subjectId or batchId',
  })
  .refine((v) => (v.storageType === 'link' ? !!v.linkUrl : !!v.file), {
    message: 'link requires linkUrl; upload requires file',
  });

export const updateResourceSchema = z
  .object({
    title: z.string().min(1).optional(),
    linkUrl: z.string().url().optional(),
    isDownloadable: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export const listQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  batchId: z.coerce.number().int().positive().optional(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
