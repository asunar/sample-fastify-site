// Hand-written refinements for the post_tags table. The generated base schemas
// only know column types; tighten them here (z.email(), z.iso.date(), min/max)
// and the constraints flow into both validation and openapi.json.

import { z } from "zod";
import {
  BasePostTagsInsertSchema,
  BasePostTagsInsertResponseSchema,
  BasePostTagsUpdateSchema,
  BasePostTagsUpdateParamsSchema,
  BasePostTagsRowSchema,
} from "../../generated/schemas.ts";

export const PostTagsInsertSchema = BasePostTagsInsertSchema;

export const PostTagsInsertResponseSchema = BasePostTagsInsertResponseSchema;

export const PostTagsUpdateSchema = BasePostTagsUpdateSchema;

export const PostTagsRowSchema = BasePostTagsRowSchema;

// Path params arrive as strings, so the numeric key is coerced before validation.
export const PostTagsUpdateParamsSchema = BasePostTagsUpdateParamsSchema.extend({
  id: z.coerce.number().int(),
});
