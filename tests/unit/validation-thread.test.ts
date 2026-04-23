import { describe, it, expect } from "vitest";
import { threadCreateSchema, threadPatchSchema } from "@/lib/validation/thread";

describe("threadCreateSchema", () => {
  const valid = { title: "Hello world", body: "A body", category: "bug" as const };

  it("accepts valid input", () => {
    expect(threadCreateSchema.parse(valid)).toEqual(valid);
  });

  it("rejects too-short title", () => {
    expect(() => threadCreateSchema.parse({ ...valid, title: "hi" })).toThrow();
  });

  it("rejects too-long title (> 200)", () => {
    expect(() => threadCreateSchema.parse({ ...valid, title: "x".repeat(201) })).toThrow();
  });

  it("rejects too-long body (> 10000)", () => {
    expect(() => threadCreateSchema.parse({ ...valid, body: "x".repeat(10001) })).toThrow();
  });

  it("rejects bad category", () => {
    expect(() => threadCreateSchema.parse({ ...valid, category: "nope" })).toThrow();
  });

  it("rejects empty body", () => {
    expect(() => threadCreateSchema.parse({ ...valid, body: "" })).toThrow();
  });
});

describe("threadPatchSchema", () => {
  it("accepts partial update — title only", () => {
    expect(threadPatchSchema.parse({ title: "New title" })).toEqual({ title: "New title" });
  });

  it("accepts partial update — body only", () => {
    expect(threadPatchSchema.parse({ body: "New body" })).toEqual({ body: "New body" });
  });

  it("rejects empty object", () => {
    expect(() => threadPatchSchema.parse({})).toThrow();
  });
});
