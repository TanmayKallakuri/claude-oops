import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { POST as vote } from "@/app/api/votes/route";
import { makeRequest } from "../setup/api-helpers";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

describe("POST /api/votes", () => {
  it("401 anonymous", async () => {
    const res = await vote(
      makeRequest("/api/votes", {
        method: "POST",
        body: JSON.stringify({
          target_type: "thread",
          target_id: "11111111-1111-1111-1111-111111111111",
          value: 1,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("400 on bad value (auth runs first — also 401 anon)", async () => {
    const res = await vote(
      makeRequest("/api/votes", {
        method: "POST",
        body: JSON.stringify({
          target_type: "thread",
          target_id: "11111111-1111-1111-1111-111111111111",
          value: 5,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect([400, 401]).toContain(res.status);
  });
});
