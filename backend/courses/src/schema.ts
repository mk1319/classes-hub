// backend/courses/src/schema.ts
import { z } from 'zod';

export const createCourseSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1).optional(),
});
export const updateCourseSchema = z
  .object({ name: z.string().min(1).optional(), type: z.string().min(1).optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export const createSubjectSchema = z.object({ name: z.string().min(1) });
export const updateSubjectSchema = z.object({ name: z.string().min(1) });

export const createBatchSchema = z.object({
  name: z.string().min(1),
  scheduleInfo: z.string().optional(),
});
export const updateBatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    scheduleInfo: z.string().optional(),
    showProgressToStudents: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export const assignTeacherSchema = z.object({ userId: z.number().int().positive() });
export const enrollStudentSchema = z.object({ studentId: z.number().int().positive() });

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
