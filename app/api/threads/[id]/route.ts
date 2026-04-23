import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, assertNotBanned } from "@/lib/auth/guards";
import { ApiError, toResponse } from "@/lib/auth/errors";
import { threadPatchSchema } from "@/lib/validation/thread";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = getAdminClient();

    const { data: thread, error } = await admin
      .from("threads")
      .select("id, title, body, category, created_at, updated_at, author_id, deleted_at, profiles!inner(username, display_name)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread || thread.deleted_at) throw new ApiError("not_found", "Thread not found", 404);

    const { data: scoreRow } = await admin
      .from("vote_counts")
      .select("score")
      .eq("target_type", "thread")
      .eq("target_id", id)
      .maybeSingle();
    const score = Number(scoreRow?.score ?? 0);

    const { count: commentCount } = await admin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", id)
      .is("deleted_at", null);

    let currentUserVote: -1 | 0 | 1 = 0;
    const supabase = await createServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { data: vote } = await admin
        .from("votes")
        .select("value")
        .eq("user_id", userData.user.id)
        .eq("target_type", "thread")
        .eq("target_id", id)
        .maybeSingle();
      if (vote) currentUserVote = vote.value === 1 ? 1 : -1;
    }

    const profile = thread.profiles as unknown as { username: string; display_name: string | null };

    return Response.json({
      thread: {
        id: thread.id,
        title: thread.title,
        body: thread.body,
        category: thread.category,
        author: {
          username: profile.username,
          display_name: profile.display_name,
        },
        score,
        comment_count: commentCount ?? 0,
        current_user_vote: currentUserVote,
        created_at: thread.created_at,
        updated_at: thread.updated_at,
      },
    });
  } catch (err) {
    return toResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const { data: existing, error: fetchErr } = await admin
      .from("threads")
      .select("author_id, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing || existing.deleted_at) throw new ApiError("not_found", "Thread not found", 404);
    if (existing.author_id !== userId) throw new ApiError("forbidden", "Not your thread", 403);

    const input = threadPatchSchema.parse(await req.json());
    const { data, error } = await admin
      .from("threads")
      .update(input)
      .eq("id", id)
      .select("id, title, body, category, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ thread: data });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const { data: existing, error: fetchErr } = await admin
      .from("threads")
      .select("author_id, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing || existing.deleted_at) throw new ApiError("not_found", "Thread not found", 404);
    if (existing.author_id !== userId) throw new ApiError("forbidden", "Not your thread", 403);

    const { error } = await admin
      .from("threads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
