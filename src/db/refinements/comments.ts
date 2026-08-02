// Hand-written refinements for the comments table. The generated base schemas
// only know column types; tighten them here (z.email(), z.iso.date(), min/max)
// and the constraints flow into both validation and openapi.json.

import { z } from "zod";
import {
  BaseCommentsInsertSchema,
  BaseCommentsInsertResponseSchema,
  BaseCommentsUpdateSchema,
  BaseCommentsUpdateParamsSchema,
  BaseCommentsRowSchema,
} from "../../generated/schemas.ts";

export const CommentsInsertSchema = BaseCommentsInsertSchema;

export const CommentsInsertResponseSchema = BaseCommentsInsertResponseSchema;

export const CommentsUpdateSchema = BaseCommentsUpdateSchema;

export const CommentsRowSchema = BaseCommentsRowSchema;

// Path params arrive as strings, so the numeric key is coerced before validation.
export const CommentsUpdateParamsSchema = BaseCommentsUpdateParamsSchema.extend({
  id: z.coerce.number().int(),
});
