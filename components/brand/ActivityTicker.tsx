"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/ui/cn";

type Activity = { type: "vote" | "thread"; text: string; created_at: string };

export function ActivityTicker({ className }: { className?: string }) {
  const [items, setItems] = useState<Activity[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/activity", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { items: Activity[] };
        if (!cancelled) setItems(body.items);
      } catch {
        // ticker is decorative — swallow errors
      }
    }
    poll();
    const interval = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div
      className={cn(
        "relative overflow-hidden whitespace-nowrap text-xs text-oops-muted font-medium",
        className,
      )}
    >
      <div className="inline-flex animate-ticker gap-8 will-change-transform">
        {doubled.map((a, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            <span className="text-oops-primary">
              {a.type === "vote" ? "▲" : "●"}
            </span>
            {a.text}
          </span>
        ))}
      </div>
    </div>
  );
}
