// Hand-written refinements for the tags table. The generated base schemas
// only know column types; tighten them here (z.email(), z.iso.date(), min/max)
// and the constraints flow into both validation and openapi.json.

import { z } from "zod";
import {
  BaseTagsInsertSchema,
  BaseTagsInsertResponseSchema,
  BaseTagsUpdateSchema,
  BaseTagsUpdateParamsSchema,
  BaseTagsRowSchema,
} from "../../generated/schemas.ts";

export const TagsInsertSchema = BaseTagsInsertSchema;

export const TagsInsertResponseSchema = BaseTagsInsertResponseSchema;

export const TagsUpdateSchema = BaseTagsUpdateSchema;

export const TagsRowSchema = BaseTagsRowSchema;

// Path params arrive as strings, so the numeric key is coerced before validation.
export const TagsUpdateParamsSchema = BaseTagsUpdateParamsSchema.extend({
  id: z.coerce.number().int(),
});
