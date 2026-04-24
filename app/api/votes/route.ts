import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, assertNotBanned } from "@/lib/auth/guards";
import { ApiError, toResponse } from "@/lib/auth/errors";
import { voteSchema } from "@/lib/validation/vote";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const input = voteSchema.parse(await req.json());

    const table = input.target_type === "thread" ? "threads" : "comments";
    const { data: target, error: tErr } = await admin
      .from(table)
      .select("id, deleted_at")
      .eq("id", input.target_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!target || target.deleted_at) {
      throw new ApiError("not_found", "Target not found", 404);
    }

    if (input.value === 0) {
      await admin
        .from("votes")
        .delete()
        .eq("user_id", userId)
        .eq("target_type", input.target_type)
        .eq("target_id", input.target_id);
    } else {
      await admin
        .from("votes")
        .upsert(
          {
            user_id: userId,
            target_type: input.target_type,
            target_id: input.target_id,
            value: input.value,
          },
          { onConflict: "user_id,target_type,target_id" },
        );
    }

    const { data: scoreRow } = await admin
      .from("vote_counts")
      .select("score")
      .eq("target_type", input.target_type)
      .eq("target_id", input.target_id)
      .maybeSingle();
    const score = Number(scoreRow?.score ?? 0);

    return Response.json({ score, current_user_vote: input.value });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
