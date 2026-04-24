"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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

type Comment = {
  id: string;
  thread_id: string;
  parent_comment_id: string | null;
  body: string;
  deleted: boolean;
  author: { username: string; display_name: string | null } | null;
  score: number;
  current_user_vote: -1 | 0 | 1;
  created_at: string;
  updated_at: string;
};

function VoteButtons({
  target,
  score,
  current,
  onVote,
}: {
  target: { type: "thread" | "comment"; id: string };
  score: number;
  current: -1 | 0 | 1;
  onVote: (newScore: number, newVote: -1 | 0 | 1) => void;
}) {
  async function cast(value: -1 | 0 | 1) {
    const next = current === value ? 0 : value;
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: target.type, target_id: target.id, value: next }),
    });
    if (res.ok) {
      const body = (await res.json()) as { score: number; current_user_vote: -1 | 0 | 1 };
      onVote(body.score, body.current_user_vote);
    }
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <button
        onClick={() => cast(1)}
        className={`px-2 ${current === 1 ? "bg-green-700 text-white" : "border"}`}
      >
        ▲
      </button>
      <span>{score}</span>
      <button
        onClick={() => cast(-1)}
        className={`px-2 ${current === -1 ? "bg-red-700 text-white" : "border"}`}
      >
        ▼
      </button>
    </span>
  );
}

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const threadId = params.id;
  const [thread, setThread] = useState<Thread | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [me, setMe] = useState<{ id: string; username: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [composeBody, setComposeBody] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function loadAll() {
    const [tRes, cRes, meRes] = await Promise.all([
      fetch(`/api/threads/${threadId}`),
      fetch(`/api/threads/${threadId}/comments`),
      fetch(`/api/auth/me`),
    ]);
    if (!tRes.ok) {
      setErr(`Thread not found (${tRes.status})`);
      return;
    }
    const tBody = (await tRes.json()) as { thread: Thread };
    const cBody = (await cRes.json()) as { items: Comment[] };
    setThread(tBody.thread);
    setComments(cBody.items);
    if (meRes.ok) {
      const meBody = (await meRes.json()) as { profile: { id: string; username: string } };
      setMe({ id: meBody.profile.id, username: meBody.profile.username });
    } else {
      setMe(null);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  async function submitComment() {
    if (!composeBody.trim()) return;
    const res = await fetch(`/api/threads/${threadId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: composeBody,
        parent_comment_id: replyingTo ?? undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setErr(body.error?.message ?? "Comment failed");
      return;
    }
    setComposeBody("");
    setReplyingTo(null);
    await loadAll();
  }

  async function deleteThread() {
    if (!confirm("Delete this thread?")) return;
    const res = await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
    if (res.ok) router.push("/" as never);
    else setErr("Delete failed");
  }

  async function deleteComment(id: string) {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) await loadAll();
    else setErr("Delete failed");
  }

  if (err) return <main className="p-8 text-red-600">{err}</main>;
  if (!thread) return <main className="p-8">Loading…</main>;

  const topLevel = comments.filter((c) => c.parent_comment_id === null);
  const childrenOf = (parentId: string) => comments.filter((c) => c.parent_comment_id === parentId);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/" className="text-sm text-slate-600 hover:underline">← back to feed</Link>

      <h1 className="mt-3 text-3xl font-bold">{thread.title}</h1>
      <p className="mt-1 text-sm text-slate-600">
        [{thread.category}] by @{thread.author.username}
      </p>
      <div className="mt-3 whitespace-pre-wrap">{thread.body}</div>

      <div className="mt-3 flex items-center gap-3">
        <VoteButtons
          target={{ type: "thread", id: thread.id }}
          score={thread.score}
          current={thread.current_user_vote}
          onVote={(s, v) => setThread({ ...thread, score: s, current_user_vote: v })}
        />
        {me && thread.author.username === me.username && (
          <button onClick={deleteThread} className="text-sm text-red-600 hover:underline">
            delete thread
          </button>
        )}
      </div>

      <h2 className="mt-8 text-xl font-bold">
        Comments ({thread.comment_count})
      </h2>

      <ul className="mt-3 space-y-4">
        {topLevel.map((c) => (
          <li key={c.id}>
            <CommentItem
              comment={c}
              me={me}
              onReply={(id) => {
                setReplyingTo(id);
                setComposeBody("");
              }}
              onVoted={(id, s, v) =>
                setComments((prev) => prev.map((x) => (x.id === id ? { ...x, score: s, current_user_vote: v } : x)))
              }
              onDelete={deleteComment}
            />
            <ul className="ml-8 mt-3 space-y-3">
              {childrenOf(c.id).map((child) => (
                <li key={child.id}>
                  <CommentItem
                    comment={child}
                    me={me}
                    onReply={null}
                    onVoted={(id, s, v) =>
                      setComments((prev) =>
                        prev.map((x) => (x.id === id ? { ...x, score: s, current_user_vote: v } : x)),
                      )
                    }
                    onDelete={deleteComment}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-bold">
          {replyingTo ? "Reply to comment" : "New comment"}
        </h3>
        <textarea
          value={composeBody}
          onChange={(e) => setComposeBody(e.target.value)}
          placeholder={me ? "Write a comment…" : "Sign in to comment"}
          disabled={!me}
          rows={4}
          className="mt-2 w-full border p-2"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={submitComment}
            disabled={!me || !composeBody.trim()}
            className="bg-slate-900 px-3 py-1 text-white disabled:opacity-50"
          >
            Post
          </button>
          {replyingTo && (
            <button onClick={() => setReplyingTo(null)} className="border px-3 py-1">
              Cancel reply
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function CommentItem({
  comment,
  me,
  onReply,
  onVoted,
  onDelete,
}: {
  comment: Comment;
  me: { id: string; username: string } | null;
  onReply: ((id: string) => void) | null;
  onVoted: (id: string, score: number, vote: -1 | 0 | 1) => void;
  onDelete: (id: string) => void;
}) {
  if (comment.deleted) {
    return <p className="text-sm italic text-slate-500">[deleted]</p>;
  }
  return (
    <div>
      <p className="text-sm text-slate-600">
        @{comment.author?.username}
      </p>
      <div className="mt-1 whitespace-pre-wrap">{comment.body}</div>
      <div className="mt-2 flex items-center gap-3 text-sm">
        <VoteButtons
          target={{ type: "comment", id: comment.id }}
          score={comment.score}
          current={comment.current_user_vote}
          onVote={(s, v) => onVoted(comment.id, s, v)}
        />
        {me && onReply && (
          <button onClick={() => onReply(comment.id)} className="text-slate-600 hover:underline">
            reply
          </button>
        )}
        {me && comment.author && comment.author.username === me.username && (
          <button onClick={() => onDelete(comment.id)} className="text-red-600 hover:underline">
            delete
          </button>
        )}
      </div>
    </div>
  );
}
