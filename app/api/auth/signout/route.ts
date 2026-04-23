import { createServerClient } from "@/lib/supabase/server";
import { toResponse } from "@/lib/auth/errors";

export async function POST() {
  try {
    const supabase = await createServerClient();
    await supabase.auth.signOut();
    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
