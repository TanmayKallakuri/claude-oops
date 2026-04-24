"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewThreadPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          body: form.get("body"),
          category: form.get("category"),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? "Submit failed");
      }
      const body = (await res.json()) as { thread: { id: string } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/t/${body.thread.id}` as any);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">New thread</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          name="title"
          type="text"
          required
          placeholder="Title (3–200 chars)"
          className="w-full border p-2"
          maxLength={200}
        />
        <select name="category" required className="w-full border p-2" defaultValue="bug">
          <option value="bug">bug</option>
          <option value="behavior">behavior</option>
          <option value="discussion">discussion</option>
        </select>
        <textarea
          name="body"
          required
          placeholder="Body (1–10000 chars, plain text)"
          rows={10}
          maxLength={10000}
          className="w-full border p-2"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-900 p-2 text-white disabled:opacity-50"
        >
          {submitting ? "Posting…" : "Post thread"}
        </button>
      </form>
      {err && <p className="mt-3 text-red-600">{err}</p>}
    </main>
  );
}
