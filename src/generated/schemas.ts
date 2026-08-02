// AUTO-GENERATED — do not edit by hand.
// Re-generate with: npm run generate:schemas

import { z } from "zod";

export const BaseAuthorsInsertSchema = z.object({
  name: z.string(),
  email: z.string(),
  bio: z.string().optional(),
  created_at: z.string().optional(),
});

export const BaseAuthorsInsertResponseSchema = z.object({
  id: z.number().int(),
});

export const BaseAuthorsUpdateSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  bio: z.string().optional(),
  created_at: z.string().optional(),
});

export const BaseAuthorsUpdateParamsSchema = z.object({
  id: z.number().int(),
});

export const BaseAuthorsRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  bio: z.string().nullable(),
  created_at: z.string(),
});
export const BasePostsInsertSchema = z.object({
  author_id: z.number().int(),
  title: z.string(),
  slug: z.string(),
  body: z.string(),
  published: z.number().int().optional(),
  created_at: z.string().optional(),
});

export const BasePostsInsertResponseSchema = z.object({
  id: z.number().int(),
});

export const BasePostsUpdateSchema = z.object({
  author_id: z.number().int().optional(),
  title: z.string().optional(),
  slug: z.string().optional(),
  body: z.string().optional(),
  published: z.number().int().optional(),
  created_at: z.string().optional(),
});

export const BasePostsUpdateParamsSchema = z.object({
  id: z.number().int(),
});

export const BasePostsRowSchema = z.object({
  id: z.number().int(),
  author_id: z.number().int(),
  title: z.string(),
  slug: z.string(),
  body: z.string(),
  published: z.number().int(),
  created_at: z.string(),
});
export const BaseCommentsInsertSchema = z.object({
  post_id: z.number().int(),
  author_name: z.string(),
  author_email: z.string().optional(),
  body: z.string(),
  created_at: z.string().optional(),
});

export const BaseCommentsInsertResponseSchema = z.object({
  id: z.number().int(),
});

export const BaseCommentsUpdateSchema = z.object({
  post_id: z.number().int().optional(),
  author_name: z.string().optional(),
  author_email: z.string().optional(),
  body: z.string().optional(),
  created_at: z.string().optional(),
});

export const BaseCommentsUpdateParamsSchema = z.object({
  id: z.number().int(),
});

export const BaseCommentsRowSchema = z.object({
  id: z.number().int(),
  post_id: z.number().int(),
  author_name: z.string(),
  author_email: z.string().nullable(),
  body: z.string(),
  created_at: z.string(),
});
export const BaseTagsInsertSchema = z.object({
  name: z.string(),
});

export const BaseTagsInsertResponseSchema = z.object({
  id: z.number().int(),
});

export const BaseTagsUpdateSchema = z.object({
  name: z.string().optional(),
});

export const BaseTagsUpdateParamsSchema = z.object({
  id: z.number().int(),
});

export const BaseTagsRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});
export const BasePostTagsInsertSchema = z.object({
  post_id: z.number().int(),
  tag_id: z.number().int(),
});

export const BasePostTagsInsertResponseSchema = z.object({
  id: z.number().int(),
});

export const BasePostTagsUpdateSchema = z.object({
  post_id: z.number().int().optional(),
  tag_id: z.number().int().optional(),
});

export const BasePostTagsUpdateParamsSchema = z.object({
  id: z.number().int(),
});

export const BasePostTagsRowSchema = z.object({
  id: z.number().int(),
  post_id: z.number().int(),
  tag_id: z.number().int(),
});
