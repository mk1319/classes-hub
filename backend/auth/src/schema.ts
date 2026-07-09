// backend/auth/src/schema.ts
import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
  deviceId: z.string(),
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
  ipAddress: z.string().optional(),
});

export type LoginRequestBody = z.infer<typeof loginRequestSchema>;
