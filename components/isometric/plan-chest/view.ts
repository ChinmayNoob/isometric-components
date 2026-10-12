import { boxCorners, fitProjection, iso, type Plan, type Point3 } from "@/components/iso/iso-kit";

/*
 * World layout of the plan chest, in units of about 1 px: x across the chest, y from back to front, z up.
 * The drawer fronts face +y and slide out along +y. A steel plan chest ships as stacked units, so this one is a
 * plinth with two three-drawer units and a top on it, the same proportions as a real A0 chest (about 1350 × 900 × 750).
 */

export const WIDTH = 600;
export const HEIGHT = 470;
export const AZIMUTH = 60;
export const ELEVATION = 32;

/** The carcass front plane. Drawer fronts sit proud of it; everything behind it is seen only through an opening. */
export const YF = 80;
export const YB = -80;
export const HALF_W = 130;
export const SIDE = 6;

export const PLINTH: Plan = { x: -124, y: -74, w: 248, d: 148, r: 1 };
export const PLINTH_Z = -12;
export const FOOT_Z = -16;
export const FEET: [number, number][] = [
  [-112, -62],
  [112, -62],
  [-112, 62],
  [112, 62],
];

export const CARCASS: Plan = { x: -HALF_W, y: YB, w: HALF_W * 2, d: YF - YB, r: 1.2 };
export const LOW_TOP = 68;
export const HIGH_TOP = 144;
export const TOP: Plan = { x: -132, y: -82, w: 264, d: 166, r: 3 };
export const TOP_H = 6;

/** Drawer pitch: a 20-high front and a 2 shadow gap. */
export const PITCH = 22;
export const FRONT_H = 20;
export const FRONT_D = 2.4;
export const FRONT_HALF = 123.5;
export const OPENING_HALF = 121;

export const BOX_HALF = 120;
export const BOX_BACK = YF - 150;
export const WALL = 2;
export const WALL_H = 8;
export const FLOOR_Z = 1.2;
export const FLOOR_H = 1;
export const SHEET = 0.9;
export const STACK_HALF = 116.5;

/** How far a drawer comes out on its runners when fully open. */
export const TRAVEL = 92;

export const PULL_X = 78;
export const PULL_SPAN = 19;
export const PULL_Z = 10;

/** Bottom of drawer `index`'s front, counting drawers from the top (index 0 is phase 01). */
export function slotZ(index: number) {
  const low = index >= 3;
  return (low ? 0 : LOW_TOP) + 2 + (low ? 5 - index : 2 - index) * PITCH;
}

const pulledFront = (index: number): Point3[] =>
  boxCorners({ x: -FRONT_HALF, y: YF + TRAVEL, w: FRONT_HALF * 2, d: FRONT_D + 7, r: 0 }, slotZ(index), slotZ(index) + FRONT_H);

export const P = fitProjection(
  [
    ...boxCorners(TOP, HIGH_TOP, HIGH_TOP + TOP_H),
    ...boxCorners(CARCASS, FOOT_Z, 0),
    ...pulledFront(0),
    ...pulledFront(5),
  ],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION },
);

export const at = (point: Point3) => iso(point, P);
