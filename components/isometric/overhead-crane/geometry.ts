import {
  circleRing,
  corners,
  depthOf,
  extrude,
  fadedSvg,
  haloOf,
  knurl,
  pathOf,
  ring,
  sideArc,
  sideRing,
  sideSeam,
  slabOf,
  type Plan,
  type Point3,
  type SolidPaths,
} from "@/components/iso/iso-kit";
import * as G from "@/components/iso/lathe.mjs";
import { tubePieces, tubeSvg } from "@/components/iso/tube.mjs";
import {
  BAIL_Y,
  BLOCK_TOP,
  COLUMN,
  COLUMN_TOP,
  COLUMN_Y,
  DRUM_R,
  DRUM_Z,
  FLOOR,
  FLOOR_H,
  FRAME_TOP,
  FRAME_Z,
  FURNACE,
  GIRDER_END,
  GIRDER_TOP,
  GIRDER_W,
  GIRDER_Y,
  GIRDER_Z,
  LADLE_TOP,
  MOULD_Y,
  P,
  RAIL_TOP,
  RAIL_X,
  ROPES,
  RUNWAY_Y0,
  RUNWAY_Y1,
  RUNWAY_TOP,
  RUNWAY_W,
  STANDS,
  STAND_TOP,
  TROLLEY_RAIL_TOP,
  TRUCK_HALF,
  TRUCK_TOP,
  TRUCK_W,
  at,
} from "./view";

/* Every static path of the bay, computed once on the server. Moving parts are built at rest and translated. */

type Lines = string;
const join = (paths: string[]) => paths.filter(Boolean).join("");
const poly = (points: Point3[], closed = false) => pathOf(points.map(at), closed);
const seg = (a: Point3, b: Point3) => poly([a, b]);
const slab = (plan: Plan, z: number, h: number, steps = 2, bevel = 0) => slabOf(plan, z, h, P, steps, bevel);
const box = (x0: number, y0: number, x1: number, y1: number, z: number, h: number, steps = 2, bevel = 0) =>
  slab({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: Math.min(0.6, (x1 - x0) / 4, (y1 - y0) / 4) }, z, h, steps, bevel);
const cyl = (cx: number, cy: number, r: number, z: number, h: number, steps = 28) => extrude(circleRing(cx, cy, r, steps), z, h, P);
const depth = (x: number, y: number, z = 0) => depthOf([x, y, z], P);
const byDepth = <T extends { at: [number, number] }>(list: T[]) => [...list].sort((a, b) => depth(...a.at) - depth(...b.at));

/** Frames for turned parts: along x, along y, and up. */
const alongX = (o: Point3) => G.frameOf(o, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const alongY = (o: Point3) => G.frameOf(o, [0, 1, 0], [0, 0, 1], [1, 0, 0]);
const upright = (o: Point3) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);

const lathe = (paths: unknown) => paths as SolidPaths;
/** The JS kit infers `fade` as null from its default; give ribsOf the signature it documents. */
const ribsOf = G.ribsOf as unknown as (F: unknown, s0: number, s1: number, r: number, count: number, P: unknown, options: { fade?: [number, number]; seams?: boolean }) => { d: string; alpha: number }[];

/* ---------- Floor ---------- */

function floorLines(): Lines {
  const out: string[] = [];
  const { x, y, w, d } = FLOOR;
  for (let gx = x + 50; gx < x + w; gx += 50) out.push(seg([gx, y, 0], [gx, y + d, 0]));
  for (let gy = y + 50; gy < y + d; gy += 50) out.push(seg([x, gy, 0], [x + w, gy, 0]));
  return join(out);
}

export const FLOOR_ART = {
  halo: haloOf(FLOOR, -FLOOR_H, FLOOR_H, P),
  slab: slab(FLOOR, -FLOOR_H, FLOOR_H, 2),
  joints: floorLines(),
  /* The ladle route, marked on the floor across the bay. */
  route: join([-24, 24].map((y) => seg([FLOOR.x, y, 0], [FLOOR.x + FLOOR.w, y, 0]))),
};

/* ---------- Building: stanchions, runway girders, bracing ---------- */

