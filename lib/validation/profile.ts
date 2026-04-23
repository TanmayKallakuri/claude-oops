import { z } from "zod";

export const profilePatchSchema = z
  .object({
    display_name: z.string().min(1).max(50).optional(),
    bio: z.string().max(500).optional(),
    avatar_url: z.url().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field required",
  });

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
