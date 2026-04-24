"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlobBackground } from "@/components/brand/BlobBackground";
import { ActivityTicker } from "@/components/brand/ActivityTicker";
import { ThreadCard, type ThreadSummary } from "@/components/forum/ThreadCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

type Me = { id: string; username: string; display_name: string | null } | null;

export default function LandingPage() {
  const [me, setMe] = useState<Me>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [previewThreads, setPreviewThreads] = useState<ThreadSummary[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) return setMe(null);
        const body = (await r.json()) as { profile: Me };
        setMe(body.profile);
      })
      .finally(() => setMeLoaded(true));

    fetch("/api/threads?limit=3&sort=new")
      .then(async (r) => {
        if (!r.ok) return;
        const body = (await r.json()) as { items: ThreadSummary[] };
        setPreviewThreads(body.items ?? []);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-oops-bg">
      {/* ── Section 1: Hero ── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden">
        <BlobBackground />
        <div className="relative z-10 w-full max-w-3xl mx-auto px-4 md:px-8 py-24 flex flex-col items-start">
          <h1 className="font-serif font-medium not-italic text-6xl md:text-7xl lg:text-8xl tracking-tight leading-none text-oops-text">
            oh no, what did Claude do{" "}
            <span className="text-oops-primary">this time?</span>
          </h1>
          <p className="text-lg text-oops-muted mt-6">
            the group chat for when the vibes go off.
          </p>
          <div className="mt-10 flex gap-3 flex-wrap">
            <Link href={"/feed" as never}>
              <Button size="lg" variant="primary">see the feed →</Button>
            </Link>
            {meLoaded && !me && (
              <Link href={"/signup" as never}>
                <Button size="lg" variant="ghost">sign up</Button>
              </Link>
            )}
          </div>
          <ActivityTicker className="mt-8 max-w-md" />
        </div>
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
          <span className="text-xs text-oops-muted animate-float select-none">↓ scroll</span>
        </div>
      </section>

      {/* ── Section 2: What this is ── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-oops-muted">
            a community log
          </span>
          <h2 className="font-serif font-medium not-italic text-4xl md:text-5xl tracking-tight text-oops-text mt-4">
            where Claude breaks, we log it.
          </h2>
          <p className="text-base md:text-lg text-oops-text/80 leading-relaxed max-w-2xl mt-6">
            Claude is an incredible model. Claude also forgets instructions, hallucinates APIs that
            don&apos;t exist, spins on 529s, and sometimes just... changes. This is where users
            gather to log those moments — so you know it&apos;s not just you.
          </p>
        </div>
      </section>

      {/* ── Section 3: Three kinds of oops ── */}
      <section className="py-24 bg-oops-surface">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-oops-muted">
            what gets posted
          </span>
          <h2 className="font-serif font-medium not-italic text-4xl md:text-5xl tracking-tight text-oops-text mt-4">
            three kinds of oops.
          </h2>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            <Card className="p-6">
              <Pill tone="danger" className="mb-4">bug</Pill>
              <p className="text-sm text-oops-text/80 leading-relaxed mt-2">
                Claude returned garbage / 529ed / broke JSON. Reproducible, specific.
              </p>
            </Card>
            <Card className="p-6">
              <Pill tone="accent" className="mb-4">behavior</Pill>
              <p className="text-sm text-oops-text/80 leading-relaxed mt-2">
                Claude is weirder, lazier, or more verbose than before. Vibes stuff.
              </p>
            </Card>
            <Card className="p-6">
              <Pill tone="primary" className="mb-4">discussion</Pill>
              <p className="text-sm text-oops-text/80 leading-relaxed mt-2">
                Everything else. Tips, workflows, prompts, model comparisons.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Section 4: How it works ── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-oops-muted">
            three steps
          </span>
          <h2 className="font-serif font-medium not-italic text-4xl md:text-5xl tracking-tight text-oops-text mt-4">
            post, discuss, move on.
          </h2>
          <div className="mt-10 space-y-10">
            {[
              {
                n: "1",
                title: "log what broke.",
                body: "Title, category, body. That's it. Plain text for now.",
              },
              {
                n: "2",
                title: "others chime in.",
                body: "One level of replies. Votes for signal. No karma races.",
              },
              {
                n: "3",
                title: "see what's real.",
                body: "Top of the feed tells you if the community agrees it's broken or just you.",
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex items-start gap-6">
                <span className="font-serif text-6xl text-oops-primary leading-none shrink-0 select-none">
                  {n}
                </span>
                <div className="pt-2">
                  <p className="text-lg font-semibold text-oops-text">{title}</p>
                  <p className="text-base text-oops-text/70 leading-relaxed mt-1">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: Live from the feed ── */}
      {previewThreads.length > 0 && (
        <section className="py-24 bg-oops-surface">
          <div className="max-w-3xl mx-auto px-4 md:px-8">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-oops-muted">
              right now
            </span>
            <h2 className="font-serif font-medium not-italic text-4xl md:text-5xl tracking-tight text-oops-text mt-4">
              live from the feed.
            </h2>
            <div className="mt-8 space-y-4">
              {previewThreads.map((t) => (
                <ThreadCard key={t.id} thread={t} />
              ))}
            </div>
            <div className="mt-8">
              <Link
                href={"/feed" as never}
                className="text-oops-primary font-semibold hover:text-orange-700 transition-colors"
              >
                see all threads →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Section 6: Closing CTA ── */}
      <section className="py-24 text-center">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <h2 className="font-serif font-medium not-italic text-5xl tracking-tight text-oops-text">
            ready to add yours?
          </h2>
          <p className="text-oops-muted mt-4">
            free, no email verification for now, takes 30 seconds.
          </p>
          <div className="mt-8">
            {meLoaded && (
              me ? (
                <Link href={"/feed" as never}>
                  <Button size="lg" variant="primary">go to feed →</Button>
                </Link>
              ) : (
                <Link href={"/signup" as never}>
                  <Button size="lg" variant="primary">sign up</Button>
                </Link>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="max-w-3xl mx-auto px-4 md:px-8 border-t border-oops-border mt-0 pt-6 pb-12">
        <div className="flex flex-col gap-2 text-xs text-oops-muted">
          <span>claude-oops · open source · v0.2</span>
          <span>
            <a
              href="https://github.com/TanmayKallakuri/claude-oops"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-oops-text transition-colors underline underline-offset-2"
            >
              GitHub
            </a>
            {" · "}made by @tanmay
          </span>
        </div>
      </footer>
    </div>
  );
}
