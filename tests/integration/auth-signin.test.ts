import { describe, it, expect, beforeEach } from "vitest";
import { POST as signin } from "@/app/api/auth/signin/route";
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

describe("POST /api/auth/signin", () => {
  it("signs in an existing user", async () => {
    await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const res = await signin(
      makeRequest("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "alice@example.com",
          password: "correct-horse-battery-staple",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ user: { email: string } }>(res);
    expect(body.user.email).toBe("alice@example.com");
  });

  it("rejects wrong password with 401", async () => {
    await createUser("bob@example.com", "correct-horse-battery-staple", "bob");
    const res = await signin(
      makeRequest("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "bob@example.com",
          password: "wrong-password-ok",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });
});
