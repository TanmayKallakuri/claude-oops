import { cn } from "@/lib/ui/cn";

export function BlobBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div
        className="absolute -top-20 -right-16 h-72 w-72 animate-blob opacity-60"
        style={{
          background: "radial-gradient(circle, #fed7aa 0%, #fbbf24 50%, transparent 80%)",
        }}
      />
      <div
        className="absolute -bottom-20 -left-20 h-80 w-80 animate-blob opacity-40"
        style={{
          animationDelay: "2s",
          background: "radial-gradient(circle, #fcd34d 0%, #fed7aa 50%, transparent 80%)",
        }}
      />
    </div>
  );
}