function column(cx: number, cy: number) {
  const half = COLUMN / 2;
  const base = box(cx - 7, cy - 7, cx + 7, cy + 7, 0, 1.2);
  const shaft = box(cx - half, cy - half, cx + half, cy + half, 1.2, COLUMN_TOP - 1.2);
  /* Flange edges of the H section on the faces turned to the reader, base to cap. */
  const flanges = join([
    seg([cx - 2, cy + half, 1.2], [cx - 2, cy + half, COLUMN_TOP]),
    seg([cx + 2, cy + half, 1.2], [cx + 2, cy + half, COLUMN_TOP]),
  ]);
  const bolts = corners({ x: cx - 7, y: cy - 7, w: 14, d: 14, r: 0 }, 2).map(([x, y]) => at([x, y, 1.2]));
  return { at: [cx, cy] as [number, number], base, shaft, flanges, bolts };
}

function runway(side: -1 | 1) {
  const x = side * RAIL_X;
  const plan: Plan = { x: x - RUNWAY_W / 2, y: RUNWAY_Y0, w: RUNWAY_W, d: RUNWAY_Y1 - RUNWAY_Y0, r: 0.4 };
  const face = x + RUNWAY_W / 2;
  const stiffeners = join(
    [...COLUMN_Y, -53, -18, 17].map((y) => seg([face, y, COLUMN_TOP], [face, y, RUNWAY_TOP])),
  );
  return {
    columns: byDepth(COLUMN_Y.map((y) => column(x, y))),
    girder: slab(plan, COLUMN_TOP, RUNWAY_TOP - COLUMN_TOP, 2, 0.4),
    stiffeners,
    rail: box(x - 1, RUNWAY_Y0 + 1, x + 1, RUNWAY_Y1 - 1, RUNWAY_TOP, RAIL_TOP - RUNWAY_TOP),
    stops: [RUNWAY_Y0 + 3, RUNWAY_Y1 - 3].map((y) => box(x - 2.5, y - 2, x + 2.5, y + 2, RAIL_TOP, 5)),
  };
}

/** X-bracing in the far wall, between stanchion faces. */
function bracing(): Lines {
  const x = -RAIL_X;
  const half = COLUMN / 2;
  const out: string[] = [];
  /* Two bays of X-bracing, meeting on a strut at mid-length. */
  const [y0, y1] = [COLUMN_Y[0]! + half, COLUMN_Y[1]! - half];
  const mid = (y0 + y1) / 2;
  out.push(seg([x, y0, 30], [x, y1, 30]));
  for (const [a, b] of [
    [y0, mid],
    [mid, y1],
  ] as [number, number][]) {
    out.push(seg([x, a, 30], [x, b, COLUMN_TOP]));
    out.push(seg([x, a, COLUMN_TOP], [x, b, 30]));
  }
  return join(out);
}

export const BUILDING = {
  left: runway(-1),
  right: runway(1),
  bracing: bracing(),
};

/* ---------- Floor fixtures ---------- */

function stand(cx: number) {
  const top: Plan = { x: cx - 15, y: -15, w: 30, d: 30, r: 1 };
  const legs = byDepth(
    corners(top, 2.5).map(([x, y]) => ({ at: [x, y] as [number, number], paths: box(x - 1.5, y - 1.5, x + 1.5, y + 1.5, 0, STAND_TOP - 3) })),
  );
  /* Cross braces on the two faces the reader sees, from the inner edge of one leg to the next. */
  const [inner, face, low, high] = [11, 14, 1, STAND_TOP - 4];
  const braces = join([
    seg([cx - inner, face, low], [cx + inner, face, high]),
    seg([cx - inner, face, high], [cx + inner, face, low]),
    seg([cx + face, -inner, low], [cx + face, inner, high]),
    seg([cx + face, -inner, high], [cx + face, inner, low]),
  ]);
  return {
    legs,
    braces,
    top: slab(top, STAND_TOP - 3, 3, 3, 0.6),
    seat: ring(cx, 0, 11.4, STAND_TOP, P, 48),
    bolts: corners(top, 3).map(([x, y]) => at([x, y, STAND_TOP])),
  };
}

function furnace() {
  const [cx, cy] = FURNACE;
  const base: Plan = { x: cx - 14, y: cy - 13, w: 28, d: 26, r: 1.5 };
  const body = cyl(cx, cy, 10.5, 4, 22, 48);
  return {
    base: slab(base, 0, 4, 3, 0.6),
    body,
    ribs: knurl(cx, cy, 10.5, 8, 22, 30, P),
    seams: join([sideArc(cx, cy, 10.5, 8, P, 32), sideArc(cx, cy, 10.5, 22, P, 32)]),
    lid: cyl(cx - 2, cy - 1.5, 7.5, 26, 2, 40),
    /* The pouring spout points at the furnace-side stand. */
    spout: box(cx - 2, cy + 9, cx + 2, cy + 14, 23, 3),
    bolts: corners(base, 3).map(([x, y]) => at([x, y, 4])),
  };
}

