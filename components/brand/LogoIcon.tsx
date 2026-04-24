"use client";

import { cn } from "@/lib/ui/cn";

export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-oops-primary text-white font-serif italic font-bold transition-transform hover:rotate-12 hover:scale-110",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden="true"
    >
      !
    </span>
  );
}
