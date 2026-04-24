"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function Composer({
  onSubmit,
  placeholder,
  submitLabel = "Post",
  disabled,
  disabledHint,
  maxLength = 5000,
  onCancel,
  initialBody = "",
}: {
  onSubmit: (body: string) => Promise<void>;
  placeholder: string;
  submitLabel?: string;
  disabled?: boolean;
  disabledHint?: string;
  maxLength?: number;
  onCancel?: () => void;
  initialBody?: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(body);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={disabled ? (disabledHint ?? placeholder) : placeholder}
        disabled={disabled || submitting}
        rows={4}
        maxLength={maxLength}
        className="w-full rounded-xl border border-oops-border bg-oops-surface px-4 py-3 text-sm text-oops-text placeholder:text-oops-muted focus:outline-none focus:ring-2 focus:ring-oops-primary/40 disabled:opacity-60 resize-y"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-oops-muted">
          {body.length} / {maxLength}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={submit}
            loading={submitting}
            disabled={disabled || !body.trim()}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
