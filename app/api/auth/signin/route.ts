import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { signinSchema } from "@/lib/validation/auth";
import { ApiError, toResponse } from "@/lib/auth/errors";

export async function POST(req: NextRequest) {
  try {
    const input = signinSchema.parse(await req.json());
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(input);
    if (error) {
      throw new ApiError(
        "invalid_credentials",
        "Email or password is incorrect",
        401,
      );
    }
    return Response.json({ user: data.user });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
