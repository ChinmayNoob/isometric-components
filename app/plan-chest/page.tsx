import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/demo/theme-toggle";
import { PlanChest, PlanChestProvider, SAMPLE_DRAWERS } from "@/components/isometric/plan-chest";
import { PhaseList } from "./phase-list";

export const metadata: Metadata = { title: "Plan chest" };

export default function PlanChestPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-10">
      <div className="mb-10 flex items-center justify-between gap-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          All components
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Plan chest</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Six drawers, one sheet per item. The list and the chest share one PlanChestProvider, so either one opens a
        drawer.
      </p>
      <PlanChestProvider defaultOpen={0}>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <PhaseList drawers={SAMPLE_DRAWERS} />
          <PlanChest drawers={SAMPLE_DRAWERS} />
        </div>
      </PlanChestProvider>
    </main>
  );
}
