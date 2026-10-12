import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/demo/theme-toggle";
import { OverheadCrane } from "@/components/isometric/overhead-crane";

export const metadata: Metadata = { title: "Overhead crane" };

export default function OverheadCranePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 md:px-10">
      <div className="mb-10 flex items-center justify-between gap-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          All components
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Overhead crane</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        A foundry bay crane drawn to scale from its span. Drag the hook to drive it, or let the tour carry the ladle
        between the stands.
      </p>
      <div className="mt-10">
        <OverheadCrane span={22.5} />
      </div>
    </main>
  );
}
