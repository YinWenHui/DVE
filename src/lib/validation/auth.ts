import { z } from "zod";
import { roleCodes } from "@/types";

export const loginInputSchema = z.union([
  z.object({ username: z.string().trim().min(3).max(100), password: z.string().min(12).max(256) }).strict(),
  z.object({ previewRole: z.enum(roleCodes) }).strict(),
]);

export const createAdminInputSchema = z.object({
  username: z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.email(),
  displayName: z.string().trim().min(2).max(150),
  password: z.string().min(12).max(256),
});
