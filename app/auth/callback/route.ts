import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${process.env.APP_BASE_URL}/settings`);
}
