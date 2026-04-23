import { describe, it, expect, beforeEach } from "vitest";
import { POST as signupHandler } from "@/app/api/auth/signup/route";
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

describe("POST /api/auth/signup", () => {
  it("creates a user", async () => {
    const req = makeRequest("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "alice@example.com",
        password: "correct-horse-battery-staple",
        username: "alice",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await signupHandler(req);
    expect(res.status).toBe(200);
    const body = await readJson<{ user: { email: string } }>(res);
    expect(body.user.email).toBe("alice@example.com");
  });

  it("rejects taken username with 409", async () => {
    const post = (u: string, email: string) =>
      signupHandler(
        makeRequest("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            email,
            password: "correct-horse-battery-staple",
            username: u,
          }),
          headers: { "Content-Type": "application/json" },
        }),
      );
    const r1 = await post("bob", "bob1@example.com");
    expect(r1.status).toBe(200);
    const r2 = await post("bob", "bob2@example.com");
    expect(r2.status).toBe(409);
  });

  it("rejects short password with 400", async () => {
    const res = await signupHandler(
      makeRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "a@b.com",
          password: "short",
          username: "carol",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });
});
