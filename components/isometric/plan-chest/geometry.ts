import {
  circleRing,
  corners,
  depthOf,
  extrude,
  haloOf,
  insetPlan,
  onTop,
  pathOf,
  planOutline,
  roundedPlan,
  sideRing,
  slabOf,
  type Flat,
  type Plan,
  type Point3,
} from "@/components/iso/iso-kit";
import {
  CARCASS,
  FEET,
  FOOT_Z,
  FRONT_D,
  FRONT_H,
  FRONT_HALF,
  HALF_W,
  HIGH_TOP,
  LOW_TOP,
  OPENING_HALF,
  P,
  PLINTH,
  PLINTH_Z,
  PULL_SPAN,
  PULL_X,
  PULL_Z,
  TOP,
  TOP_H,
  YF,
  at,
  slotZ,
} from "./view";

/* Every static path of the chest, computed once. Moving drawer bodies are in frame.ts. */

const join = (paths: string[]) => paths.filter(Boolean).join("");
const poly = (points: Point3[], closed = false) => pathOf(points.map(at), closed);
const cylinder = (cx: number, cy: number, r: number, z: number, h: number, steps = 28) => extrude(circleRing(cx, cy, r, steps), z, h, P);

/** A rounded rectangle drawn on the vertical face x = `x`, given in (y, z). */
const outlineOnX = (x: number, y: number, z: number, d: number, h: number, r: number) =>
  poly(roundedPlan({ x: y, y: z, w: d, d: h, r }, 4).map(([py, pz]) => [x, py, pz] as Point3), true);

/** A rounded rectangle drawn on the vertical face y = `y`, given in (x, z). */
const outlineOnY = (y: number, x: number, z: number, w: number, h: number, r: number) =>
  poly(roundedPlan({ x, y: z, w, d: h, r }, 4).map(([px, pz]) => [px, y, pz] as Point3), true);

/* ---------- Plinth and feet ---------- */

const byDepth = (points: [number, number][]) => [...points].sort((a, b) => depthOf([a[0], a[1], 0], P) - depthOf([b[0], b[1], 0], P));

export const FEET_ART = byDepth(FEET).map(([x, y]) => ({
  pad: cylinder(x, y, 6, FOOT_Z, 1.4, 32),
  nut: extrude(circleRing(x, y, 3.6, 6), FOOT_Z + 1.4, 1.6, P),
  stem: cylinder(x, y, 1.8, FOOT_Z + 3, PLINTH_Z - FOOT_Z - 3, 16),
}));

const PLINTH_FRONT = PLINTH.y + PLINTH.d;
const VENTS = [-86, 54].map((x) => outlineOnY(PLINTH_FRONT, x, PLINTH_Z + 4.5, 32, 3, 1.5));

export const PLINTH_ART = {
  halo: haloOf(insetPlan(CARCASS, -4), FOOT_Z, 4, P),
  slab: slabOf(PLINTH, PLINTH_Z, -PLINTH_Z, P, 3),
  vents: join(VENTS),
};

/* ---------- Carcass: two stacked three-drawer units ---------- */

const unit = (z0: number, z1: number) => slabOf(CARCASS, z0, z1 - z0, P, 3);

/** The +x side panel of a unit: an inset pressed panel with four fixing screws outside it. */
function sidePanel(z0: number, z1: number) {
  const x = HALF_W;
  const y0 = CARCASS.y + 9;
  const y1 = YF - 9;
  const screws: Flat[] = [];
  for (const y of [CARCASS.y + 4.5, YF - 4.5]) for (const z of [z0 + 4.5, z1 - 4.5]) screws.push(at([x, y, z]));
  return { panel: outlineOnX(x, y0, z0 + 9, y1 - y0, z1 - z0 - 18, 3), screws };
}

/** The opening of drawer `index` in the carcass front, as a screen polygon. Everything behind the front plane is clipped to it. */
export const openingOf = (index: number) => {
  const z = slotZ(index);
  return poly(
    [
      [-OPENING_HALF, YF, z + 1],
      [OPENING_HALF, YF, z + 1],
      [OPENING_HALF, YF, z + FRONT_H - 1],
      [-OPENING_HALF, YF, z + FRONT_H - 1],
    ],
    true,
  );
};

const LOCK: Point3 = [100, YF, HIGH_TOP - 5];
const MAKER: Plan = { x: -20, y: YF, w: 40, d: 0.6, r: 0.4 };
const MAKER_Z = HIGH_TOP - 8;

export const CARCASS_ART = {
  units: [
    { body: unit(0, LOW_TOP), side: sidePanel(0, LOW_TOP) },
    { body: unit(LOW_TOP, HIGH_TOP), side: sidePanel(LOW_TOP, HIGH_TOP) },
  ],
  openings: [0, 1, 2, 3, 4, 5].map(openingOf),
  lock: {
    bezel: sideRing(LOCK, 2.9, "y", P, 28),
    barrel: sideRing([LOCK[0], LOCK[1] + 0.01, LOCK[2]], 1.9, "y", P, 24),
    keyway: poly([
      [LOCK[0], YF, LOCK[2] - 1.1],
      [LOCK[0], YF, LOCK[2] + 1.1],
    ]),
  },
  maker: {
    plate: slabOf(MAKER, MAKER_Z, 6, P, 3),
    rule: join(
      [4.4, 3, 1.6].map((dz, row) =>
        poly([
          [MAKER.x + 6, YF + 0.6, MAKER_Z + dz],
          [MAKER.x + (row === 1 ? 26 : 32), YF + 0.6, MAKER_Z + dz],
        ]),
      ),
    ),
    screws: [at([MAKER.x + 2.6, YF + 0.6, MAKER_Z + 3]), at([MAKER.x + MAKER.w - 2.6, YF + 0.6, MAKER_Z + 3])],
  },
};

