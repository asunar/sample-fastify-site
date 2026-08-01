// AUTO-GENERATED — do not edit by hand.
// Re-generate with: npm run generate:schemas

import { z } from "zod";

export const BaseUsersInsertSchema = z.object({
  email: z.string().optional(),
  dob: z.string().optional(),
});

export const BaseUsersInsertResponseSchema = z.object({
  id: z.number().int().optional(),
});

export const BaseUsersUpdateSchema = z.object({
  email: z.string().optional(),
  dob: z.string().optional(),
});

export const BaseUsersUpdateParamsSchema = z.object({
  id: z.number().int(),
});
