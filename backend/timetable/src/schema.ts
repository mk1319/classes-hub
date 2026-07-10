// backend/timetable/src/schema.ts
import { z } from 'zod';

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'time must be HH:MM');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

export const createSessionSchema = z
  .object({
    title: z.string().optional(),
    sessionDate: date,
    startTime: time,
    endTime: time,
    recurrence: z.enum(['none', 'weekly']).optional(),
    // Required when recurrence is 'weekly': generate rows through this date.
    recurUntil: date.optional(),
  })
  .refine((v) => v.recurrence !== 'weekly' || !!v.recurUntil, {
    message: 'recurUntil is required for weekly recurrence',
  });

export const updateSessionSchema = z
  .object({
    title: z.string().optional(),
    sessionDate: date.optional(),
    startTime: time.optional(),
    endTime: time.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

export const listQuerySchema = z.object({
  from: date.optional(),
  to: date.optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
