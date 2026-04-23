import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { ApiError, toResponse } from "@/lib/auth/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, role, created_at")
      .eq("username", username.toLowerCase())
      .maybeSingle();
    if (error) {
      console.error("Supabase error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      throw new Error(error.message);
    }
    if (!data) throw new ApiError("not_found", "No such profile", 404);
    if (data.role === "banned") {
      throw new ApiError("not_found", "No such profile", 404);
    }
    return Response.json({ profile: data });
  } catch (err) {
    return toResponse(err);
  }
}
