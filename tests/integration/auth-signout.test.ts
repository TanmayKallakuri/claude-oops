import { describe, it, expect } from "vitest";
import { POST as signout } from "@/app/api/auth/signout/route";

describe("POST /api/auth/signout", () => {
  it("returns ok even without a session", async () => {
    const res = await signout();
    expect(res.status).toBe(200);
  });
});
