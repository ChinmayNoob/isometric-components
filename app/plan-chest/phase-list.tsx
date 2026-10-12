"use client";

import type { Drawer } from "@/components/isometric/plan-chest/model";
import { usePlanChest } from "@/components/isometric/plan-chest/state";

/** A plain list linked to the chest through PlanChestProvider: choosing a row opens its drawer, and the reverse. */
export function PhaseList({ drawers }: { drawers: Drawer[] }) {
  const { open, setOpen } = usePlanChest();
  return (
    <ol className="border-t border-border">
      {drawers.map((drawer, index) => (
        <li key={drawer.n} className="border-b border-border">
          <button
            type="button"
            aria-pressed={open === index}
            onClick={() => setOpen(open === index ? null : index)}
            className="flex min-h-11 w-full items-center gap-4 py-3 text-left text-sm transition-colors hover:text-muted-foreground aria-pressed:font-semibold"
          >
            <span className="font-mono text-xs text-muted-foreground">{drawer.n}</span>
            <span className="flex-1">{drawer.title}</span>
            <span className="font-mono text-xs text-muted-foreground">{drawer.sheets} items</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
