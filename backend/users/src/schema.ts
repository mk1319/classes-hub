// backend/users/src/schema.ts
import { z } from 'zod';

// Admins create teachers and students only. Super-admins are provisioned out of
// band (they're not tenant-scoped), and an admin can't mint another admin here.
export const creatableRole = z.enum(['teacher', 'student']);

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: creatableRole,
  password: z.string().min(6),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    role: creatableRole.optional(),
    password: z.string().min(6).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });

// Bulk import: raw CSV text with a header row `email,name,role,password`.
export const bulkImportSchema = z.object({
  csv: z.string().min(1),
});

export const listUsersQuerySchema = z.object({
  role: creatableRole.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
