"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        username: form.get("username"),
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setErr(body.error?.message ?? "Signup failed");
      return;
    }
    router.push("/signin");
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Sign up</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          name="email"
          type="email"
          required
          placeholder="email"
          className="w-full border p-2"
        />
        <input
          name="username"
          type="text"
          required
          placeholder="username"
          className="w-full border p-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="password (>=10 chars)"
          className="w-full border p-2"
        />
        <button className="w-full bg-slate-900 p-2 text-white">
          Create account
        </button>
      </form>
      {err && <p className="mt-3 text-red-600">{err}</p>}
    </main>
  );
}
