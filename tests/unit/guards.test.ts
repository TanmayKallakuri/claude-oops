import { describe, it, expect, vi } from "vitest";
import { requireAuth, requireRole } from "@/lib/auth/guards";

function makeSupabase(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as never;
}

function makeAdmin(profile: { role: string } | null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
    }),
  } as never;
}

describe("requireAuth", () => {
  it("returns user id when session exists", async () => {
    const sb = makeSupabase({ id: "u1" });
    const id = await requireAuth(sb);
    expect(id).toBe("u1");
  });

  it("throws 401 when no user", async () => {
    const sb = makeSupabase(null);
    await expect(requireAuth(sb)).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
  });
});

describe("requireRole", () => {
  it("passes when role matches", async () => {
    const sb = makeSupabase({ id: "u1" });
    const admin = makeAdmin({ role: "mod" });
    const id = await requireRole(sb, admin, ["mod", "admin"]);
    expect(id).toBe("u1");
  });

  it("throws 403 when role lower", async () => {
    const sb = makeSupabase({ id: "u1" });
    const admin = makeAdmin({ role: "user" });
    await expect(requireRole(sb, admin, ["mod"])).rejects.toMatchObject({ status: 403 });
  });

  it("throws 403 when banned", async () => {
    const sb = makeSupabase({ id: "u1" });
    const admin = makeAdmin({ role: "banned" });
    await expect(
      requireRole(sb, admin, ["user", "mod", "admin"]),
    ).rejects.toMatchObject({ status: 403 });
  });
});
