"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SigninPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setErr(body.error?.message ?? "Sign-in failed");
      return;
    }
    router.push("/settings");
  }

  async function github() {
    const { createBrowserClient } = await import("@/lib/supabase/browser");
    const supabase = createBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          name="email"
          type="email"
          required
          placeholder="email"
          className="w-full border p-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="password"
          className="w-full border p-2"
        />
        <button className="w-full bg-slate-900 p-2 text-white">Sign in</button>
      </form>
      <button onClick={github} className="mt-3 w-full border p-2">
        Sign in with GitHub
      </button>
      {err && <p className="mt-3 text-red-600">{err}</p>}
    </main>
  );
}
