import { describe, it, expect } from "vitest";
import { profilePatchSchema } from "@/lib/validation/profile";

describe("profilePatchSchema", () => {
  it("accepts partial update", () => {
    expect(profilePatchSchema.parse({ display_name: "Alice" })).toEqual({
      display_name: "Alice",
    });
  });

  it("rejects too-long bio", () => {
    expect(() => profilePatchSchema.parse({ bio: "x".repeat(501) })).toThrow();
  });

  it("rejects empty object", () => {
    expect(() => profilePatchSchema.parse({})).toThrow();
  });

  it("rejects bad avatar URL", () => {
    expect(() => profilePatchSchema.parse({ avatar_url: "not a url" })).toThrow();
  });
});
