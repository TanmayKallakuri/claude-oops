import { z } from "zod";

export const voteSchema = z.object({
  target_type: z.enum(["thread", "comment"]),
  target_id: z.guid(),
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export type VoteInput = z.infer<typeof voteSchema>;
