import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL — check your .env");
  if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY — check your .env");

  const cookieStore = await cookies();
  return createSSRClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components have a read-only cookie store — writes throw here.
          // Route Handlers and Server Actions can set cookies; middleware refreshes sessions.
        }
      },
    },
  });
}