/* ---------- Top ---------- */

const INLAY = insetPlan(TOP, 9);

const INLAY_TOP = HIGH_TOP + TOP_H + 0.4;

/** A frame on the top, turned by `degrees`: local (u, v) to world (x, y). */
const turned = (cx: number, cy: number, degrees: number) => {
  const a = (degrees * Math.PI) / 180;
  return (u: number, v: number): [number, number] => [cx + u * Math.cos(a) - v * Math.sin(a), cy + u * Math.sin(a) + v * Math.cos(a)];
};
const turnedRect = (to: (u: number, v: number) => [number, number], u0: number, v0: number, u1: number, v1: number) =>
  [to(u0, v0), to(u1, v0), to(u1, v1), to(u0, v1)];

/* A drawing left out on the top, and a steel rule lying across it. */
const LOOSE = turned(-34, -8, -6);
const LOOSE_Z = INLAY_TOP + 0.3;
const looseLines = (lines: [number, number][][]) => join(lines.map((line) => poly(line.map(([u, v]) => [...LOOSE(u, v), LOOSE_Z] as Point3))));
const box2 = (u0: number, v0: number, u1: number, v1: number): [number, number][] => [
  [u0, v0],
  [u1, v0],
  [u1, v1],
  [u0, v1],
  [u0, v0],
];

const RULE = turned(30, 14, 14);
const RULE_Z = LOOSE_Z + 0.6;
const RULE_HALF = 80;

function ruleTicks() {
  const minor: string[] = [];
  const major: string[] = [];
  for (let u = -RULE_HALF + 4, count = 0; u <= RULE_HALF - 8; u += 4, count++) {
    const big = count % 5 === 0;
    (big ? major : minor).push(poly([[...RULE(u, 3.5), RULE_Z] as Point3, [...RULE(u, 3.5 - (big ? 3 : 1.6)), RULE_Z] as Point3]));
  }
  return { minor: join(minor), major: join(major) };
}

export const TOP_ART = {
  slab: slabOf(TOP, HIGH_TOP, TOP_H, P, 4, 1.2),
  inlay: slabOf(INLAY, HIGH_TOP + TOP_H, 0.4, P, 4),
  inlayLine: planOutline(insetPlan(INLAY, 2.5), INLAY_TOP, P, 4),
  screws: corners(TOP, 4.5).map(([x, y]) => at([x, y, HIGH_TOP + TOP_H])),
  loose: extrude(turnedRect(LOOSE, -80, -52, 80, 52), INLAY_TOP, 0.3, P),
  looseBorder: looseLines([box2(-75, -47, 75, 47)]),
  looseTitle: looseLines([box2(29, 29, 75, 47), [[29, 38], [75, 38]], [[57, 29], [57, 38]]]),
  rule: extrude(turnedRect(RULE, -RULE_HALF, -3.5, RULE_HALF, 3.5), LOOSE_Z, 0.6, P),
  ruleTicks: ruleTicks(),
  ruleHole: onTop(circleRing(...RULE(RULE_HALF - 4, 0), 1.3, 20), RULE_Z, P, true),
};

/* ---------- Drawer fronts (built closed, moved with translateAlong) ---------- */

const FACE = YF + FRONT_D;

export function frontOf(index: number) {
  const z = slotZ(index);
  const c = z + PULL_Z;
  const holder: Plan = { x: -17, y: FACE, w: 34, d: 0.7, r: 0.5 };
  const holderFace = FACE + 0.7;
  return {
    panel: slabOf({ x: -FRONT_HALF, y: YF, w: FRONT_HALF * 2, d: FRONT_D, r: 0.6 }, z, FRONT_H, P, 3, 0.5),
    holder: slabOf(holder, z + 5, 10, P, 3),
    window: poly(
      [
        [-13, holderFace, z + 6.6],
        [13, holderFace, z + 6.6],
        [13, holderFace, z + 13.4],
        [-13, holderFace, z + 13.4],
      ],
      true,
    ),
    card: join(
      [12, 10, 8].map((dz, row) =>
        poly([
          [-10, holderFace, z + dz],
          [row === 1 ? 3 : 8, holderFace, z + dz],
        ]),
      ),
    ),
    rivets: [at([-15, holderFace, z + 10]), at([15, holderFace, z + 10])],
    /* Two bar pulls: posts first, then the bar that sits on their faces. */
    posts: [-1, 1].flatMap((side) =>
      [-PULL_SPAN, PULL_SPAN].map((dx) => slabOf({ x: side * PULL_X + dx - 1.5, y: FACE, w: 3, d: 4.4, r: 0.6 }, c - 1.5, 3, P, 2)),
    ),
    bars: [-1, 1].map((side) =>
      slabOf({ x: side * PULL_X - PULL_SPAN - 4, y: FACE + 4.4, w: (PULL_SPAN + 4) * 2, d: 2.4, r: 1.1 }, c - 1.3, 2.6, P, 3, 0.4),
    ),
  };
}

export const FRONTS = [0, 1, 2, 3, 4, 5].map(frontOf);
