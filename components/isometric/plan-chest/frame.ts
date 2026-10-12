import { pathOf, slabOf, type Plan, type SolidPaths } from "@/components/iso/iso-kit";
import { DRAWINGS, clipToArea, type Polyline } from "./sheets";
import { BOX_BACK, BOX_HALF, FLOOR_H, FLOOR_Z, P, SHEET, STACK_HALF, WALL, WALL_H, YF, at, slotZ } from "./view";

/*
 * A drawer's body (floor, walls, runners and its stack of sheets) at a given travel. The body is cut at the carcass
 * front plane: the part behind it is drawn clipped to the drawer's opening, the part in front of it is drawn free.
 * Its visible length changes as it moves, so it is rebuilt each frame; the front and pulls only translate.
 */

export const EMPTY: SolidPaths = { fill: "", outline: "", crease: "", top: "", shades: ["", "", "", ""] };

export type Body = {
  floor: SolidPaths;
  wallL: SolidPaths;
  back: SolidPaths;
  stack: SolidPaths;
  edges: string;
  sheet: string;
  title: string;
  drawing: string;
  marks: string;
  wallR: SolidPaths;
  runner: SolidPaths;
  slide: SolidPaths;
};

type Span = [number, number];

const overlap = ([a0, a1]: Span, [b0, b1]: Span): Span | null => {
  const from = Math.max(a0, b0);
  const to = Math.min(a1, b1);
  return to - from > 0.05 ? [from, to] : null;
};

const box = (x0: number, x1: number, span: Span | null, z: number, h: number, steps = 2): SolidPaths =>
  span ? slabOf({ x: x0, y: span[0], w: x1 - x0, d: span[1] - span[0], r: 0 } satisfies Plan, z, h, P, steps) : EMPTY;

/** Polylines given as [x, v] on a sheet whose front border is at y = `front`, cut to the y range `keep`, at height z. */
function sheetLines(lines: Polyline[], front: number, z: number, keep: Span | null) {
  if (!keep) return "";
  const band = { x0: -Infinity, x1: Infinity, v0: front - keep[1], v1: front - keep[0] };
  return lines
    .flatMap((line) => clipToArea(line, band))
    .map((line) => pathOf(line.map(([x, v]) => at([x, front - v, z]))))
    .join("");
}

const rect = (x0: number, v0: number, x1: number, v1: number): Polyline => [
  [x0, v0],
  [x1, v0],
  [x1, v1],
  [x0, v1],
  [x0, v0],
];

/** `sheets` is how many sheets to stack (already capped to what fits a drawer). */
export function bodyOf(index: number, travel: number, sheets: number): { inside: Body; outside: Body } {
  const z = slotZ(index);
  const floorZ = z + FLOOR_Z;
  const stackZ = floorZ + FLOOR_H;
  const top = stackZ + sheets * SHEET;
  const whole: Span = [BOX_BACK + travel, YF + travel];
  const stackSpan: Span = [whole[0] + WALL + 0.6, whole[1] - 0.6];

  /* The top sheet: a drawing border, a title block in the corner nearest the reader, and the phase's drawing. */
  const sx = STACK_HALF - 5;
  const front = stackSpan[1] - 5;
  const back = front - (stackSpan[1] - stackSpan[0] - 10);
  const border = [rect(-sx, 0, sx, front - back)];
  const title = [rect(sx - 46, 0, sx, 18), [[sx - 46, 9], [sx, 9]], [[sx - 18, 9], [sx - 18, 18]]] as Polyline[];
  const drawing = DRAWINGS[index]!;

  const part = (keep: Span, inside: boolean): Body => {
    const span = overlap(whole, keep);
    const stack = overlap(stackSpan, keep);
    const edges: string[] = [];
    if (stack) {
      for (let sheet = 1; sheet < sheets; sheet++) {
        const ez = stackZ + sheet * SHEET;
        edges.push(pathOf([at([STACK_HALF, stack[0], ez]), at([STACK_HALF, stack[1], ez])]));
      }
    }
    return {
      floor: box(-BOX_HALF, BOX_HALF, span, floorZ, FLOOR_H),
      wallL: box(-BOX_HALF, -BOX_HALF + WALL, span, floorZ, WALL_H),
      back: inside ? box(-BOX_HALF + WALL, BOX_HALF - WALL, overlap([whole[0], whole[0] + WALL], keep), floorZ, WALL_H) : EMPTY,
      stack: box(-STACK_HALF, STACK_HALF, stack, stackZ, sheets * SHEET, 2),
      edges: edges.join(""),
      sheet: sheetLines(border, front, top, stack),
      title: sheetLines(title, front, top, stack),
      drawing: sheetLines(drawing.lines, front, top, stack),
      marks: sheetLines(drawing.marks, front, top, stack),
      wallR: box(BOX_HALF - WALL, BOX_HALF, span, floorZ, WALL_H),
      runner: box(BOX_HALF, BOX_HALF + 1.2, span, z + 4, 2.5),
      /* The middle member of the telescopic slide comes out half as far as the drawer. */
      slide: inside ? EMPTY : box(BOX_HALF + 1.2, BOX_HALF + 2.6, overlap([YF - 40, YF + travel / 2], keep), z + 3.6, 3.3),
    };
  };

  return { inside: part([-Infinity, YF], true), outside: part([YF, Infinity], false) };
}
