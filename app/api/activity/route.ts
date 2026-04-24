import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { toResponse } from "@/lib/auth/errors";

type Activity = { type: "vote" | "thread"; text: string; created_at: string };

export async function GET(_req: NextRequest) {
  try {
    const admin = getAdminClient();
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const [threadsRes, votesRes] = await Promise.all([
      admin
        .from("threads")
        .select("title, created_at")
        .is("deleted_at", null)
        .gte("created_at", fifteenMinAgo)
        .order("created_at", { ascending: false })
        .limit(3),
      admin
        .from("votes")
        .select("target_type, target_id, value, created_at")
        .gte("created_at", fifteenMinAgo)
        .order("created_at", { ascending: false })
        .limit(2),
    ]);

    const activity: Activity[] = [];

    for (const t of threadsRes.data ?? []) {
      activity.push({
        type: "thread",
        text: `new thread: "${(t.title as string).slice(0, 48)}"`,
        created_at: t.created_at as string,
      });
    }

    const voteTargetIds = (votesRes.data ?? [])
      .filter((v) => v.target_type === "thread")
      .map((v) => v.target_id as string);
    const titleMap = new Map<string, string>();
    if (voteTargetIds.length > 0) {
      const { data: titles } = await admin
        .from("threads")
        .select("id, title")
        .in("id", voteTargetIds);
      for (const row of titles ?? []) {
        titleMap.set(row.id as string, row.title as string);
      }
    }

    for (const v of votesRes.data ?? []) {
      const title =
        v.target_type === "thread"
          ? titleMap.get(v.target_id as string) ?? "a thread"
          : "a comment";
      const arrow = v.value === 1 ? "▲ someone upvoted" : "▼ someone downvoted";
      activity.push({
        type: "vote",
        text: `${arrow} "${title.slice(0, 36)}"`,
        created_at: v.created_at as string,
      });
    }

    activity.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return Response.json({ items: activity.slice(0, 5) }, {
      headers: { "Cache-Control": "public, max-age=10" },
    });
  } catch (err) {
    return toResponse(err);
  }
}
