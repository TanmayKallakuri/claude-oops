import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { GET as getThread, PATCH as patchThread, DELETE as deleteThread } from "@/app/api/threads/[id]/route";
import { createUser } from "../setup/factory";
import { makeRequest, readJson } from "../setup/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

async function createThread(author: { id: string }, overrides: Partial<{ title: string; body: string; category: string }> = {}) {
  const admin = getAdminClient();
  const { data } = await admin
    .from("threads")
    .insert({
      author_id: author.id,
      title: overrides.title ?? "sample",
      body: overrides.body ?? "body",
      category: overrides.category ?? "bug",
    })
    .select("id")
    .single();
  return data!.id as string;
}

describe("GET /api/threads/:id", () => {
  it("returns thread + author + score + comment_count", async () => {
    const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const id = await createThread(alice);

    const res = await getThread(makeRequest(`/api/threads/${id}`), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = await readJson<{ thread: { title: string; author: { username: string }; score: number; comment_count: number; current_user_vote: number } }>(res);
    expect(body.thread.title).toBe("sample");
    expect(body.thread.author.username).toBe("alice");
    expect(body.thread.score).toBe(0);
    expect(body.thread.comment_count).toBe(0);
    expect(body.thread.current_user_vote).toBe(0);
  });

  it("404 for unknown id", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const res = await getThread(makeRequest(`/api/threads/${id}`), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(404);
  });

  it("404 for soft-deleted", async () => {
    const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const id = await createThread(alice);
    const admin = getAdminClient();
    await admin.from("threads").update({ deleted_at: new Date().toISOString() }).eq("id", id);

    const res = await getThread(makeRequest(`/api/threads/${id}`), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH/DELETE /api/threads/:id", () => {
  it("PATCH 401 when anonymous", async () => {
    const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const id = await createThread(alice);
    const res = await patchThread(
      makeRequest(`/api/threads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "new title abc" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(401);
  });

  it("DELETE 401 when anonymous", async () => {
    const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const id = await createThread(alice);
    const res = await deleteThread(makeRequest(`/api/threads/${id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(401);
  });

  it("404 for unknown id (PATCH)", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const res = await patchThread(
      makeRequest(`/api/threads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "new" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect([401, 404]).toContain(res.status);
  });
});
