import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { PATCH as patchComment, DELETE as deleteComment } from "@/app/api/comments/[id]/route";
import { createUser } from "../setup/factory";
import { makeRequest } from "../setup/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

async function seedThreadWithComment() {
  const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
  const admin = getAdminClient();
  const { data: thread } = await admin
    .from("threads")
    .insert({ author_id: alice.id, title: "seed thread", body: "body", category: "bug" })
    .select("id")
    .single();
  const { data: comment } = await admin
    .from("comments")
    .insert({ thread_id: thread!.id, author_id: alice.id, body: "original" })
    .select("id")
    .single();
  return { alice, threadId: thread!.id as string, commentId: comment!.id as string };
}

describe("PATCH /api/comments/:id", () => {
  it("401 anonymous", async () => {
    const { commentId } = await seedThreadWithComment();
    const res = await patchComment(
      makeRequest(`/api/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ body: "updated" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: commentId }) },
    );
    expect(res.status).toBe(401);
  });

  it("404 on unknown id", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const res = await patchComment(
      makeRequest(`/api/comments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ body: "x" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect([401, 404]).toContain(res.status);
  });
});

describe("DELETE /api/comments/:id", () => {
  it("401 anonymous", async () => {
    const { commentId } = await seedThreadWithComment();
    const res = await deleteComment(makeRequest(`/api/comments/${commentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: commentId }),
    });
    expect(res.status).toBe(401);
  });
});
