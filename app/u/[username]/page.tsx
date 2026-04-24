"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

type Profile = {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type State =
  | { status: "loading" }
  | { status: "found"; profile: Profile }
  | { status: "notfound" };

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!username) return;
    fetch(`/api/profiles/${username}`).then(async (res) => {
      if (res.status === 404) {
        setState({ status: "notfound" });
        return;
      }
      const body = await res.json();
      if (!res.ok || body?.error?.code === "not_found") {
        setState({ status: "notfound" });
        return;
      }
      setState({ status: "found", profile: body.profile });
    });
  }, [username]);

  /* ── Loading ── */
  if (state.status === "loading") {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-12">
        <Card className="p-8">
          <div className="flex items-start gap-6">
            <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-3 pt-1">
              <Skeleton className="h-10 w-56 rounded-xl" />
              <Skeleton className="h-4 w-32 rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg mt-4" />
              <Skeleton className="h-4 w-3/4 rounded-lg" />
            </div>
          </div>
        </Card>
      </main>
    );
  }

  /* ── Not found ── */
  if (state.status === "notfound") {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-12 flex flex-col items-center justify-center text-center min-h-[40vh]">
        <p className="font-serif italic text-4xl text-oops-text">
          this person doesn&apos;t exist<span className="text-oops-primary">.</span>
        </p>
        <p className="text-oops-muted text-base mt-3">
          maybe they never did. the internet is mysterious.
        </p>
        <Link
          href="/"
          className="mt-6 text-sm text-oops-primary hover:underline underline-offset-4"
        >
          ← back to feed
        </Link>
      </main>
    );
  }

  const { profile } = state;

  /* ── Found ── */
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-12">
      {/* Hero card */}
      <Card className="p-8">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <Avatar size="xl" username={profile.username} displayName={profile.display_name} />
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <h1 className="font-serif italic text-4xl md:text-5xl text-oops-text leading-tight tracking-tight">
              {profile.display_name ?? `@${profile.username}`}
            </h1>
            {profile.display_name && (
              <p className="text-oops-muted text-sm mt-1">@{profile.username}</p>
            )}
            <p
              className={`mt-4 whitespace-pre-wrap text-base leading-relaxed ${
                profile.bio ? "text-oops-text" : "text-oops-muted italic"
              }`}
            >
              {profile.bio || "no bio yet. mysterious."}
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="mt-10">
        <div className="flex gap-6 border-b border-oops-border">
          {/* Threads — active */}
          <button
            className="pb-3 border-b-2 border-oops-primary text-oops-primary font-semibold text-sm"
            aria-current="page"
          >
            Threads
          </button>

          {/* Comments — disabled */}
          <span
            className="pb-3 text-oops-muted italic text-sm cursor-not-allowed select-none"
            aria-disabled="true"
          >
            Comments{" "}
            <span className="text-xs not-italic">— coming soon</span>
          </span>
        </div>

        {/* Empty state */}
        <p className="py-12 text-center text-oops-muted italic text-base">
          no threads yet.
        </p>
      </div>
    </main>
  );
}
