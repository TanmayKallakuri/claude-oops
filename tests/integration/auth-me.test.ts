import { describe, it, expect, beforeEach } from "vitest";
import { GET as me } from "@/app/api/auth/me/route";
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

describe("GET /api/auth/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await me();
    expect(res.status).toBe(401);
  });
});
