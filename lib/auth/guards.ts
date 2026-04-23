import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./errors";

export type Role = "user" | "mod" | "admin" | "banned";

export async function requireAuth(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError("unauthorized", "You must be signed in", 401);
  }
  return data.user.id;
}

export async function requireRole(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  allowed: Role[],
): Promise<string> {
  const userId = await requireAuth(supabase);
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new ApiError("internal", "Role lookup failed", 500);
  if (!data) throw new ApiError("unauthorized", "Profile missing", 401);
  const role = data.role as Role;
  if (role === "banned" || !allowed.includes(role)) {
    throw new ApiError("forbidden", "Insufficient permissions", 403);
  }
  return userId;
}
