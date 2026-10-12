/*
 * The plan chest's truth. Six drawers, top to bottom, each holding one sheet per item it stands for. Every count the
 * figure shows (readout, caption, stack height) comes from the `drawers` it is given.
 */

export type Drawer = {
  /** Short index shown in the readout, e.g. "01". */
  n: string;
  title: string;
  /** Sheets in the drawer: one per item. Stacks are drawn up to MAX_DRAWN sheets high. */
  sheets: number;
};

/** The chest is built for exactly six drawers: two stacked three-drawer units. */
export const DRAWER_COUNT = 6;

/** The tallest stack that fits a drawer; larger counts are still read out, but drawn at this height. */
export const MAX_DRAWN = 18;

/** Sample data: six service phases of an engineering firm and the number of scope items in each. */
export const SAMPLE_DRAWERS: Drawer[] = [
  { n: "01", title: "Pre-Planning", sheets: 10 },
  { n: "02", title: "Pre-Bid Estimation", sheets: 15 },
  { n: "03", title: "Tendering", sheets: 10 },
  { n: "04", title: "Design", sheets: 16 },
  { n: "05", title: "Construction", sheets: 12 },
  { n: "06", title: "Commissioning", sheets: 6 },
];

/** Drawer runners: a little under critical damping, so a drawer glides out and settles against its stop. */
export const RUNNER = { stiffness: 70, damping: 15 };

export const drawnSheets = (drawer: Drawer) => Math.max(1, Math.min(MAX_DRAWN, Math.round(drawer.sheets)));

export const totalOf = (drawers: Drawer[]) => drawers.reduce((sum, drawer) => sum + drawer.sheets, 0);

export const restReadout = (drawers: Drawer[]) => `${drawers.length} drawers · ${totalOf(drawers)} items`;

export function readoutOf(drawers: Drawer[], index: number | null, settled: boolean) {
  if (index === null) return restReadout(drawers);
  const drawer = drawers[index]!;
  return settled ? `${drawer.n} ${drawer.title} · ${drawer.sheets} items` : `${drawer.n} ${drawer.title}`;
}

export function valueTextOf(drawers: Drawer[], index: number | null) {
  if (index === null) return "All drawers closed";
  const drawer = drawers[index]!;
  return `Drawer ${drawer.n}, ${drawer.title}, ${drawer.sheets} items`;
}