function mouldLine() {
  const y0 = MOULD_Y - 9;
  const y1 = MOULD_Y + 9;
  const rollers = [];
  for (let x = 13; x <= 93; x += 5) {
    rollers.push(lathe(G.disc(0, y1 - y0 - 3, 1.3, alongY([x, y0 + 1.5, 6]), P)));
  }
  const flasks = [18, 38, 58, 78].map((x) => {
    const plan: Plan = { x: x - 8, y: MOULD_Y - 6, w: 16, d: 12, r: 0.6 };
    return {
      at: [x, MOULD_Y] as [number, number],
      /* Cope over drag, the joint between them run round the box. */
      paths: slab(plan, 7.3, 12, 2, 0.5),
      joint: sideSeam(plan, 13.3, P, 2),
      sprue: ring(x - 3.5, MOULD_Y + 2, 1.6, 19.3, P, 20),
      riser: ring(x + 3.5, MOULD_Y - 1.5, 2.2, 19.3, P, 24),
      lugs: [box(x - 10, MOULD_Y - 1, x - 8, MOULD_Y + 1, 12, 2.6), box(x + 8, MOULD_Y - 1, x + 10, MOULD_Y + 1, 12, 2.6)],
    };
  });
  return {
    farRail: box(10, y0, 96, y0 + 1.5, 0, 7.3),
    rollers,
    nearRail: box(10, y1 - 1.5, 96, y1, 0, 7.3),
    flasks: byDepth(flasks),
  };
}

export const FIXTURES = {
  furnace: furnace(),
  mould: mouldLine(),
  stands: STANDS.map(stand),
};

/* ---------- Bridge ---------- */

function endTruck(side: -1 | 1) {
  const x = side * RAIL_X;
  const plan: Plan = { x: x - TRUCK_W / 2, y: -TRUCK_HALF, w: TRUCK_W, d: TRUCK_HALF * 2, r: 1 };
  const face = x + TRUCK_W / 2;
  const wheels = [-18, 18].map((y) => ({
    rim: sideRing([face, y, RAIL_TOP + 5], 4.5, "x", P, 32),
    hub: sideRing([face, y, RAIL_TOP + 5], 1.4, "x", P, 16),
    centre: at([face, y, RAIL_TOP + 5]),
  }));
  const buffer = (end: -1 | 1) => lathe(G.disc(0, 4, 2.4, alongY([x, end * TRUCK_HALF, RAIL_TOP + 7]), P));
  return {
    farBuffer: lathe(G.disc(-4, 0, 2.4, alongY([x, -TRUCK_HALF, RAIL_TOP + 7]), P)),
    body: slab(plan, RAIL_TOP, TRUCK_TOP - RAIL_TOP, 3, 0.8),
    seam: sideSeam(plan, RAIL_TOP + 9, P, 3),
    wheels,
    nearBuffer: buffer(1),
  };
}

const girderPlan = (y: number): Plan => ({ x: -GIRDER_END, y: y - GIRDER_W / 2, w: GIRDER_END * 2, d: GIRDER_W, r: 0.6 });

function girder(y: number) {
  const plan = girderPlan(y);
  const face = y + GIRDER_W / 2;
  const diaphragms: string[] = [];
  for (let x = -GIRDER_END + 15; x < GIRDER_END - 5; x += 20) diaphragms.push(seg([x, face, GIRDER_Z], [x, face, GIRDER_TOP]));
  return {
    body: slab(plan, GIRDER_Z, GIRDER_TOP - GIRDER_Z, 3, 0.8),
    diaphragms: join(diaphragms),
    rail: box(-GIRDER_END + 3, y - 0.75, GIRDER_END - 3, y + 0.75, GIRDER_TOP, TROLLEY_RAIL_TOP - GIRDER_TOP),
    stops: [-1, 1].map((end) => box(end * (GIRDER_END - 4) - 1.5, y - 2, end * (GIRDER_END - 4) + 1.5, y + 2, GIRDER_TOP, 4)),
  };
}

