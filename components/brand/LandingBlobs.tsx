import { cn } from "@/lib/ui/cn";

type Blob = {
  className: string;
  delay?: string;
  gradient: string;
  opacity: number;
};

const BLOBS: Blob[] = [
  {
    className: "top-[4%] -right-20 h-80 w-80",
    gradient: "radial-gradient(circle, #e89268 0%, #c96442 50%, transparent 80%)",
    opacity: 0.28,
  },
  {
    className: "top-[22%] -left-24 h-96 w-96",
    delay: "3s",
    gradient: "radial-gradient(circle, #c98a42 0%, #e89268 50%, transparent 80%)",
    opacity: 0.22,
  },
  {
    className: "top-[42%] -right-16 h-72 w-72",
    delay: "1.5s",
    gradient: "radial-gradient(circle, #e89268 0%, #c98a42 50%, transparent 80%)",
    opacity: 0.2,
  },
  {
    className: "top-[60%] -left-20 h-96 w-96",
    delay: "4.5s",
    gradient: "radial-gradient(circle, #c96442 0%, #e89268 50%, transparent 80%)",
    opacity: 0.18,
  },
  {
    className: "top-[78%] -right-24 h-80 w-80",
    delay: "2s",
    gradient: "radial-gradient(circle, #c98a42 0%, #c96442 50%, transparent 80%)",
    opacity: 0.18,
  },
  {
    className: "bottom-[2%] -left-16 h-72 w-72",
    delay: "0.5s",
    gradient: "radial-gradient(circle, #e89268 0%, #c96442 50%, transparent 80%)",
    opacity: 0.22,
  },
];

export function LandingBlobs({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden -z-10",
        className,
      )}
    >
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className={cn("absolute animate-blob", b.className)}
          style={{
            background: b.gradient,
            opacity: b.opacity,
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
}
