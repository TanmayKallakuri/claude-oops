import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/forum/Nav";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "claude-oops — where Claude goofs, we log it",
  description: "A community log of Claude errors, regressions, and unexpected behavior.",
  openGraph: {
    title: "claude-oops",
    description: "oh no, what did Claude do this time?",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-oops-bg text-oops-text antialiased">
        <ToastProvider>
          <Nav />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
