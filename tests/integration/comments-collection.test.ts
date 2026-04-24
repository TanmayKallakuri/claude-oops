import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { GET as listComments, POST as createComment } from "@/app/api/threads/[id]/comments/route";
import { createUser } from "../setup/factory";
import { makeRequest, readJson } from "../setup/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

async function seedThread() {
  const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
  const admin = getAdminClient();
  const { data: thread } = await admin
    .from("threads")
    .insert({ author_id: alice.id, title: "seed thread", body: "body", category: "bug" })
    .select("id")
    .single();
  return { alice, threadId: thread!.id as string };
}

describe("GET /api/threads/:id/comments", () => {
  it("empty list when no comments", async () => {
    const { threadId } = await seedThread();
    const res = await listComments(makeRequest(`/api/threads/${threadId}/comments`), {
      params: Promise.resolve({ id: threadId }),
    });
    expect(res.status).toBe(200);
    const body = await readJson<{ items: unknown[]; next_cursor: null }>(res);
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
  });

  it("404 on unknown thread", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const res = await listComments(makeRequest(`/api/threads/${id}/comments`), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(404);
  });

  it("returns seeded comments with author + score", async () => {
    const { alice, threadId } = await seedThread();
    const admin = getAdminClient();
    await admin.from("comments").insert({
      thread_id: threadId,
      author_id: alice.id,
      body: "first!",
    });
    const res = await listComments(makeRequest(`/api/threads/${threadId}/comments`), {
      params: Promise.resolve({ id: threadId }),
    });
    const body = await readJson<{ items: Array<{ body: string; author: { username: string }; score: number; deleted: boolean }> }>(res);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].body).toBe("first!");
    expect(body.items[0].author.username).toBe("alice");
    expect(body.items[0].score).toBe(0);
    expect(body.items[0].deleted).toBe(false);
  });

  it("masks soft-deleted comments but keeps them in the list", async () => {
    const { alice, threadId } = await seedThread();
    const admin = getAdminClient();
    const { data: c } = await admin
      .from("comments")
      .insert({ thread_id: threadId, author_id: alice.id, body: "will delete" })
      .select("id")
      .single();
    await admin.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", c!.id);

    const res = await listComments(makeRequest(`/api/threads/${threadId}/comments`), {
      params: Promise.resolve({ id: threadId }),
    });
    const body = await readJson<{ items: Array<{ body: string; deleted: boolean; author: unknown }> }>(res);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].deleted).toBe(true);
    expect(body.items[0].body).toBe("");
    expect(body.items[0].author).toBeNull();
  });
});

describe("POST /api/threads/:id/comments", () => {
  it("401 anonymous", async () => {
    const { threadId } = await seedThread();
    const res = await createComment(
      makeRequest(`/api/threads/${threadId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: "hi" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: threadId }) },
    );
    expect(res.status).toBe(401);
  });
});
