"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { VoteButtons } from "@/components/ui/VoteButtons";
import { Skeleton } from "@/components/ui/Skeleton";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { CommentItem, type CommentNode } from "@/components/forum/CommentItem";
import { Composer } from "@/components/forum/Composer";
import { useToast } from "@/components/ui/Toast";

/* ── types ──────────────────────────────────────────────────── */

type Thread = {
  id: string;
  title: string;
  body: string;
  category: string;
  author: { username: string; display_name: string | null };
  score: number;
  comment_count: number;
  current_user_vote: -1 | 0 | 1;
  created_at: string;
  updated_at: string;
};

type Me = { id: string; username: string };

/* ── helpers ─────────────────────────────────────────────────── */

function categoryTone(cat: string): "danger" | "accent" | "primary" | "neutral" {
  if (cat === "bug") return "danger";
  if (cat === "behavior") return "accent";
  if (cat === "discussion") return "primary";
  return "neutral";
}

function maybeConfetti(value: -1 | 0 | 1) {
  if (value !== 1) return;
  if (sessionStorage.getItem("oops_first_vote")) return;
  confetti({
    particleCount: 50,
    spread: 70,
    colors: ["#c96442", "#e89268", "#c98a42"],
    origin: { y: 0.6 },
  });
  sessionStorage.setItem("oops_first_vote", "1");
}

