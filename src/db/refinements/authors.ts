// Hand-written refinements for the authors table. The generated base schemas
// only know column types; tighten them here (z.email(), z.iso.date(), min/max)
// and the constraints flow into both validation and openapi.json.

import { z } from "zod";
import {
  BaseAuthorsInsertSchema,
  BaseAuthorsInsertResponseSchema,
  BaseAuthorsUpdateParamsSchema,
  BaseAuthorsRowSchema,
} from "../../generated/schemas.ts";

export const AuthorsInsertSchema = BaseAuthorsInsertSchema.extend({
  email: z.email(),
});

export const AuthorsInsertResponseSchema = BaseAuthorsInsertResponseSchema;

// Derived from the refined insert schema rather than BaseAuthorsUpdateSchema, so
// PATCH validates email the same way POST does. .partial() reproduces the base
// update shape, where every column is optional.
export const AuthorsUpdateSchema = AuthorsInsertSchema.partial();

// Deliberately left unrefined. The serializer validates responses, so tightening
// email here would turn any pre-existing malformed row into a 500 on read rather
// than rejecting it on write, which is where the check belongs.
export const AuthorsRowSchema = BaseAuthorsRowSchema;

// Path params arrive as strings, so the numeric key is coerced before validation.
export const AuthorsUpdateParamsSchema = BaseAuthorsUpdateParamsSchema.extend({
  id: z.coerce.number().int(),
});
