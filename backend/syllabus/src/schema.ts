// backend/syllabus/src/schema.ts
import { z } from 'zod';

export const createChapterSchema = z.object({
  title: z.string().min(1),
  position: z.number().int().min(0).optional(),
});
export const updateChapterSchema = z
  .object({ title: z.string().min(1).optional(), position: z.number().int().min(0).optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

export const createCoverageSchema = z
  .object({
    // Either link a predefined chapter or provide a free-form title.
    chapterId: z.number().int().positive().optional(),
    title: z.string().min(1).optional(),
    coveredDate: date,
    notes: z.string().optional(),
  })
  .refine((v) => !!v.chapterId || !!v.title, {
    message: 'Provide a chapterId or a free-form title',
  });

export const updateCoverageSchema = z
  .object({
    title: z.string().min(1).optional(),
    coveredDate: date.optional(),
    notes: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type CreateCoverageInput = z.infer<typeof createCoverageSchema>;
export type UpdateCoverageInput = z.infer<typeof updateCoverageSchema>;