/** The driver's cab, hung under the far girder at the left end, with its windows. */
function cab() {
  const [x0, x1, y0, y1, z0, z1] = [-101, -83, -22, -6, 80, GIRDER_Z];
  return {
    body: box(x0, y0, x1, y1, z0, z1 - z0, 2, 0.5),
    windows: join([
      poly([[x0 + 2, y1, z0 + 7], [x1 - 2, y1, z0 + 7], [x1 - 2, y1, z1 - 2], [x0 + 2, y1, z1 - 2]], true),
      poly([[x1, y0 + 2, z0 + 7], [x1, y1 - 2, z0 + 7], [x1, y1 - 2, z1 - 2], [x1, y0 + 2, z1 - 2]], true),
    ]),
    sill: seg([x0, y1, z0 + 6], [x1, y1, z0 + 6]),
  };
}

function walkway() {
  const y0 = GIRDER_Y + GIRDER_W / 2;
  const y1 = y0 + 9;
  const deckZ = 108;
  const postX = [-GIRDER_END + 2, -70, -35, 0, 35, 70, GIRDER_END - 2];
  const railY = y1 - 1;
  /* Top and knee rails run between the end posts' faces; the posts between are drawn over them. */
  const rails = [deckZ + 7, deckZ + 13].map((z) => seg([postX[0]! + 0.6, railY, z], [postX.at(-1)! - 0.6, railY, z]));
  /* Bridge drive: a motor on a gearbox at mid-span, with line shafts out to both end trucks. */
  const shaftY = y0 + 4.5;
  const shaftZ = deckZ + 4;
  return {
    deck: box(-GIRDER_END, y0, GIRDER_END, y1, deckZ, 1, 2),
    toe: box(-GIRDER_END, y1 - 0.6, GIRDER_END, y1, deckZ + 1, 2),
    shafts: [
      lathe(G.disc(-GIRDER_END, -5, 0.8, alongX([0, shaftY, shaftZ]), P)),
      lathe(G.disc(5, GIRDER_END, 0.8, alongX([0, shaftY, shaftZ]), P)),
    ],
    couplings: [-60, -28, 28, 60].map((x) => lathe(G.disc(x - 1, x + 1, 1.6, alongX([0, shaftY, shaftZ]), P))),
    gearbox: box(-5, y0 + 1, 5, y1 - 1.5, deckZ + 1, 7, 2, 0.4),
    motor: lathe(G.solidOf([[-6, 2.6], [-5, 3.2], [5, 3.2], [5, 2], [6.5, 2]], alongX([0, shaftY, deckZ + 11.2]), P)),
    rails: join(rails),
    posts: postX.map((x) => box(x - 0.6, railY - 0.6, x + 0.6, railY + 0.6, deckZ + 1, 13)),
  };
}

export const BRIDGE = {
  left: endTruck(-1),
  right: endTruck(1),
  far: girder(-GIRDER_Y),
  near: girder(GIRDER_Y),
  cab: cab(),
  walkway: walkway(),
};

/* ---------- Trolley (built at x = 0, translated along the bridge) ---------- */

function trolley() {
  const bar = (x0: number, y0: number, x1: number, y1: number) => box(x0, y0, x1, y1, FRAME_Z, FRAME_TOP - FRAME_Z, 2, 0.4);
  const drumFrame = alongX([0, 0, DRUM_Z]);
  const grooves: string[] = [];
  for (let s = -8.1; s <= 8.1; s += 0.9) grooves.push(G.arcOf(drumFrame, s, DRUM_R, P));
  const motorFrame = alongX([0, -10, 124.5]);
  const ribs = ribsOf(motorFrame, -14, -3, 3.6, 18, P, { fade: [0.1, 0.55], seams: true });
  return {
    wheels: corners({ x: -18, y: -GIRDER_Y - 2, w: 36, d: GIRDER_Y * 2 + 4, r: 0 }, 2).map(([x, y]) => box(x - 2.5, y - 1.5, x + 2.5, y + 1.5, TROLLEY_RAIL_TOP, FRAME_Z - TROLLEY_RAIL_TOP)),
    farBar: bar(-20, -15, 20, -6),
    motor: lathe(G.solidOf([[-17, 2.6], [-16, 3.2], [-14, 3.6], [-3, 3.6], [-3, 2.2], [-1, 2.2]], motorFrame, P)),
    motorRibs: fadedSvg(ribs, { tone: "lo" }),
    motorShaft: lathe(G.disc(-1, 13, 0.9, motorFrame, P)),
    leftBar: bar(-20, -6, -8, 6),
    rightBar: bar(8, -6, 20, 6),
    nearBar: bar(-20, 6, 20, 15),
    pedestals: [-12, 12].map((x) => box(x - 1.2, -4, x + 1.2, 4, FRAME_TOP, DRUM_Z - FRAME_TOP + 1)),
    /* Barrel and flanges as separate turned parts, so the grooves end on the barrel's own outline. */
    farFlange: lathe(G.disc(-10, -9, 6.6, drumFrame, P)),
    drum: lathe(G.disc(-9, 9, DRUM_R, drumFrame, P)),
    nearFlange: lathe(G.disc(9, 10, 6.6, drumFrame, P)),
    grooves: join(grooves),
    gearbox: box(13, -12, 21, 6, FRAME_TOP, 11, 2, 0.5),
    gearboxSeam: sideSeam({ x: 13, y: -12, w: 8, d: 18, r: 0.6 }, FRAME_TOP + 6, P, 2),
    gearboxBolts: [at([17, 6, FRAME_TOP + 6]), at([21, 0, FRAME_TOP + 6]), at([21, -6, FRAME_TOP + 6])],
  };
}

