"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/ui/cn";

type Vote = -1 | 0 | 1;

export function VoteButtons({
  score,
  current,
  onChange,
  size = "md",
  orientation = "horizontal",
}: {
  score: number;
  current: Vote;
  onChange: (next: Vote) => void;
  size?: "sm" | "md";
  orientation?: "horizontal" | "vertical";
}) {
  const hot = score > 10;

  function cast(next: Vote) {
    const final: Vote = current === next ? 0 : next;
    onChange(final);
  }

  const btnBase =
    "inline-flex items-center justify-center select-none transition-colors";
  const btnSize = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";
  const btnRounded = "rounded-lg";
  const up =
    current === 1
      ? "bg-oops-primary text-white"
      : "text-oops-muted hover:bg-oops-primary-soft hover:text-oops-primary";
  const down =
    current === -1
      ? "bg-oops-danger text-white"
      : "text-oops-muted hover:bg-oops-danger-soft hover:text-oops-danger";

  const scoreColor =
    score > 0 ? "text-oops-primary" : score < 0 ? "text-oops-danger" : "text-oops-muted";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 font-bold",
        orientation === "vertical" ? "flex-col" : "flex-row",
      )}
    >
      <motion.button
        type="button"
        aria-label="Upvote"
        onClick={() => cast(1)}
        whileTap={{ scale: 0.85 }}
        animate={{ scale: current === 1 ? [1, 1.25, 1] : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15, duration: 0.2 }}
        className={cn(btnBase, btnSize, btnRounded, up, hot && "animate-pulse-ring")}
      >
        ▲
      </motion.button>

      <span className={cn("px-1 font-bold", scoreColor, size === "sm" ? "text-xs" : "text-sm")}>
        {score}
      </span>

      <motion.button
        type="button"
        aria-label="Downvote"
        onClick={() => cast(-1)}
        whileTap={{ scale: 0.85 }}
        animate={{ scale: current === -1 ? [1, 1.25, 1] : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15, duration: 0.2 }}
        className={cn(btnBase, btnSize, btnRounded, down)}
      >
        ▼
      </motion.button>
    </div>
  );
}
