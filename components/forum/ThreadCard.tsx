import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/ui/cn";

type Tone = "primary" | "accent" | "danger";
const CATEGORY_TONE: Record<string, Tone> = {
  bug: "danger",
  behavior: "accent",
  discussion: "primary",
};

export type ThreadSummary = {
  id: string;
  title: string;
  category: "bug" | "behavior" | "discussion";
  author: { username: string; display_name: string | null };
  score: number;
  comment_count: number;
  created_at: string;
};

export function ThreadCard({ thread }: { thread: ThreadSummary }) {
  return (
    <Link href={`/t/${thread.id}` as never} className="block group">
      <Card hoverable className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center min-w-[44px] py-1">
            <div
              className={cn(
                "text-lg font-bold leading-none",
                thread.score > 0 && "text-oops-primary",
                thread.score < 0 && "text-oops-danger",
                thread.score === 0 && "text-oops-muted",
              )}
            >
              {thread.score}
            </div>
            <div className="text-[10px] text-oops-muted font-semibold tracking-wide uppercase mt-1">
              score
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Pill tone={CATEGORY_TONE[thread.category] ?? "primary"}>{thread.category}</Pill>
              <span className="text-xs text-oops-muted">
                @{thread.author.username}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-oops-text group-hover:text-oops-primary transition-colors leading-snug">
              {thread.title}
            </h3>
            <div className="mt-2 flex items-center gap-4 text-xs text-oops-muted">
              <span>{thread.comment_count} {thread.comment_count === 1 ? "comment" : "comments"}</span>
              <span>·</span>
              <span>{relativeTime(thread.created_at)}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.floor((now - then) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
