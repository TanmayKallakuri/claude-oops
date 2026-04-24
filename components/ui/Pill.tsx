import { cn } from "@/lib/ui/cn";

type Tone = "neutral" | "primary" | "accent" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-oops-border text-oops-muted",
  primary: "bg-oops-primary-soft text-oops-primary",
  accent: "bg-amber-200 text-amber-900",
  danger: "bg-oops-danger-soft text-oops-danger",
};

export function Pill({
  tone = "neutral",
  active,
  className,
  children,
}: {
  tone?: Tone;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        TONE_CLASSES[tone],
        active && "ring-2 ring-oops-primary ring-offset-2 ring-offset-oops-bg",
        className,
      )}
    >
      {children}
    </span>
  );
}
