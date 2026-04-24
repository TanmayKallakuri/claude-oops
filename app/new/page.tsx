"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";

type Category = "bug" | "behavior" | "discussion";

const CATEGORIES: { value: Category; tone: "danger" | "accent" | "primary"; label: string }[] = [
  { value: "bug", tone: "danger", label: "bug" },
  { value: "behavior", tone: "accent", label: "behavior" },
  { value: "discussion", tone: "primary", label: "discussion" },
];

export default function NewThreadPage() {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("bug");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !submitting;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, category }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Submit failed");
      }
      const data = (await res.json()) as { thread: { id: string } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/t/${data.thread.id}` as any);
    } catch (err) {
      toast({ tone: "error", text: err instanceof Error ? err.message : "Submit failed" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-oops-bg px-4 pb-16 pt-12">
      {/* Header */}
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif font-medium not-italic text-5xl text-oops-text md:text-6xl tracking-tight">
          spill it<span className="text-oops-primary">.</span>
        </h1>
        <p className="mt-3 text-base text-oops-muted">
          title, category, body. we&apos;ll handle the rest.
        </p>
      </div>

      {/* Card */}
      <Card className="mx-auto mt-8 max-w-2xl p-6 md:p-8">
        <form onSubmit={onSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="give it a headline"
              className="w-full rounded-lg border-2 border-oops-border bg-transparent px-4 py-3 font-serif font-medium not-italic text-2xl text-oops-text placeholder:text-oops-muted/50 outline-none transition-colors duration-150 focus:border-oops-primary"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-oops-muted">
              category
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(({ value, tone, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-oops-primary focus-visible:ring-offset-2 focus-visible:ring-offset-oops-bg rounded-full transition-transform duration-100 active:scale-95"
                  aria-pressed={category === value}
                >
                  <Pill tone={tone} active={category === value}>
                    {label}
                  </Pill>
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="relative">
            <textarea
              required
              rows={10}
              maxLength={10000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="what happened? be specific."
              className="w-full rounded-xl border border-oops-border bg-transparent px-4 py-3 text-base text-oops-text placeholder:text-oops-muted/50 outline-none transition-colors duration-150 focus:border-oops-primary resize-none"
            />
            <span className="absolute bottom-3 right-4 text-xs text-oops-muted select-none">
              {body.length.toLocaleString()} / 10,000
            </span>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={submitting}
            disabled={!canSubmit}
          >
            {submitting ? "posting…" : "post it"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
