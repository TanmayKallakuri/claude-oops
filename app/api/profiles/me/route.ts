import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guards";
import { profilePatchSchema } from "@/lib/validation/profile";
import { ApiError, toResponse } from "@/lib/auth/errors";

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const userId = await requireAuth(supabase);
    const input = profilePatchSchema.parse(await req.json());
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update(input)
      .eq("id", userId)
      .select("id, username, display_name, avatar_url, bio, role, created_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Response.json({ profile: data });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
