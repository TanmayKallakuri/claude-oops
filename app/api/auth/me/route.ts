import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guards";
import { toResponse } from "@/lib/auth/errors";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, role, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Response.json({ profile: data });
  } catch (err) {
    return toResponse(err);
  }
}
