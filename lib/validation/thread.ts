import { z } from "zod";

export const threadCreateSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(10000),
  category: z.enum(["bug", "behavior", "discussion"]),
});

export const threadPatchSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    body: z.string().min(1).max(10000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

export type ThreadCreateInput = z.infer<typeof threadCreateSchema>;
export type ThreadPatchInput = z.infer<typeof threadPatchSchema>;
