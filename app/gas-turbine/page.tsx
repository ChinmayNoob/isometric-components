import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/demo/theme-toggle";
import { GasTurbine } from "@/components/isometric/gas-turbine";

export const metadata: Metadata = { title: "Gas turbine" };

export default function GasTurbinePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-10">
      <div className="mb-10 flex items-center justify-between gap-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          All components
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Gas turbine generator set</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        A heavy-duty single-shaft unit on its foundation. Hover to take it apart into its assemblies; start it and watch
        it run up to full load.
      </p>
      <div className="mt-10">
        <GasTurbine />
      </div>
    </main>
  );
}
