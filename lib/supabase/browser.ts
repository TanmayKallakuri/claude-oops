"use client";

import { createBrowserClient as createSSRBrowser } from "@supabase/ssr";

export function createBrowserClient() {
  return createSSRBrowser(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
