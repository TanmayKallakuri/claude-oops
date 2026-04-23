import { describe, it, expect } from "vitest";
import { voteSchema } from "@/lib/validation/vote";

describe("voteSchema", () => {
  const base = { target_type: "thread" as const, target_id: "11111111-1111-1111-1111-111111111111" };

  it("accepts +1", () => {
    expect(voteSchema.parse({ ...base, value: 1 })).toEqual({ ...base, value: 1 });
  });

  it("accepts -1", () => {
    expect(voteSchema.parse({ ...base, value: -1 })).toEqual({ ...base, value: -1 });
  });

  it("accepts 0 (clear)", () => {
    expect(voteSchema.parse({ ...base, value: 0 })).toEqual({ ...base, value: 0 });
  });

  it("rejects other integer values", () => {
    expect(() => voteSchema.parse({ ...base, value: 2 })).toThrow();
    expect(() => voteSchema.parse({ ...base, value: -3 })).toThrow();
  });

  it("rejects unknown target_type", () => {
    expect(() => voteSchema.parse({ ...base, target_type: "user", value: 1 })).toThrow();
  });

  it("rejects non-uuid target_id", () => {
    expect(() => voteSchema.parse({ target_type: "thread", target_id: "nope", value: 1 })).toThrow();
  });
});
