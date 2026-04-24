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
        "bg-oops-surface rounded-xl shadow-oops border border-oops-border",
        hoverable && "transition-all duration-200 hover:shadow-oops-lift hover:-translate-y-0.5",
        className,
      )}
      {...rest}
    />
  );
}
