import { pathOf, type Point3 } from "@/components/iso/iso-kit";
import { hookX, type Crane } from "./model";
import { BLOCK_TOP, FRAME_Z, ROPES, ROPE_TOP, at } from "./view";

/*
 * The four rope falls, from the underside of the drum to the hook block, rebuilt each frame because they lean with
 * the swing and change length with the hoist. They are cut at the trolley frame: the part above is drawn with the
 * trolley (in its own x), the part below between the bridge girders.
 */

export function ropesOf(crane: Crane) {
  const hx = hookX(crane);
  const bottom = crane.hz + BLOCK_TOP;
  const cut = (ROPE_TOP - FRAME_Z) / (ROPE_TOP - bottom);
  const upper: string[] = [];
  const lower: string[] = [];
  for (const offset of ROPES) {
    const top: Point3 = [crane.tx + offset, 0, ROPE_TOP];
    const end: Point3 = [hx + offset, 0, bottom];
    const mid: Point3 = [top[0] + (end[0] - top[0]) * cut, 0, FRAME_Z];
    upper.push(pathOf([at([offset, 0, ROPE_TOP]), at([mid[0] - crane.tx, 0, FRAME_Z])]));
    lower.push(pathOf([at(mid), at(end)]));
  }
  return { upper: upper.join(""), lower: lower.join("") };
}
