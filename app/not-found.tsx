import Link from "next/link";
import { WordMark } from "@/components/brand/WordMark";
import { BlobBackground } from "@/components/brand/BlobBackground";

export default function NotFound() {
  return (
    <main className="relative min-h-screen flex items-center justify-center px-6">
      <BlobBackground />
      <div className="relative z-10 text-center max-w-lg">
        <div className="inline-block -rotate-6 mb-6">
          <WordMark size="lg" />
        </div>
        <h1 className="font-serif italic text-5xl md:text-6xl text-oops-text tracking-tight leading-none">
          this oops doesn&apos;t exist
        </h1>
        <p className="mt-4 text-oops-muted">
          even we can&apos;t find what you&apos;re looking for.
        </p>
        <Link
          href={"/" as never}
          className="mt-8 inline-block text-oops-primary font-semibold hover:underline"
        >
          ← back to feed
        </Link>
      </div>
    </main>
  );
}
