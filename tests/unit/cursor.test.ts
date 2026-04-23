import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "@/lib/pagination/cursor";

describe("cursor encode/decode", () => {
  it("round-trips a simple cursor", () => {
    const original = { c: "2026-04-23T00:00:00.000Z", i: "11111111-1111-1111-1111-111111111111" };
    const encoded = encodeCursor(original);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(original);
  });

  it("round-trips a cursor with extra numeric fields", () => {
    const original = { c: "2026-04-23T00:00:00.000Z", i: "22222222-2222-2222-2222-222222222222", s: 42 };
    expect(decodeCursor(encodeCursor(original))).toEqual(original);
  });

  it("decodes returns null on malformed input", () => {
    expect(decodeCursor("not-base64")).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("YWJjZGVm")).toBeNull(); // "abcdef" — valid base64, not valid JSON
  });

  it("encodes to URL-safe characters only", () => {
    const encoded = encodeCursor({ c: "2026-04-23T00:00:00.000Z", i: "ffffffff-ffff-ffff-ffff-ffffffffffff" });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
