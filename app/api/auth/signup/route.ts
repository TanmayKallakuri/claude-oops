import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validation/auth";
import { ApiError, toResponse } from "@/lib/auth/errors";

export async function POST(req: NextRequest) {
  try {
    const input = signupSchema.parse(await req.json());
    const admin = getAdminClient();
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", input.username)
      .maybeSingle();
    if (existing) {
      throw new ApiError("username_taken", "Username already in use", 409);
    }
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${process.env.APP_BASE_URL}/auth/callback`,
        data: { username: input.username },
      },
    });
    if (error) throw new ApiError("signup_failed", error.message, 400);
    return Response.json({ user: data.user });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
