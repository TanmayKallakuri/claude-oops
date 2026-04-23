import { describe, it, expect, beforeEach } from "vitest";
import { GET as getProfile } from "@/app/api/profiles/[username]/route";
import { createUser } from "../setup/factory";
import { makeRequest, readJson } from "../setup/api-helpers";
import { execSync } from "node:child_process";

function supabaseCli(): string {
  if (process.env.SUPABASE_CLI) return `"${process.env.SUPABASE_CLI}"`;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return `"${process.env.LOCALAPPDATA}\\supabase\\supabase.exe"`;
  }
  return "supabase";
}

beforeEach(() => {
  execSync(`${supabaseCli()} db reset --no-seed`, { stdio: "ignore" });
});

describe("GET /api/profiles/:username", () => {
  it("returns the profile", async () => {
    await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const res = await getProfile(makeRequest("/api/profiles/alice"), {
      params: Promise.resolve({ username: "alice" }),
    });
    expect(res.status).toBe(200);
    const body = await readJson<{ profile: { username: string } }>(res);
    expect(body.profile.username).toBe("alice");
  });

  it("returns 404 for unknown username", async () => {
    const res = await getProfile(makeRequest("/api/profiles/nobody"), {
      params: Promise.resolve({ username: "nobody" }),
    });
    expect(res.status).toBe(404);
  });
});
