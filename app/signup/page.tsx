"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { BlobBackground } from "@/components/brand/BlobBackground";
import { WordMark } from "@/components/brand/WordMark";

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
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
      toast({ tone: "error", text: body.error?.message ?? "Signup failed" });
      setLoading(false);
      return;
    }
    router.push("/signin" as never);
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* LEFT — form */}
      <div className="flex flex-col justify-center items-center px-6 md:px-12 bg-oops-surface min-h-screen">
        <div className="max-w-md w-full">
          {/* Wordmark visible on mobile only */}
          <div className="mb-8 md:hidden">
            <WordMark size="md" />
          </div>

          <h1 className="font-serif font-medium not-italic text-5xl md:text-6xl text-oops-text leading-tight tracking-tight">
            join the oops<span className="text-oops-primary">.</span>
          </h1>
          <p className="text-oops-muted text-base mt-2">
            post errors, vote, vent.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <input
              name="email"
              type="email"
              required
              placeholder="email"
              className="w-full h-12 rounded-xl border border-oops-border bg-oops-bg/30 px-4 text-base text-oops-text placeholder:text-oops-muted focus:outline-none focus:ring-2 focus:ring-oops-primary/30 focus:border-oops-primary transition-colors"
            />
            <input
              name="username"
              type="text"
              required
              placeholder="username"
              className="w-full h-12 rounded-xl border border-oops-border bg-oops-bg/30 px-4 text-base text-oops-text placeholder:text-oops-muted focus:outline-none focus:ring-2 focus:ring-oops-primary/30 focus:border-oops-primary transition-colors"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="password (≥ 10 chars)"
              className="w-full h-12 rounded-xl border border-oops-border bg-oops-bg/30 px-4 text-base text-oops-text placeholder:text-oops-muted focus:outline-none focus:ring-2 focus:ring-oops-primary/30 focus:border-oops-primary transition-colors"
            />

            <Button
              variant="primary"
              size="lg"
              type="submit"
              className="w-full"
              loading={loading}
            >
              {loading ? "creating…" : "create account"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-oops-muted text-center">
            already have one?{" "}
            <Link
              href="/signin"
              className="text-oops-primary hover:underline underline-offset-2"
            >
              sign in →
            </Link>
          </p>
        </div>
      </div>

      {/* RIGHT — marketing, desktop only */}
      <div className="hidden md:block relative bg-oops-bg min-h-full">
        <BlobBackground />
        <div className="relative z-10 flex flex-col justify-center px-12 min-h-screen">
          <WordMark size="lg" />

          <p className="font-serif font-medium not-italic text-4xl mt-8 text-oops-text leading-snug">
            the group chat for when the vibes go off
          </p>

          <ul className="mt-8 space-y-3 text-base text-oops-muted">
            {[
              "see what's breaking",
              "vote on whether it's just you",
              "get notified when it's fixed — soon™",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-oops-primary flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
