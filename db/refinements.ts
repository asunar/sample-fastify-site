import { z } from "zod";
import {
  BaseUsersInsertSchema,
  BaseUsersInsertResponseSchema,
  BaseUsersUpdateParamsSchema,
} from "../generated/schemas.ts";

export const UsersInsertSchema = BaseUsersInsertSchema.extend({
  email: z.email(),
  dob: z.iso.date().optional(),
});

export const UsersInsertResponseSchema = BaseUsersInsertResponseSchema;

export const UsersUpdateSchema = UsersInsertSchema.partial();

export const UsersUpdateParamsSchema = BaseUsersUpdateParamsSchema.extend({
  id: z.coerce.number().int(),
});
