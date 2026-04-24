import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, assertNotBanned } from "@/lib/auth/guards";
import { ApiError, toResponse } from "@/lib/auth/errors";
import { commentCreateSchema } from "@/lib/validation/comment";
import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: threadId } = await params;
    const url = new URL(req.url);
    const rawCursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT), MAX_LIMIT);

    const admin = getAdminClient();

    const { data: thread, error: tErr } = await admin
      .from("threads")
      .select("id, deleted_at")
      .eq("id", threadId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread || thread.deleted_at) throw new ApiError("not_found", "Thread not found", 404);

    let query = admin
      .from("comments")
      .select("id, thread_id, parent_comment_id, body, deleted_at, created_at, updated_at, author_id, profiles!inner(username, display_name)")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit + 1);

    const cursor = decodeCursor(rawCursor);
    if (cursor && typeof cursor.c === "string" && typeof cursor.i === "string") {
      query = query.or(`created_at.gt.${cursor.c},and(created_at.eq.${cursor.c},id.gt.${cursor.i})`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    let scoreMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: scores } = await admin
        .from("vote_counts")
        .select("target_id, score")
        .eq("target_type", "comment")
        .in("target_id", ids);
      scoreMap = new Map((scores ?? []).map((s) => [s.target_id as string, Number(s.score ?? 0)]));
    }

    let userVoteMap = new Map<string, number>();
    const supabase = await createServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user && ids.length > 0) {
      const { data: votes } = await admin
        .from("votes")
        .select("target_id, value")
        .eq("user_id", userData.user.id)
        .eq("target_type", "comment")
        .in("target_id", ids);
      userVoteMap = new Map((votes ?? []).map((v) => [v.target_id as string, v.value as number]));
    }

    const shaped = (rows ?? []).map((r) => {
      const deleted = r.deleted_at !== null;
      const profile = r.profiles as unknown as { username: string; display_name: string | null };
      return {
        id: r.id as string,
        thread_id: r.thread_id as string,
        parent_comment_id: r.parent_comment_id as string | null,
        body: deleted ? "" : (r.body as string),
        deleted,
        author: deleted
          ? null
          : {
              username: profile.username,
              display_name: profile.display_name,
            },
        score: scoreMap.get(r.id as string) ?? 0,
        current_user_vote: (userVoteMap.get(r.id as string) ?? 0) as -1 | 0 | 1,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      };
    });

    const hasMore = shaped.length > limit;
    const page = shaped.slice(0, limit);
    const next_cursor =
      hasMore && page.length > 0
        ? encodeCursor({ c: page[page.length - 1].created_at, i: page[page.length - 1].id })
        : null;

    return Response.json({ items: page, next_cursor });
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: threadId } = await params;
    const supabase = await createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const input = commentCreateSchema.parse(await req.json());

    const { data: thread, error: tErr } = await admin
      .from("threads")
      .select("id, deleted_at")
      .eq("id", threadId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread || thread.deleted_at) throw new ApiError("not_found", "Thread not found", 404);

    if (input.parent_comment_id) {
      const { data: parent } = await admin
        .from("comments")
        .select("thread_id, parent_comment_id, deleted_at")
        .eq("id", input.parent_comment_id)
        .maybeSingle();
      if (!parent || parent.deleted_at || parent.thread_id !== threadId) {
        throw new ApiError("not_found", "Parent comment not found", 404);
      }
      if (parent.parent_comment_id !== null) {
        throw new ApiError("nesting_too_deep", "Comments only nest one level", 400);
      }
    }

    const { data, error } = await admin
      .from("comments")
      .insert({
        thread_id: threadId,
        author_id: userId,
        parent_comment_id: input.parent_comment_id ?? null,
        body: input.body,
      })
      .select("id, thread_id, parent_comment_id, body, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ comment: data }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
