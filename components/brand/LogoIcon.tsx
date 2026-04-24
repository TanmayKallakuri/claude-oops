"use client";

import { cn } from "@/lib/ui/cn";

export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-oops-primary text-oops-bg font-serif font-medium not-italic",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden="true"
    >
      !
    </span>
  );
}
