import { describe, it, expect } from "vitest";
import { initialsFor, colorFor } from "@/lib/ui/initials";

describe("initialsFor", () => {
  it("uses both parts of a two-word display name", () => {
    expect(initialsFor("Tanmay Kumar", "tanmay")).toBe("TK");
  });
  it("falls back to username when display_name is null", () => {
    expect(initialsFor(null, "phoenix0300")).toBe("PH");
  });
  it("handles single-word names", () => {
    expect(initialsFor("alice", "alice")).toBe("AL");
  });
  it("returns ? for empty input", () => {
    expect(initialsFor("", "")).toBe("?");
  });
});

describe("colorFor", () => {
  it("is deterministic for the same username", () => {
    expect(colorFor("phoenix0300")).toEqual(colorFor("phoenix0300"));
  });
  it("returns a warm-palette color", () => {
    const c = colorFor("anyuser");
    expect(c.bg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c.text).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