export const TROLLEY = trolley();

/* ---------- Hook block (built with the hook's bowl at the origin) ---------- */

function hookBlock() {
  const block: Plan = { x: -6, y: -4.5, w: 12, d: 9, r: 1.2 };
  const route: Point3[] = [[-2.2, 0, 5.4]];
  for (let step = 0; step <= 20; step++) {
    const a = Math.PI + (step / 20) * (Math.PI + 0.55);
    route.push([2.2 * Math.cos(a), 0, 3.2 + 2.2 * Math.sin(a)]);
  }
  route.splice(1, 0, [-2.2, 0, 3.2]);
  const pieces = tubePieces(route, (t: number) => 1.1 - 0.45 * t, P, { maxLength: 40 });
  return {
    crosshead: box(-3.5, -3, 3.5, 3, 5.4, 1.6),
    block: slab(block, 7, 10, 3, 0.6),
    sheave: sideRing([0, 4.5, 12], 3.8, "y", P, 32),
    pin: at([0, 4.5, 12]),
    /* Where each rope fall enters the block: the ropes are drawn to these points. */
    ropeEnds: ROPES.map((x) => at([x, 0, BLOCK_TOP])),
    hook: (pieces as unknown[]).map((piece) => tubeSvg(piece, { tone: "hi" })).join(""),
  };
}

export const HOOK = hookBlock();

/* ---------- Ladle (built with its bottom centre at the origin) ---------- */

function ladle() {
  const axis = upright([0, 0, 0]);
  const slope = (13.6 - 11.2) / 22.5;
  const radius = (s: number) => 11.2 + (s - 2) * slope;
  /* Trunnions stand out from the body on either side; the bail arms pivot on their ends. */
  const trunnion = (side: -1 | 1) => lathe(G.disc(radius(17) - 0.2, BAIL_Y - 1, 2.2, G.frameOf([0, 0, 17], [0, side, 0], [0, 0, 1], [1, 0, 0]), P));
  const arm = (side: -1 | 1) => box(-1.2, side > 0 ? BAIL_Y - 1 : -BAIL_Y - 1, 1.2, side > 0 ? BAIL_Y + 1 : -BAIL_Y + 1, 13, 28);
  return {
    farArm: arm(-1),
    farTrunnion: trunnion(-1),
    /* Foot, tapered shell and lip as three turned parts, so each outline is its true silhouette and the bands end on it. */
    foot: lathe(G.disc(0, 2, 10.4, axis, P)),
    body: lathe(G.solidOf([[2, 11.2], [24.5, 13.6]], axis, P)),
    lip: lathe(G.ringBand(24.5, LADLE_TOP, 12.6, 14.8, axis, P)),
    bands: join([G.arcOf(axis, 8, radius(8), P, { slope }), G.arcOf(axis, 18, radius(18), P, { slope })]),
    mouth: G.circleOf(axis, LADLE_TOP, 12.6, P, 64),
    metal: G.circleOf(axis, LADLE_TOP - 2.6, 12.4, P, 64),
    nearTrunnion: trunnion(1),
    nearArm: arm(1),
    crossbar: box(-1.2, -BAIL_Y - 1, 1.2, BAIL_Y + 1, 38, 3, 2, 0.3),
  };
}

export const LADLE = ladle();

