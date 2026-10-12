"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Optional shared state for the open drawer. Wrap the chest and any list that should stay in step with it in a
 * PlanChestProvider; without one, the chest keeps its own state.
 */
export type PlanChestState = { open: number | null; setOpen: (index: number | null) => void };

export const PlanChestContext = createContext<PlanChestState | null>(null);

export function PlanChestProvider({ children, defaultOpen = 0 }: { children: ReactNode; defaultOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <PlanChestContext.Provider value={value}>{children}</PlanChestContext.Provider>;
}

export function usePlanChest() {
  const state = useContext(PlanChestContext);
  if (!state) throw new Error("usePlanChest must be used inside a PlanChestProvider");
  return state;
}
