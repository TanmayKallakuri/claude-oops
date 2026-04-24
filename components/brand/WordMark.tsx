import { cn } from "@/lib/ui/cn";

type Size = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

export function WordMark({ size = "md", className }: { size?: Size; className?: string }) {
  return (
    <span
      className={cn(
        "font-serif font-medium not-italic text-oops-text tracking-tight leading-none select-none",
        SIZE_CLASSES[size],
        className,
      )}
    >
      claude<span className="text-oops-primary">-</span>oops
    </span>
  );
}
