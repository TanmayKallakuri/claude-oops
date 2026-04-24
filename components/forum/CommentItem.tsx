"use client";

import { Avatar } from "@/components/ui/Avatar";
import { VoteButtons } from "@/components/ui/VoteButtons";

export type CommentNode = {
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

export function CommentItem({
  comment,
  me,
  onReply,
  onVoted,
  onDelete,
}: {
  comment: CommentNode;
  me: { id: string; username: string } | null;
  onReply: ((id: string) => void) | null;
  onVoted: (id: string, score: number, vote: -1 | 0 | 1) => void;
  onDelete: (id: string) => void;
}) {
  if (comment.deleted) {
    return (
      <div className="py-3 text-sm italic text-oops-muted">
        [deleted]
      </div>
    );
  }
  const isAuthor = me && comment.author && comment.author.username === me.username;
  return (
    <div className="py-3">
      <div className="flex items-start gap-3">
        <Avatar
          username={comment.author?.username ?? "anon"}
          displayName={comment.author?.display_name ?? null}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-oops-muted font-medium mb-1">
            @{comment.author?.username}
          </div>
          <div className="text-sm text-oops-text whitespace-pre-wrap leading-relaxed">
            {comment.body}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs">
            <VoteButtons
              size="sm"
              score={comment.score}
              current={comment.current_user_vote}
              onChange={async (next) => {
                const res = await fetch("/api/votes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    target_type: "comment",
                    target_id: comment.id,
                    value: next,
                  }),
                });
                if (res.ok) {
                  const body = (await res.json()) as { score: number; current_user_vote: -1 | 0 | 1 };
                  onVoted(comment.id, body.score, body.current_user_vote);
                }
              }}
            />
            {me && onReply && (
              <button
                onClick={() => onReply(comment.id)}
                className="text-oops-muted hover:text-oops-primary font-medium"
              >
                reply
              </button>
            )}
            {isAuthor && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-oops-danger hover:underline font-medium"
              >
                delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
