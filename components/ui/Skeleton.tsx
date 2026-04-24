import { cn } from "@/lib/ui/cn";

export function Skeleton({
  className,
  height,
  width,
}: {
  className?: string;
  height?: number | string;
  width?: number | string;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: typeof width === "number" ? `${width}px` : width,
      }}
      className={cn("shimmer-bg animate-shimmer rounded-lg", className)}
    />
  );
}
