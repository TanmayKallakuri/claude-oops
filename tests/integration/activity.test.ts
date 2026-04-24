import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { GET as getActivity } from "@/app/api/activity/route";
import { createUser } from "../setup/factory";
import { makeRequest, readJson } from "../setup/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";

beforeEach(async () => {
  try {
    execSync("supabase db reset --no-seed", { stdio: "ignore" });
  } catch {
    // Transient 502 after a prior reset — wait 10s and retry once (per spec)
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    execSync("supabase db reset --no-seed", { stdio: "ignore" });
  }
});

describe("GET /api/activity", () => {
  it("returns empty list when no recent activity", async () => {
    const res = await getActivity(makeRequest("/api/activity"));
    expect(res.status).toBe(200);
    const body = await readJson<{ items: unknown[] }>(res);
    expect(body.items).toEqual([]);
  });

  it("includes recently-created threads", async () => {
    const user = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const admin = getAdminClient();
    await admin.from("threads").insert({
      author_id: user.id,
      title: "fresh thread",
      body: "body",
      category: "bug",
    });

    const res = await getActivity(makeRequest("/api/activity"));
    const body = await readJson<{ items: Array<{ type: string; text: string }> }>(res);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.some((i) => i.type === "thread" && i.text.includes("fresh thread"))).toBe(true);
  });
});
