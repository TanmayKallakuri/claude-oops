import { describe, it, expect, vi } from "vitest";
import { assertNotBanned } from "@/lib/auth/guards";

function makeAdmin(role: string | null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: role ? { role } : null, error: null }),
    }),
  } as any;
}

describe("assertNotBanned", () => {
  it("resolves for role=user", async () => {
    await expect(assertNotBanned(makeAdmin("user"), "u1")).resolves.toBeUndefined();
  });

  it("resolves for role=mod", async () => {
    await expect(assertNotBanned(makeAdmin("mod"), "u1")).resolves.toBeUndefined();
  });

  it("resolves for role=admin", async () => {
    await expect(assertNotBanned(makeAdmin("admin"), "u1")).resolves.toBeUndefined();
  });

  it("throws 403 for role=banned", async () => {
    await expect(assertNotBanned(makeAdmin("banned"), "u1")).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
  });

  it("throws 401 when profile missing", async () => {
    await expect(assertNotBanned(makeAdmin(null), "u1")).rejects.toMatchObject({
      status: 401,
    });
  });
});
