"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/ui/cn";

type ComponentStatus =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance";

type Component = { id: string; name: string; status: ComponentStatus };

type StatusResponse = {
  components: Component[];
  updated_at: string;
};

function tone(status: string): { dot: string; label: string; bg: string; text: string } {
  switch (status) {
    case "operational":
      return {
        dot: "bg-[#6b7a3d]",
        label: "operational",
        bg: "bg-oops-surface",
        text: "text-oops-text",
      };
    case "degraded_performance":
      return {
        dot: "bg-[#c98a42]",
        label: "degraded",
        bg: "bg-[#f5efdd]",
        text: "text-oops-text",
      };
    case "partial_outage":
      return {
        dot: "bg-[#a53e2a]",
        label: "partial outage",
        bg: "bg-[#f2ddd6]",
        text: "text-oops-text",
      };
    case "major_outage":
      return {
        dot: "bg-[#a53e2a]",
        label: "major outage",
        bg: "bg-[#f2ddd6]",
        text: "text-oops-text",
      };
    case "under_maintenance":
      return {
        dot: "bg-[#8a847a]",
        label: "maintenance",
        bg: "bg-oops-surface",
        text: "text-oops-muted",
      };
    default:
      return {
        dot: "bg-[#8a847a]",
        label: status.replace(/_/g, " "),
        bg: "bg-oops-surface",
        text: "text-oops-muted",
      };
  }
}

function relTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function StatusSection({ className }: { className?: string }) {
  const [data, setData] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/anthropic-status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as StatusResponse;
        if (!cancelled) setData(body);
      } catch {
        // swallow
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const components = data?.components ?? [];

  return (
    <section className={cn("max-w-3xl mx-auto px-4 md:px-8 py-24", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-oops-muted">
        live, from Anthropic
      </span>
      <h2 className="mt-3 font-serif font-medium text-4xl md:text-5xl tracking-tight text-oops-text">
        oh first thing, is it <span className="text-oops-primary">even working?</span>
      </h2>
      <p className="mt-4 text-base text-oops-muted max-w-xl">
        Pulled directly from{" "}
        <a
          href="https://status.claude.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-oops-primary"
        >
          status.claude.com
        </a>
        . Updates every minute. {data?.updated_at && `Last refresh: ${relTime(data.updated_at)}.`}
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {components.length === 0 && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg border border-oops-border bg-oops-surface shimmer-bg animate-shimmer"
              />
            ))}
          </>
        )}
        {components.map((c) => {
          const t = tone(c.status);
          return (
            <div
              key={c.id}
              className={cn(
                "flex items-center justify-between gap-4 rounded-lg border border-oops-border px-5 py-4",
                t.bg,
                t.text,
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn("relative flex h-3 w-3 shrink-0")}>
                  {c.status === "operational" && (
                    <span
                      aria-hidden="true"
                      className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6b7a3d] opacity-50"
                    />
                  )}
                  <span className={cn("relative inline-flex h-3 w-3 rounded-full", t.dot)} />
                </span>
                <span className="font-medium text-base truncate">{c.name}</span>
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-oops-muted shrink-0">
                {t.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
