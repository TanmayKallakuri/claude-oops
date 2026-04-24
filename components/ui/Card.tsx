import { type HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export function Card({
  hoverable,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }) {
  return (
    <div
      className={cn(
        "bg-oops-surface rounded-lg border border-oops-border",
        hoverable && "transition-colors duration-150 hover:border-oops-ink/20",
        className,
      )}
      {...rest}
    />
  );
}
