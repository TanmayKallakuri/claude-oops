import { describe, it, expect } from "vitest";
import { commentCreateSchema, commentPatchSchema } from "@/lib/validation/comment";

describe("commentCreateSchema", () => {
  it("accepts top-level comment", () => {
    expect(commentCreateSchema.parse({ body: "hi" })).toEqual({ body: "hi" });
  });

  it("accepts reply with parent_comment_id", () => {
    const input = { body: "reply", parent_comment_id: "11111111-1111-1111-1111-111111111111" };
    expect(commentCreateSchema.parse(input)).toEqual(input);
  });

  it("rejects non-uuid parent_comment_id", () => {
    expect(() => commentCreateSchema.parse({ body: "x", parent_comment_id: "nope" })).toThrow();
  });

  it("rejects empty body", () => {
    expect(() => commentCreateSchema.parse({ body: "" })).toThrow();
  });

  it("rejects body > 5000 chars", () => {
    expect(() => commentCreateSchema.parse({ body: "x".repeat(5001) })).toThrow();
  });
});

describe("commentPatchSchema", () => {
  it("accepts body update", () => {
    expect(commentPatchSchema.parse({ body: "updated" })).toEqual({ body: "updated" });
  });

  it("rejects missing body", () => {
    expect(() => commentPatchSchema.parse({})).toThrow();
  });
});
