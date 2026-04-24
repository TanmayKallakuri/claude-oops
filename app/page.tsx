"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BlobBackground } from "@/components/brand/BlobBackground";
import { ActivityTicker } from "@/components/brand/ActivityTicker";
import { ThreadCard, type ThreadSummary } from "@/components/forum/ThreadCard";
import { CategoryFilter } from "@/components/forum/CategoryFilter";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

type FeedResponse = { items: ThreadSummary[]; next_cursor: string | null };

type Category = "all" | "bug" | "behavior" | "discussion";

export default function HomePage() {
  const [category, setCategory] = useState<Category>("all");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [items, setItems] = useState<ThreadSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      params.set("sort", sort);
      if (!reset && cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/threads?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as FeedResponse;
      setItems((prev) => (reset ? body.items : [...prev, ...body.items]));
      setCursor(body.next_cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setItems([]);
    setCursor(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort]);

  const isFirstLoad = loading && items.length === 0;

  return (
    <div className="min-h-screen bg-oops-bg">
      {/* ── Hero ── */}
      <section className="relative bg-oops-bg min-h-[200px] md:min-h-[280px] flex items-center overflow-hidden">
        <BlobBackground />
        <div className="relative z-10 w-full max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
          <h1 className="font-serif font-medium not-italic text-5xl md:text-6xl text-oops-text tracking-tight leading-tight">
            oh no, what did Claude do{" "}
            <span className="text-oops-primary">this time?</span>
          </h1>
          <p className="mt-3 text-oops-muted text-base">
            the group chat for when the vibes go off
          </p>
          <ActivityTicker className="mt-4 max-w-md" />
        </div>
      </section>

      {/* ── Filter bar ── */}
      <div className="sticky top-14 z-20 bg-oops-bg/90 backdrop-blur-sm border-b border-oops-border">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <CategoryFilter
            value={category}
            onChange={(next) => setCategory(next as Category)}
          />
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={sort === "new" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSort("new")}
            >
              new
            </Button>
            <Button
              variant={sort === "top" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSort("top")}
            >
              top
            </Button>
          </div>
        </div>
      </div>

      {/* ── Feed ── */}
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-6">
        {error && (
          <p className="mb-4 text-sm text-oops-danger bg-oops-danger-soft rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Skeleton loaders on first load */}
        {isFirstLoad && (
          <div className="space-y-4">
            <Skeleton height={88} />
            <Skeleton height={88} />
            <Skeleton height={88} />
          </div>
        )}

        {/* Thread cards */}
        {!isFirstLoad && (
          <AnimatePresence mode="popLayout">
            {items.length > 0 ? (
              <div className="space-y-4">
                {items.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i < 8 ? i * 0.04 : 0 }}
                  >
                    <ThreadCard thread={t} />
                  </motion.div>
                ))}
              </div>
            ) : (
              !loading && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="py-20 text-center"
                >
                  <p className="text-oops-muted text-base italic">
                    nothing broken yet.{" "}
                    <a
                      href="/new"
                      className="text-oops-primary underline underline-offset-2 not-italic font-medium hover:text-orange-700 transition-colors"
                    >
                      be the first to log an oops →
                    </a>
                  </p>
                </motion.div>
              )
            )}
          </AnimatePresence>
        )}

        {/* Load more */}
        {cursor && !isFirstLoad && (
          <div className="mt-6">
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              loading={loading}
              onClick={() => load(false)}
            >
              {loading ? "loading…" : "load more"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
