// backend/tenants/src/schema.ts
import { z } from 'zod';

// Branding + per-tenant Flutter flavor config. Kept intentionally open (all
// fields optional) so branding can grow without a migration — it lives in the
// tenants.branding jsonb column.
export const brandingSchema = z
  .object({
    appName: z.string().optional(),
    logoUrl: z.string().url().optional(),
    // Per-tenant accent color for the Flutter build flavor (hex). Falls back to
    // the dashboard amber if unset — see plan/13-flutter-design-guidelines.md.
    accentColor: z
      .string()
      .regex(/^#([0-9a-fA-F]{6})$/, 'accentColor must be a #RRGGBB hex string')
      .optional(),
    // Flutter build-flavor identifier baked into the tenant's app build.
    flavor: z.string().optional(),
  })
  .strict();

export const createTenantSchema = z.object({
  name: z.string().min(1),
  branding: brandingSchema.optional(),
});

export const updateTenantSchema = z
  .object({
    name: z.string().min(1).optional(),
    branding: brandingSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.branding !== undefined, {
    message: 'Provide at least one of name or branding',
  });

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