/* ── page ────────────────────────────────────────────────────── */

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const threadId = params.id;

  const [thread, setThread] = useState<Thread | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  /* ── data loading ──────────────────────────────────────────── */

  async function loadAll() {
    const [tRes, cRes, meRes] = await Promise.all([
      fetch(`/api/threads/${threadId}`),
      fetch(`/api/threads/${threadId}/comments`),
      fetch(`/api/auth/me`),
    ]);
    if (!tRes.ok) {
      setLoadErr(`Thread not found (${tRes.status})`);
      return;
    }
    const tBody = (await tRes.json()) as { thread: Thread };
    const cBody = (await cRes.json()) as { items: CommentNode[] };
    setThread(tBody.thread);
    setComments(cBody.items);
    if (meRes.ok) {
      const meBody = (await meRes.json()) as { profile: Me };
      setMe({ id: meBody.profile.id, username: meBody.profile.username });
    } else {
      setMe(null);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  /* ── mutations ─────────────────────────────────────────────── */

  async function submitComment(body: string) {
    const res = await fetch(`/api/threads/${threadId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        parent_comment_id: replyingTo ?? undefined,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json();
      toast({ tone: "error", text: errBody.error?.message ?? "failed" });
      return;
    }
    toast({ tone: "success", text: "posted" });
    setReplyingTo(null);
    await loadAll();
  }

  async function deleteThread() {
    if (!confirm("Delete this thread?")) return;
    const res = await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ tone: "success", text: "thread deleted" });
      router.push("/" as never);
    } else {
      toast({ tone: "error", text: "failed" });
    }
  }

  async function deleteComment(id: string) {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ tone: "success", text: "comment deleted" });
      await loadAll();
    } else {
      toast({ tone: "error", text: "failed" });
    }
  }

  /* ── error / loading states ────────────────────────────────── */

  if (loadErr) {
    return (
      <main className="p-8 text-oops-danger text-sm">{loadErr}</main>
    );
  }

  if (!thread) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4">
        <Skeleton height={200} className="w-full max-w-3xl" />
      </main>
    );
  }

  /* ── comment tree ──────────────────────────────────────────── */

  const topLevel = comments.filter((c) => c.parent_comment_id === null);
  const childrenOf = (parentId: string) =>
    comments.filter((c) => c.parent_comment_id === parentId);

  const replyParent = replyingTo
    ? comments.find((c) => c.id === replyingTo)
    : null;

  const isAuthor = me && thread.author.username === me.username;

  /* ── render ────────────────────────────────────────────────── */

  return (
    <motion.main
      className="max-w-3xl mx-auto px-4 md:px-8 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* back link */}
      <Link
        href="/"
        className="text-sm text-oops-muted hover:text-oops-primary transition-colors"
      >
        ← back to feed
      </Link>

      {/* thread head */}
      <Card className="p-6 md:p-8 mt-4">
        {/* row 1: pill + author */}
        <div className="flex items-center gap-3 flex-wrap">
          <Pill tone={categoryTone(thread.category)}>{thread.category}</Pill>
          <span className="text-sm text-oops-muted">@{thread.author.username}</span>
        </div>

        {/* row 2: title */}
        <h1 className="font-serif font-medium not-italic text-4xl md:text-5xl text-oops-text mt-3 tracking-tight leading-tight">
          {thread.title}
        </h1>

        {/* row 3: body */}
        <p className="text-base text-oops-text whitespace-pre-wrap mt-4 leading-relaxed">
          {thread.body}
        </p>

        {/* row 4: votes + meta + author actions */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-oops-border flex-wrap">
          <VoteButtons
            score={thread.score}
            current={thread.current_user_vote}
            onChange={async (next) => {
              const res = await fetch("/api/votes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  target_type: "thread",
                  target_id: thread.id,
                  value: next,
                }),
              });
              if (res.ok) {
                const body = (await res.json()) as {
                  score: number;
                  current_user_vote: -1 | 0 | 1;
                };
                setThread({
                  ...thread,
                  score: body.score,
                  current_user_vote: body.current_user_vote,
                });
                maybeConfetti(body.current_user_vote);
              } else {
                const errBody = await res.json();
                toast({ tone: "error", text: errBody.error?.message ?? "failed" });
              }
            }}
          />

          <span className="text-sm text-oops-muted">
            {thread.comment_count}{" "}
            {thread.comment_count === 1 ? "comment" : "comments"}
          </span>

          {isAuthor && (
            <div className="ml-auto">
              <Dropdown
                trigger={
                  <span className="text-sm text-oops-muted hover:text-oops-primary transition-colors px-2 py-1 rounded-lg hover:bg-oops-primary-soft/30">
                    •••
                  </span>
                }
                align="right"
              >
                <DropdownItem onClick={() => {}}>Edit</DropdownItem>
                <DropdownItem variant="danger" onClick={deleteThread}>
                  Delete
                </DropdownItem>
              </Dropdown>
            </div>
          )}
        </div>
      </Card>

      {/* comments heading */}
      <h2 className="font-serif font-medium not-italic text-2xl md:text-3xl text-oops-text mt-10 mb-4">
        Comments ({thread.comment_count})
      </h2>

      {/* comment tree */}
      {topLevel.length === 0 ? (
        <p className="text-sm text-oops-muted italic">
          no comments yet. be the first →
        </p>
      ) : (
        <ul className="space-y-1">
          {topLevel.map((c) => (
            <li key={c.id}>
              <CommentItem
                comment={c}
                me={me}
                onReply={(id) => {
                  setReplyingTo(id);
                }}
                onVoted={(id, score, vote) =>
                  setComments((prev) =>
                    prev.map((x) =>
                      x.id === id ? { ...x, score, current_user_vote: vote } : x,
                    ),
                  )
                }
                onDelete={deleteComment}
              />

              {/* replies */}
              {childrenOf(c.id).length > 0 && (
                <ul className="ml-8 pl-4 border-l-2 border-oops-border space-y-1 mt-1">
                  {childrenOf(c.id).map((child) => (
                    <li key={child.id}>
                      <CommentItem
                        comment={child}
                        me={me}
                        onReply={null}
                        onVoted={(id, score, vote) =>
                          setComments((prev) =>
                            prev.map((x) =>
                              x.id === id
                                ? { ...x, score, current_user_vote: vote }
                                : x,
                            ),
                          )
                        }
                        onDelete={deleteComment}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* composer */}
      <div className="mt-8 pt-6 border-t border-oops-border">
        {replyingTo && replyParent && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-oops-muted">
              replying to @{replyParent.author?.username ?? "unknown"}
            </span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-xs text-oops-muted hover:text-oops-primary transition-colors underline"
            >
              cancel
            </button>
          </div>
        )}

        <Composer
          onSubmit={submitComment}
          placeholder="write a comment…"
          submitLabel={replyingTo ? "post reply" : "post comment"}
          disabled={!me}
          disabledHint="sign in to comment"
          onCancel={replyingTo ? () => setReplyingTo(null) : undefined}
        />
      </div>
    </motion.main>
  );
}
