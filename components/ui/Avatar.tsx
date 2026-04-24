import { colorFor, initialsFor } from "@/lib/ui/initials";
import { cn } from "@/lib/ui/cn";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
};

export function Avatar({
  username,
  displayName,
  size = "md",
  className,
}: {
  username: string;
  displayName?: string | null;
  size?: Size;
  className?: string;
}) {
  const { bg, text } = colorFor(username);
  const initials = initialsFor(displayName ?? null, username);

  return (
    <span
      aria-hidden="true"
      style={{ background: bg, color: text }}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold select-none",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
