import { describe, it, expect } from "vitest";
import { ApiError, toResponse } from "@/lib/auth/errors";

describe("ApiError.toResponse", () => {
  it("renders a 401 JSON response", async () => {
    const err = new ApiError("unauthorized", "You must sign in", 401);
    const res = toResponse(err);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "unauthorized", message: "You must sign in" } });
  });

  it("renders a 400 JSON response", async () => {
    const res = toResponse(new ApiError("bad_input", "Bad", 400));
    expect(res.status).toBe(400);
  });

  it("wraps unknown errors as 500", async () => {
    const res = toResponse(new Error("boom"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal");
  });
});
