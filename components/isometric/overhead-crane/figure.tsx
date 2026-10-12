import { Plate } from "@/components/iso/react/draw";
import { OverheadCraneArt } from "./art";
import { initialCrane, readoutOf } from "./model";
import "@/components/iso/iso.css";
import "@/components/iso/skin.css";
import "./crane.css";

export type OverheadCraneProps = {
  /** Distance between the runway rail centres, in metres. The drawing is to scale from it. */
  span?: number;
  fig?: string;
  title?: string;
  caption?: string;
};

/**
 * An overhead travelling crane in a foundry bay, drawn to scale from its span. Drag the hook, or tap for the next
 * lift; an idle tour carries the ladle between two stands. The load swings as a damped pendulum on its ropes.
 * Server component.
 */
export function OverheadCrane({ span = 22.5, fig = "Fig 2", title = "Foundry crane", caption }: OverheadCraneProps) {
  return (
    <div className="iso iso-skin">
      <Plate
        fig={fig}
        title={title}
        hint={
          <>
            <span className="cr-hint-fine">Drag the hook · click for the next lift</span>
            <span className="cr-hint-touch">Drag the trolley · tap for the next lift</span>
          </>
        }
        readout={readoutOf(initialCrane(), span)}
        keys={[
          { mark: "lit", label: "Molten metal in the ladle" },
          { mark: "raised", label: "Trolley, hook block and ladle, the parts that move" },
        ]}
        caption={
          caption ??
          `A double-girder overhead crane spanning a ${span} m bay, drawn to that scale. The trolley carries a ladle from the furnace stand to the pouring stand; the hook takes the bail when lifted through it and lets go once the ladle sits on a stand. The load swings as a pendulum on its ropes, damped as by anti-sway control.`
        }
      >
        <OverheadCraneArt span={span} />
      </Plate>
    </div>
  );
}
