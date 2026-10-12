import { Plate } from "@/components/iso/react/draw";
import { PlanChestArt } from "./art";
import { openingOf } from "./geometry";
import { DRAWER_COUNT, SAMPLE_DRAWERS, restReadout, totalOf, type Drawer } from "./model";
import "@/components/iso/iso.css";
import "@/components/iso/skin.css";
import "./plan-chest.css";

export type PlanChestProps = {
  /** Exactly six drawers, top to bottom. Defaults to sample data. */
  drawers?: Drawer[];
  fig?: string;
  title?: string;
  /** The drawer that is out on first render; ignored inside a PlanChestProvider, which sets its own. */
  defaultOpen?: number | null;
  /** Caption under the card. Defaults to one built from `drawers`. */
  caption?: string;
};

function captionOf(drawers: Drawer[]) {
  const fewest = drawers.reduce((low, drawer) => (drawer.sheets < low.sheets ? drawer : low));
  const most = drawers.reduce((high, drawer) => (drawer.sheets > high.sheets ? drawer : high));
  return `A plan chest of ${drawers.length} drawers, ${drawers[0]!.title} at the top to ${drawers.at(-1)!.title} at the bottom. Each drawer holds one sheet per item: ${totalOf(drawers)} in all, from ${fewest.sheets} in ${fewest.title} to ${most.sheets} in ${most.title}.`;
}

/**
 * A steel plan chest whose six drawers stand for six groups of items, one sheet per item. Hover previews a drawer,
 * click or the arrow keys open it, and an idle tour runs until the reader picks one. Server component.
 */
export function PlanChest({ drawers = SAMPLE_DRAWERS, fig = "Fig 1", title = "Six phases", defaultOpen = 0, caption }: PlanChestProps) {
  if (drawers.length !== DRAWER_COUNT) throw new Error(`PlanChest needs exactly ${DRAWER_COUNT} drawers, got ${drawers.length}`);
  return (
    <div className="iso iso-skin">
      <Plate
        fig={fig}
        title={title}
        hint={
          <>
            <span className="pc-hint-fine">Hover a drawer, click to open</span>
            <span className="pc-hint-touch">Tap a drawer</span>
          </>
        }
        readout={restReadout(drawers)}
        keys={[
          { mark: "lit", label: "The drawer that is out" },
          { mark: "raised", label: "Its sheets, one per item" },
        ]}
        caption={caption ?? captionOf(drawers)}
      >
        <PlanChestArt openings={drawers.map((_, index) => openingOf(index))} drawers={drawers} defaultOpen={defaultOpen} />
      </Plate>
    </div>
  );
}
