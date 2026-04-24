"use client";

import { useEffect, useState } from "react";

type ThreadSummary = {
  id: string;
  title: string;
  category: "bug" | "behavior" | "discussion";
  author: { username: string; display_name: string | null };
  score: number;
  comment_count: number;
  created_at: string;
};

type FeedResponse = { items: ThreadSummary[]; next_cursor: string | null };

const CATEGORIES = ["all", "bug", "behavior", "discussion"] as const;
type Category = (typeof CATEGORIES)[number];

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

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Claude Oops</h1>
        <a href="/new" className="bg-slate-900 px-3 py-1 text-white">
          New thread
        </a>
      </div>

      <div className="mt-4 flex gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="border p-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSort("new")}
          className={`px-3 py-1 ${sort === "new" ? "bg-slate-900 text-white" : "border"}`}
        >
          New
        </button>
        <button
          onClick={() => setSort("top")}
          className={`px-3 py-1 ${sort === "top" ? "bg-slate-900 text-white" : "border"}`}
        >
          Top
        </button>
      </div>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      <ul className="mt-6 divide-y">
        {items.map((t) => (
          <li key={t.id} className="py-3">
            <a href={`/t/${t.id}`} className="text-xl font-medium hover:underline">
              {t.title}
            </a>
            <div className="mt-1 text-sm text-slate-600">
              <span className="mr-3">[{t.category}]</span>
              <span className="mr-3">@{t.author.username}</span>
              <span className="mr-3">score {t.score}</span>
              <span>{t.comment_count} comments</span>
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 && !loading && !error && <p className="mt-6 text-slate-500">No threads yet.</p>}

      {cursor && (
        <button
          onClick={() => load(false)}
          disabled={loading}
          className="mt-6 border px-3 py-1"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
