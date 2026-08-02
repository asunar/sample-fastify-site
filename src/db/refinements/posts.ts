// Hand-written refinements for the posts table. The generated base schemas
// only know column types; tighten them here (z.email(), z.iso.date(), min/max)
// and the constraints flow into both validation and openapi.json.

import { z } from "zod";
import {
  BasePostsInsertSchema,
  BasePostsInsertResponseSchema,
  BasePostsUpdateSchema,
  BasePostsUpdateParamsSchema,
  BasePostsRowSchema,
} from "../../generated/schemas.ts";

export const PostsInsertSchema = BasePostsInsertSchema;

export const PostsInsertResponseSchema = BasePostsInsertResponseSchema;

export const PostsUpdateSchema = BasePostsUpdateSchema;

export const PostsRowSchema = BasePostsRowSchema;

// Path params arrive as strings, so the numeric key is coerced before validation.
export const PostsUpdateParamsSchema = BasePostsUpdateParamsSchema.extend({
  id: z.coerce.number().int(),
});
