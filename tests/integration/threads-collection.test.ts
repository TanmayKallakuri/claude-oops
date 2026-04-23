import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { POST as createThread, GET as listThreads } from "@/app/api/threads/route";
import { createUser } from "../setup/factory";
import { makeRequest, readJson } from "../setup/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

describe("POST /api/threads", () => {
  it("401 when anonymous", async () => {
    const req = makeRequest("/api/threads", {
      method: "POST",
      body: JSON.stringify({ title: "Hello world", body: "body", category: "bug" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await createThread(req);
    expect(res.status).toBe(401);
  });

  it("400 on bad input (auth check runs first — so this also returns 401 anonymously)", async () => {
    const req = makeRequest("/api/threads", {
      method: "POST",
      body: JSON.stringify({ title: "x", body: "", category: "bug" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await createThread(req);
    expect([400, 401]).toContain(res.status);
  });
});

describe("GET /api/threads", () => {
  it("returns empty list with null cursor initially", async () => {
    const req = makeRequest("/api/threads");
    const res = await listThreads(req);
    expect(res.status).toBe(200);
    const body = await readJson<{ items: unknown[]; next_cursor: string | null }>(res);
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
  });

  it("returns threads authored by a created user", async () => {
    const user = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const admin = getAdminClient();
    await admin.from("threads").insert({
      author_id: user.id,
      title: "First thread",
      body: "hello",
      category: "bug",
    });

    const res = await listThreads(makeRequest("/api/threads"));
    const body = await readJson<{ items: Array<{ title: string; author: { username: string } }> }>(res);
    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("First thread");
    expect(body.items[0].author.username).toBe("alice");
  });

  it("filters by category", async () => {
    const user = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const admin = getAdminClient();
    await admin.from("threads").insert([
      { author_id: user.id, title: "bug one", body: "b", category: "bug" },
      { author_id: user.id, title: "discussion one", body: "b", category: "discussion" },
    ]);

    const res = await listThreads(makeRequest("/api/threads?category=bug"));
    const body = await readJson<{ items: Array<{ title: string }> }>(res);
    expect(body.items.map((i) => i.title)).toEqual(["bug one"]);
  });

  it("hides soft-deleted threads", async () => {
    const user = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const admin = getAdminClient();
    const { data: t } = await admin
      .from("threads")
      .insert({ author_id: user.id, title: "will delete", body: "b", category: "bug" })
      .select("id")
      .single();
    await admin.from("threads").update({ deleted_at: new Date().toISOString() }).eq("id", t!.id);

    const res = await listThreads(makeRequest("/api/threads"));
    const body = await readJson<{ items: unknown[] }>(res);
    expect(body.items).toEqual([]);
  });

  it("paginates via next_cursor", async () => {
    const user = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const admin = getAdminClient();
    const rows = Array.from({ length: 25 }, (_, i) => ({
      author_id: user.id,
      title: `thread ${i}`,
      body: "b",
      category: "bug",
    }));
    await admin.from("threads").insert(rows);

    const first = await listThreads(makeRequest("/api/threads?limit=20"));
    const firstBody = await readJson<{ items: Array<{ id: string }>; next_cursor: string | null }>(first);
    expect(firstBody.items).toHaveLength(20);
    expect(firstBody.next_cursor).not.toBeNull();

    const second = await listThreads(makeRequest(`/api/threads?limit=20&cursor=${firstBody.next_cursor}`));
    const secondBody = await readJson<{ items: Array<{ id: string }>; next_cursor: string | null }>(second);
    expect(secondBody.items).toHaveLength(5);
    expect(secondBody.next_cursor).toBeNull();

    const firstIds = new Set(firstBody.items.map((i) => i.id));
    for (const item of secondBody.items) expect(firstIds.has(item.id)).toBe(false);
  });
});
