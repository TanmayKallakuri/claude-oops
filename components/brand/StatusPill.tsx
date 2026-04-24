"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/ui/cn";

type Indicator = "none" | "minor" | "major" | "critical" | "maintenance" | "unknown";

type Status = {
  indicator: Indicator;
  description: string;
  updated_at: string;
};

function label(i: Indicator): { text: string; dot: string; tone: string } {
  switch (i) {
    case "none":
      return { text: "all systems operational", dot: "bg-[#6b7a3d]", tone: "text-oops-text" };
    case "minor":
      return { text: "minor issues", dot: "bg-[#c98a42]", tone: "text-oops-text" };
    case "major":
      return { text: "major outage", dot: "bg-[#a53e2a]", tone: "text-oops-text" };
    case "critical":
      return { text: "critical outage", dot: "bg-[#a53e2a]", tone: "text-oops-text" };
    case "maintenance":
      return { text: "maintenance in progress", dot: "bg-[#8a847a]", tone: "text-oops-text" };
    default:
      return { text: "status unknown", dot: "bg-[#8a847a]", tone: "text-oops-muted" };
  }
}

export function StatusPill({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/anthropic-status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as Status;
        if (!cancelled) setStatus(body);
      } catch {
        // swallow — pill just stays on previous value
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const { text, dot, tone } = label(status?.indicator ?? "unknown");

  return (
    <a
      href="https://status.claude.com"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-oops-border bg-oops-surface px-3 py-1.5 text-xs font-medium hover:border-oops-ink/20 transition-colors",
        tone,
        className,
      )}
      title={status?.description ?? "Check Anthropic status"}
    >
      <span className={cn("relative flex h-2 w-2")}>
        {status?.indicator === "none" && (
          <span
            aria-hidden="true"
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6b7a3d] opacity-60"
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
      </span>
      <span>claude api: {text}</span>
      <span className="text-oops-muted">↗</span>
    </a>
  );
}
