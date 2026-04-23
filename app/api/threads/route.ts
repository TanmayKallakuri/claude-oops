import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, assertNotBanned } from "@/lib/auth/guards";
import { ApiError, toResponse } from "@/lib/auth/errors";
import { threadCreateSchema } from "@/lib/validation/thread";
import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const sort = url.searchParams.get("sort") === "top" ? "top" : "new";
    const rawCursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT), MAX_LIMIT);

    const admin = getAdminClient();
    let query = admin
      .from("threads")
      .select("id, title, body, category, created_at, updated_at, author_id, profiles!inner(username, display_name)")
      .is("deleted_at", null)
      .limit(limit + 1);

    if (category && ["bug", "behavior", "discussion"].includes(category)) {
      query = query.eq("category", category);
    }

    if (sort === "new") {
      const cursor = decodeCursor(rawCursor);
      query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
      if (cursor && typeof cursor.c === "string" && typeof cursor.i === "string") {
        query = query.or(`created_at.lt.${cursor.c},and(created_at.eq.${cursor.c},id.lt.${cursor.i})`);
      }
    } else {
      // top: fetch a wider window then sort by score in memory.
      const cursor = decodeCursor(rawCursor);
      query = query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(500);
      if (cursor && typeof cursor.c === "string" && typeof cursor.i === "string") {
        query = query.or(`created_at.lt.${cursor.c},and(created_at.eq.${cursor.c},id.lt.${cursor.i})`);
      }
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    let scoreMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: scores } = await admin
        .from("vote_counts")
        .select("target_id, score")
        .eq("target_type", "thread")
        .in("target_id", ids);
      scoreMap = new Map((scores ?? []).map((s) => [s.target_id as string, Number(s.score ?? 0)]));
    }

    let countMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: counts } = await admin
        .from("comments")
        .select("thread_id")
        .is("deleted_at", null)
        .in("thread_id", ids);
      for (const row of counts ?? []) {
        countMap.set(row.thread_id as string, (countMap.get(row.thread_id as string) ?? 0) + 1);
      }
    }

    let shaped = (rows ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      category: r.category as string,
      author: {
        username: (r.profiles as unknown as { username: string }).username,
        display_name: (r.profiles as unknown as { display_name: string | null }).display_name,
      },
      score: scoreMap.get(r.id as string) ?? 0,
      comment_count: countMap.get(r.id as string) ?? 0,
      created_at: r.created_at as string,
    }));

    if (sort === "top") {
      shaped.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
        return a.id < b.id ? 1 : -1;
      });
    }

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const input = threadCreateSchema.parse(await req.json());

    const { data, error } = await admin
      .from("threads")
      .insert({
        author_id: userId,
        title: input.title,
        body: input.body,
        category: input.category,
      })
      .select("id, title, body, category, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ thread: data }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
