import { describe, it, expect } from "vitest";
import { signupSchema, signinSchema } from "@/lib/validation/auth";

describe("signupSchema", () => {
  it("accepts valid input", () => {
    const parsed = signupSchema.parse({
      email: "a@b.com",
      password: "correct-horse-battery-staple",
      username: "alice",
    });
    expect(parsed.username).toBe("alice");
  });

  it("rejects short passwords", () => {
    expect(() =>
      signupSchema.parse({ email: "a@b.com", password: "short", username: "alice" }),
    ).toThrow();
  });

  it("rejects invalid usernames", () => {
    expect(() =>
      signupSchema.parse({
        email: "a@b.com",
        password: "correct-horse-battery-staple",
        username: "a",
      }),
    ).toThrow();
    expect(() =>
      signupSchema.parse({
        email: "a@b.com",
        password: "correct-horse-battery-staple",
        username: "ALICE!",
      }),
    ).toThrow();
  });
});

describe("signinSchema", () => {
  it("accepts valid input", () => {
    expect(signinSchema.parse({ email: "a@b.com", password: "x" })).toBeTruthy();
  });
  it("rejects bad email", () => {
    expect(() => signinSchema.parse({ email: "nope", password: "x" })).toThrow();
  });
});
