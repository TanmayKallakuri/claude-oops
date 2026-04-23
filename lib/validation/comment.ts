import { z } from "zod";

export const commentCreateSchema = z.object({
  body: z.string().min(1).max(5000),
  parent_comment_id: z.guid().optional(),
});

export const commentPatchSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type CommentPatchInput = z.infer<typeof commentPatchSchema>;
