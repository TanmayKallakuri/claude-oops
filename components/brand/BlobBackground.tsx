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
        className="absolute -top-20 -right-16 h-72 w-72 animate-blob opacity-25"
        style={{
          background: "radial-gradient(circle, #e89268 0%, #c96442 50%, transparent 80%)",
        }}
      />
      <div
        className="absolute -bottom-24 -left-24 h-80 w-80 animate-blob opacity-20"
        style={{
          animationDelay: "2s",
          background: "radial-gradient(circle, #c98a42 0%, #e89268 50%, transparent 80%)",
        }}
      />
    </div>
  );
}
