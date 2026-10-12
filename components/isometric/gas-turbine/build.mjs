/*
 * Build script for the gas turbine figure: run `node components/isometric/gas-turbine/build.mjs` after changing it,
 * and `--audit` to prove the geometry. It draws every part with the kit, records each part's true shape, settles the
 * painter's order from measured depth (assembled, apart and in every replayed frame of the explode), and writes
 * scene.json for the React component. The audit and settling are too slow to run per request, so they run here.
 *
 * Truth: NTPC Anta has three gas turbines of 88.71 MW (ABB 13D2, 1989) and one 153.2 MW steam turbine
 * (CERC filing). A two-pole generator on a 50 Hz grid turns at 3000 rpm. Everything else in the drawing is a general
 * arrangement of a single-shaft heavy-duty unit, not the 13D2's own drawings.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../iso/iso-kit.mjs";
import * as G from "../../iso/lathe.mjs";
import { tubePieces, tubeSvg } from "../../iso/tube.mjs";
import * as A from "../../iso/audit.mjs";
import { glCamera } from "../../iso/gl.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEG = Math.PI / 180;

/* ---------- Truth ---------- */

const UNIT_MW = 88.71;
const STATION_MW = 419.33;
const RPM = 3000;

/* ---------- World and camera ---------- */

const W = 960;
const H = 620;
const AZIMUTH = 62;
const ELEVATION = 28;

/** Shaft centreline height. x runs along the shaft from the generator (−x) to the exhaust (+x). */
const SZ = 64;
const FOUND_TOP = 26;

const FLOOR = { x: -205, y: -92, w: 440, d: 214, r: 2 };

const P = k.fitProjection(
  [
    ...k.boxCorners(FLOOR, -6, 0),
    [-84, -90, 170],
    [-8, -90, 170],
    [158 - 22, -22, 246],
    [158 + 22, 22, 246],
    [33, -21, 284],
    [67, 13, 284],
  ],
  W,
  H,
  { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const Faded = (list, style) => k.fadedSvg(list, style);

/** Frames: along the shaft (u = y, v = z), and up. */
const shaftFrame = (x, y = 0, z = SZ) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const SHAFT = shaftFrame(0);
const upFrame = (x, y, z = 0) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const alongY = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);

/* ---------- Assemblies and their explode moves ---------- */

const PIECES = {
  base: { name: "Foundation and filter house", say: "", move: [0, 0, 0] },
  generator: { name: "Generator", say: "generator · 3000 rpm on a 50 Hz grid", move: [-74, 0, 0] },
  coupling: { name: "Coupling guard", say: "coupling · generator to compressor shaft", move: [0, 0, 36] },
  casing: { name: "Upper casing", say: "upper casing · lifted to show the rotor", move: [0, 0, 56] },
  rotor: { name: "Rotor", say: "rotor · compressor and turbine on one shaft", move: [0, 0, 0] },
  silo: { name: "Silo combustor", say: "silo combustor · fuel burns in compressed air", move: [0, 0, 66] },
  inlet: { name: "Inlet duct", say: "inlet duct · filtered air down to the compressor", move: [0, 0, 44] },
  exhaust: { name: "Exhaust and stack", say: "exhaust · hot gas out through the stack", move: [70, 0, 0] },
  lube: { name: "Lube oil skid", say: "lube oil · bearings fed and drained", move: [0, 40, 0] },
  /* Out and along, so the line's free end clears the lifted silo instead of landing on its outline. */
  fuel: { name: "Fuel gas skid", say: "fuel gas · stop and control valves to the burner", move: [46, 40, 0] },
};

/* Whoever is outside leaves first: the fuel line runs over the silo, the lube lines hang off the bearings, the inlet
 * and the silo sit on the upper casing. Closing reverses it, so the silo is home six steps before the fuel line
 * comes back over it. */
const STAGGER = ["fuel", "lube", "inlet", "coupling", "exhaust", "generator", "silo", "casing", "rotor", "base"];
const SPRING = { stagger: 0.035, stiffness: 64, damping: 14.2, substeps: 4 };
const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const { nameFor } = R;
const record = R.solid;

function put(piece, ref, svg, { bias = 0, move, ride, shapes = [], name, route, chunk } = {}) {
  R.put({ piece, ride: ride ?? piece, at: ref, bias, svg, move: move ?? PIECES[piece].move, shapes, name: name ?? nameFor(`${piece}.item`), route, chunk });
}

function boxAt(piece, plan, z, h, style = {}, { extra = "", bias = 0, bevel = 0.5, steps = 3, name, owner, ground = false } = {}) {
  const centre = [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
  const id = nameFor(name ?? `${piece}.box`);
  put(piece, centre, S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "hi", ...style }) + extra, {
    bias,
    name: id,
    shapes: [record(A.box([plan.x, plan.y, z], [plan.x + plan.w, plan.y + plan.d, z + h], { name: id, owner, ground }))],
  });
  return id;
}

function turned(piece, F, profile, style = {}, { extra = "", inner = "", bias = 0, name, owner, smooth, rims, bevel = 0 } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel, ...(smooth !== undefined ? { smooth } : {}), ...(rims ? { rims } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const id = nameFor(name ?? `${piece}.turned`);
  const shape = record(A.solid(F, profile, { name: id, owner }));
  put(piece, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "hi", ...style, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, name: id, shapes: [shape] });
  return shape;
}

const disc = (piece, F, s0, s1, r, style = {}, options = {}) =>
  turned(piece, F, [
    [s0, r],
    [s1, r],
  ], style, options);

/** Half of a casing along x, split on the horizontal joint, drawn and recorded as two quarter shells (far and near
 * of the crown or the keel). A hollow shell wraps the rotor, so as one item it is both in front of and behind it; as
 * quarters each one is on one side: lower-far, then the rotor, then lower-near and both upper quarters. Each quarter
 * is recorded as a hollow wall of `wall` in convex segments. The lower-far quarter carries the open trough, dark. */
function halfShell(piece, x0, x1, r, upper, style = {}, { extra = "", bias = 0, name, owner, steps = 24, wall = 2.5, joints = [] } = {}) {
  const id = nameFor(name ?? `${piece}.shell`);
  /* Joint rings where this section meets a narrower one: recorded so the sections connect, drawn by the end faces. */
  const jointOf = (from, to) =>
    joints.flatMap(([x, rIn]) => {
      const segment = [];
      const band = 3;
      for (let index = 0; index < band; index++) {
        const a = from + (index / band) * (to - from);
        const b = from + ((index + 1) / band) * (to - from);
        segment.push(record(A.prism(SHAFT, [[rIn * Math.cos(a), rIn * Math.sin(a)], [r * Math.cos(a), r * Math.sin(a)], [r * Math.cos(b), r * Math.sin(b)], [rIn * Math.cos(b), rIn * Math.sin(b)]], x - 0.5, x + 0.5, { name: `${id}.joint`, owner })));
      }
      return segment;
    });
  const quarter = (from, to) => {
    const arc = (radius) => Array.from({ length: steps + 1 }, (_, step) => {
      const t = from + ((to - from) * step) / steps;
      return [radius * Math.cos(t), radius * Math.sin(t)];
    });
    return { outer: arc(r), inner: arc(r - wall) };
  };
  const parts = upper
    ? [
        { side: "far", from: Math.PI / 2, to: Math.PI },
        { side: "near", from: 0, to: Math.PI / 2 },
      ]
    : [
        { side: "far", from: Math.PI, to: Math.PI * 1.5 },
        { side: "near", from: Math.PI * 1.5, to: Math.PI * 2 },
      ];
  const all = [];
  for (const { side, from, to } of parts) {
    const { outer, inner } = quarter(from, to);
    const shapes = [];
    const segments = 5;
    for (let index = 0; index < segments; index++) {
      const a = Math.round((index * steps) / segments);
      const b = Math.round(((index + 1) * steps) / segments);
      shapes.push(record(A.prism(SHAFT, [...outer.slice(a, b + 1), ...inner.slice(a, b + 1).reverse()], x0, x1, { name: `${id}.${side}#${index}`, owner })));
    }
    /* The drawn quarter is the solid between the chord and the arc, closed by its end faces. */
    const solid = G.prismOf(SHAFT, [[0, 0], ...outer], x0, x1, P);
    let trough = "";
    if (!upper && side === "far") {
      const rIn = r - wall;
      const quad = [[x0 + 0.6, -rIn, SZ], [x1 - 0.6, -rIn, SZ], [x1 - 0.6, rIn, SZ], [x0 + 0.6, rIn, SZ]].map(at);
      trough = `<path class="gt-cavity" d="${k.pathOf(quad, true)}"/>` + Ln(k.pathOf(quad, true), { tone: "lo" });
    }
    const mid = (from + to) / 2;
    put(piece, [(x0 + x1) / 2, (r / 2) * Math.cos(mid), SZ + (r / 2) * Math.sin(mid)], S(solid, { tone: "hi", ...style }) + trough + (side === "near" ? extra : ""), { bias, name: `${id}.${side}`, shapes: [...shapes, ...jointOf(from, to)] });
    all.push(...shapes);
  }
  return all;
}

/** Bolt dots round the visible half of a joint ring at x, on its +x face. */
function ringBolts(x, r, upper, count = 14) {
  const points = [];
  for (let index = 0; index <= count; index++) {
    const t = (upper ? 0 : Math.PI) + ((index + 0.5) / (count + 1)) * Math.PI;
    points.push(at([x, r * Math.cos(t), SZ + r * Math.sin(t)]));
  }
  return points;
}

function tubeItems(piece, route, r, { name, tone = "hi", bias = 0, maxLength, spacing, owner, touch, bundle, limp = false, breaks = [], gaps = [], caps = true, ends = [true, true], rims, free = [false, false] } = {}) {
  const id = nameFor(name ?? `${piece}.tube`);
  R.route(id, route, r, { owner: owner ?? id, touch, bundle, limp, gaps, ends, rims, free, piece, move: PIECES[piece].move, ride: piece });
  tubePieces(route, r, P, { maxLength, spacing, breaks, gaps, caps }).forEach((part, index) =>
    put(piece, part.mid, tubeSvg(part, { tone }), { bias, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
  );
  return id;
}

function flangeAt(piece, centre, axis, r, thick, { bolts = 8, tone = "hi", bias = 0, boltR, name, owner } = {}) {
  const F = G.frameAlong(centre, axis);
  const id = nameFor(name ?? `${piece}.flange`);
  const paths = G.disc(-thick / 2, thick / 2, r, F, P);
  const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
  const face = Math.abs(G.dot3(F.a, V)) > 0.12 && bolts ? Dots(G.dotsOf(F, towards, boltR ?? r * 0.74, bolts, P, { all: true }), { size: 0.42, tone: "mid" }) : "";
  put(piece, centre, S(paths, { tone }) + face, { bias, name: id, shapes: [record(A.disc(F, -thick / 2, thick / 2, r, { name: id, owner }))] });
}

/** A pipe from real port to real port: filleted, flanged at both ends, gapped under every collar. */
function pipe(piece, control, r, { bend = 2.6, tone = "hi", flanges = [true, true], flangeR = 1.55, bands = [], valves = [], bias = 0, maxLength = 22, name, touch, free, breaks = [] } = {}) {
  const line = G.fillet(control, Math.max(r * bend, 3), r > 3 ? 20 : 12, { P, tube: r });
  const total = G.pathLength(line);
  const collars = [];
  [[0, -1], [total, 1]].forEach(([along, sign], index) => {
    if (!flanges[index]) return;
    const thick = Math.max(0.9, r * 0.55);
    const tangent = G.tangentAlong(line, along);
    collars.push({ kind: "flange", centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: r * flangeR, thick, gap: sign < 0 ? [0, thick] : [total - thick, total] });
  });
  for (const share of bands) {
    const along = total * share;
    const thick = Math.max(0.8, r * 0.7);
    collars.push({ kind: "band", centre: G.pointAlong(line, along), tangent: G.tangentAlong(line, along), radius: r * 1.18, thick, gap: [along - thick / 2, along + thick / 2] });
  }
  const gaps = collars.map(({ gap }) => gap);
  for (const [share] of valves) {
    const along = share > 1 ? share : total * share;
    gaps.push([along - r * 2.4, along + r * 2.4]);
  }
  const owner = tubeItems(piece, line, r, { name: name ?? `${piece}.pipe`, tone, bias, maxLength, spacing: Math.max(0.8, Math.min(2.4, r * 0.18)), touch, gaps, breaks, free, rims: flanges.map((on) => (on ? r * flangeR : r)) });
  for (const { kind, centre, tangent, radius, thick } of collars) flangeAt(piece, centre, tangent, radius, thick, { bolts: kind === "flange" && r > 2.5 ? 6 : 0, tone: kind === "flange" ? tone : "mid", bias, name: `${owner}.${kind}`, owner });
  line.owner = owner;
  for (const [share, side] of valves) valveOn(piece, line, share, r, { side });
  return line;
}

function valveOn(piece, line, share, r, { tone = "hi", side = [0, 0, 1] } = {}) {
  const total = G.pathLength(line);
  const along = share > 1 ? share : total * share;
  const centre = G.pointAlong(line, along);
  const tangent = G.tangentAlong(line, along);
  const F = G.frameAlong(centre, tangent);
  const crown = r * 2;
  const bulge = (x) => r * 1.45 + (crown - r * 1.45) * Math.sqrt(Math.max(0, 1 - (x / (r * 1.6)) ** 2));
  const bulgeSlope = (x) => {
    if (Math.abs(x) >= r * 1.6 - 1e-9) return 0;
    const t = Math.max(-0.995, Math.min(0.995, x / (r * 1.6)));
    return (-(crown - r * 1.45) * t) / (r * 1.6 * Math.sqrt(1 - t * t));
  };
  const meridian = [
    [-r * 2.4, 0],
    [-r * 2.4, r * 1.45],
    ...Array.from({ length: 17 }, (_, index) => {
      const x = r * 1.6 * Math.sin(((index - 8) / 8) * (Math.PI / 2));
      return [x, bulge(x), index && index < 16 ? 1 : 0];
    }),
    [r * 2.4, r * 1.45],
    [r * 2.4, 0],
  ];
  const id = nameFor(`${line.owner}.valve`);
  const owner = line.owner;
  put(piece, centre, S(G.lathe(meridian, F, P, { steps: 36, smooth: { slope: bulgeSlope, rows: 3 } }), { tone }) + Dots([...G.dotsOf(F, -r * 2.4, r * 1.2, 8, P, { all: true }), ...G.dotsOf(F, r * 2.4, r * 1.2, 8, P, { all: true })].filter((_, index) => index % 2 === 0), { size: 0.4, tone: "mid" }), {
    name: id,
    shapes: [record(A.body(F, meridian, { name: id, owner }))],
  });
  const up = G.unit3(side);
  const NF = G.frameAlong(centre, up);
  const s0 = crown - 0.25;
  const s1 = crown + r * 0.9;
  put(piece, G.add3(centre, G.mul3(up, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 0.5, NF, P), { tone }), { bias: 0.2, name: `${id}.neck`, shapes: [record(A.disc(NF, s0, s1, r * 0.5, { name: `${id}.neck`, owner }))] });
  const top = G.add3(centre, G.mul3(up, s1));
  const plan = { x: top[0] - r * 1.6, y: top[1] - r * 1.6, w: r * 3.2, d: r * 3.2, r: 0.8 };
  const lid = top[2] + r * 2.4;
  boxAt(piece, plan, top[2], r * 2.4, { tone }, {
    bias: 0.3,
    name: `${id}.actuator`,
    owner,
    extra: Ln(k.planOutline(k.insetPlan(plan, 0.8), lid, P, 2), { tone: "faint" }) + Dots([at([plan.x + 1.2, plan.y + 1.2, lid]), at([plan.x + plan.w - 1.2, plan.y + plan.d - 1.2, lid])], { size: 0.4 }),
  });
}

/* ================================================================== */
/* Foundation                                                          */
/* ================================================================== */

const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(FLOOR, -6, 6, P)}"/>`);
back.push(S(k.slabOf(FLOOR, -6, 6, P, 2), { tone: "lo" }));
{
  const lines = [];
  for (let x = FLOOR.x + 40; x < FLOOR.x + FLOOR.w; x += 40) lines.push(k.segment([x, FLOOR.y, 0], [x, FLOOR.y + FLOOR.d, 0], P));
  for (let y = FLOOR.y + 46; y < FLOOR.y + FLOOR.d; y += 46) lines.push(k.segment([FLOOR.x, y, 0], [FLOOR.x + FLOOR.w, y, 0], P));
  back.push(Ln(lines.join(""), { tone: "faint" }));
}

const BLOCKS = [
  { x: -178, y: -34, w: 116, d: 68, r: 1.5 },
  { x: -60, y: -40, w: 168, d: 80, r: 1.5 },
  { x: 108, y: -46, w: 82, d: 92, r: 1.5 },
];
for (const block of BLOCKS) {
  const bolts = k.corners(block, 6).map(([x, y]) => at([x, y, FOUND_TOP]));
  boxAt("base", block, 0, FOUND_TOP, { tone: "lo" }, { name: "base.block", bevel: 0.8, ground: true, extra: Dots(bolts, { size: 0.5, tone: "mid" }) + Ln(k.sideSeam(block, 4, P, 3), { tone: "faint" }) });
}

/* ================================================================== */
/* Generator                                                           */
/* ================================================================== */

const GEN = { x: -162, y: -26, w: 92, d: 52, r: 3 };
const GEN_TOP = 98;
{
  const feet = [-150, -86].map((x) => ({ x: x - 6, y: -30, w: 12, d: 60, r: 1 }));
  for (const foot of feet) boxAt("generator", foot, FOUND_TOP, 4, { tone: "mid" }, { name: "generator.foot", extra: Dots(k.corners(foot, 2).map(([x, y]) => at([x, y, FOUND_TOP + 4])), { size: 0.45 }) });
  const ribs = [];
  for (let x = GEN.x + 12; x < GEN.x + GEN.w - 4; x += 12) ribs.push(k.segment([x, GEN.y + GEN.d, FOUND_TOP + 4], [x, GEN.y + GEN.d, GEN_TOP], P));
  boxAt("generator", GEN, FOUND_TOP + 4, GEN_TOP - FOUND_TOP - 4, { tone: "hi" }, { name: "generator.stator", bevel: 1, extra: Ln(ribs.join(""), { tone: "faint" }) });
  /* Drive-end shield and bearing, facing the coupling. */
  turned("generator", shaftFrame(GEN.x + GEN.w), [[0, 22], [2.5, 21], [4.5, 16], [6, 9], [6, 0]], { tone: "hi" }, { name: "generator.endshield" });
  boxAt("generator", { x: -63, y: -11, w: 9, d: 22, r: 1.2 }, FOUND_TOP, SZ - 7 - FOUND_TOP, { tone: "mid" }, { name: "generator.pedestal" });
  turned("generator", shaftFrame(-63), [[0, 7], [9, 7]], { tone: "mid" }, { name: "generator.bearing" });
  /* Air cooler on the roof, with its water connections. */
  const COOLER = { x: -150, y: -20, w: 66, d: 40, r: 2 };
  const fins = [];
  for (let x = COOLER.x + 4; x < COOLER.x + COOLER.w - 2; x += 3) fins.push(k.segment([x, COOLER.y + COOLER.d, GEN_TOP + 3], [x, COOLER.y + COOLER.d, GEN_TOP + 19], P));
  boxAt("generator", COOLER, GEN_TOP, 22, { tone: "mid" }, { name: "generator.cooler", extra: Ln(fins.join(""), { tone: "faint" }) + Ln(k.sideSeam(COOLER, GEN_TOP + 3, P, 2) + k.sideSeam(COOLER, GEN_TOP + 19, P, 2), { tone: "lo" }) });
  /* Line-side terminal box on the near face. */
  const TERM = { x: -136, y: 26, w: 42, d: 8, r: 1.2 };
  boxAt("generator", TERM, 34, 30, { tone: "mid" }, { name: "generator.terminals", extra: Dots(k.corners({ ...TERM, y: TERM.y + TERM.d - 0.01, d: 0.01 }, 2).map(([x]) => at([x, TERM.y + TERM.d, 62])), { size: 0.45 }) });
  for (const x of [-126, -115, -104]) disc("generator", alongY(x, TERM.y + TERM.d, 48), 0, 4, 5, { tone: "hi" }, { name: "generator.bushing" });
}

/* Isolated-phase bus ducts from the terminals to the edge of the slab, toward the step-up transformer. */
for (const x of [-126, -115, -104]) {
  pipe("base", [[x, 38, 48], [x, 76, 48], [x, 76, 7], [x, 96, 7]], 3.2, { bend: 2.4, flangeR: 1.45, name: "base.busduct", free: [true, false], bands: [0.35] });
}
/* The ducts end in a termination frame at the slab's edge, where they would run on to the step-up transformer. */
boxAt("base", { x: -134, y: 96, w: 38, d: 8, r: 1 }, 0, 16, { tone: "mid" }, { name: "base.duct-termination", ground: true, extra: Dots(k.corners({ x: -134, y: 104, w: 38, d: 0.01, r: 0 }, 2).map(([x]) => at([x, 104, 14])), { size: 0.45 }) });

/* ================================================================== */
/* Gas turbine: split casing, supports                                 */
/* ================================================================== */

/** Casing sections along the shaft: [x0, x1, outer radius]. */
const SECTIONS = [
  { x0: -46, x1: -24, r: 30, name: "inlet" },
  { x0: -24, x1: 36, r: 24, name: "compressor" },
  { x0: 36, x1: 66, r: 31, name: "combustor" },
  { x0: 66, x1: 94, r: 28, name: "turbine" },
  { x0: 94, x1: 106, r: 31, name: "exhaust" },
];

/* Supports from the foundation to the lower half at the inlet and the exhaust end. */
for (const [x, r, half] of [[-36, 30, 24], [100, 31, 25]]) {
  for (const side of [-1, 1]) {
    const inner = half - 6;
    /* Up to the shell's underside at the support's inner edge, so it carries the casing without entering it. */
    const top = SZ - Math.sqrt(r * r - inner * inner) - 0.05;
    const y0 = side > 0 ? inner : -half;
    boxAt("base", { x: x - 4, y: y0, w: 8, d: 6, r: 0.8 }, FOUND_TOP, top - FOUND_TOP, { tone: "mid" }, { name: "base.support" });
  }
}

/** Where a section meets a narrower neighbour, the joint ring spans from the neighbour's bore to this section's outside. */
const jointsOf = (index) => {
  const { x0, x1 } = SECTIONS[index];
  const out = [];
  const before = SECTIONS[index - 1];
  const after = SECTIONS[index + 1];
  if (before && before.r < SECTIONS[index].r) out.push([x0 + 0.5, before.r - 2.5]);
  if (after && after.r < SECTIONS[index].r) out.push([x1 - 0.5, after.r - 2.5]);
  return out;
};

SECTIONS.forEach((section, index) => {
  const { x0, x1, r } = section;
  halfShell("base", x0, x1, r, false, { tone: "mid" }, { name: `base.lower-${section.name}`, owner: "base.lower", joints: jointsOf(index) });
});

/* ================================================================== */
/* Rotor (inside the casing; seen when the upper half is lifted)       */
/* ================================================================== */

/* Blade-row discs sit on the shaft, so the shaft is drawn in segments between them, each ending flush on a disc face. */
const DISCS = [];
{
  const stages = 15;
  for (let index = 0; index < stages; index++) {
    const x = -20 + index * 3.7;
    /* Blade tips keep a clearance inside the casing wall, as real tip clearances do. */
    const tip = 18.5 - index * 0.32;
    const F = shaftFrame(x);
    const blades = Faded(G.ribsOf(F, -0.8, 0.8, tip, 40, P, { fade: [0.1, 0.55] }), { tone: "lo" });
    turned("rotor", F, [[-0.8, tip], [0.8, tip]], { tone: "hi" }, { name: "rotor.compressor-stage", extra: blades });
    DISCS.push([x - 0.8, x + 0.8]);
  }
  for (let index = 0; index < 4; index++) {
    const x = 70 + index * 6.4;
    const tip = 19 + index * 0.8;
    const F = shaftFrame(x);
    turned("rotor", F, [[-1.6, tip], [1.6, tip]], { tone: "hi" }, { name: "rotor.turbine-stage", extra: Faded(G.ribsOf(F, -1.6, 1.6, tip, 40, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
    DISCS.push([x - 1.6, x + 1.6]);
  }
  /* The coupling halves are discs on the shaft too. */
  DISCS.push([-53, -47]);
  DISCS.sort((a, b) => a[0] - b[0]);
  let from = -54;
  for (const [a, b] of DISCS) {
    if (a - from > 0.05) turned("rotor", shaftFrame(from), [[0, 4.5], [a - from, 4.5]], { tone: "mid" }, { name: "rotor.shaft" });
    from = b;
  }
  turned("rotor", shaftFrame(from), [[0, 4.5], [106 - from, 4.5]], { tone: "mid" }, { name: "rotor.shaft" });
}

/* Upper halves, with the joint flange on the near side and bolt rings at each section joint. */
SECTIONS.forEach((section, index) => {
  const { x0, x1, r } = section;
  /* The inlet section's upper half comes off with the inlet duct that sits on it. */
  const piece = section.name === "inlet" ? "inlet" : "casing";
  const bolts = Dots(ringBolts(x1 - 0.05, r - 2.4, true), { size: 0.42, tone: "mid" });
  halfShell(piece, x0, x1, r, true, { tone: "hi" }, { name: `${piece}.upper-${section.name}`, owner: `${piece}.upper`, joints: jointsOf(index), extra: bolts });
  /* Joint flange standing off the shell's side at the split, touching it, bolted along its top. */
  const flange = { x: x0 + 0.5, y: r, w: x1 - x0 - 1, d: 4.5, r: 0.6 };
  const holes = [];
  for (let x = x0 + 2.5; x < x1 - 1; x += 4) holes.push(at([x, r + 2.4, SZ + 3]));
  boxAt(piece, flange, SZ, 3, { tone: "mid" }, { name: `${piece}.flange-${section.name}`, owner: `${piece}.upper`, extra: Dots(holes, { size: 0.42, tone: "mid" }) });
});

/* A cutaway window through the silo wall and the flame tube inside it, turned to the reader. The flame burns in it
 * (WebGL) while the unit runs; cold, it is the dark inside of the combustor. It is cut into the body, so it is drawn
 * as part of the body's item, always over it. */
const FACING = Math.atan2(V[1], V[0]);
const WINDOW = { a0: FACING - 0.62, a1: FACING + 0.28, z0: 126, z1: 170, liner: 11.5 };
function siloWindow() {
  const ring = (z, r, from, to, n = 18) => Array.from({ length: n + 1 }, (_, index) => {
    const a = from + ((to - from) * index) / n;
    return [SILO[0] + r * Math.cos(a), SILO[1] + r * Math.sin(a), z];
  });
  const { a0, a1, z0, z1, liner } = WINDOW;
  const outer = [...ring(z0, SILO_R, a0, a1), ...ring(z1, SILO_R, a1, a0)].map(at);
  const inner = [...ring(z0, liner, a0, a1), ...ring(z1, liner, a1, a0)].map(at);
  /* The cut face of the casing wall at the sill, seen from above. */
  const sill = [...ring(z0, SILO_R, a0, a1), ...ring(z0, SILO_R - 1.6, a1, a0)].map(at);
  return (
    `<path class="gt-cavity gt-window" d="${k.pathOf(outer, true)}"/>` +
    `<path class="iso-top" d="${k.pathOf(sill, true)}"/>` +
    Ln(k.pathOf(inner, true), { tone: "lo" }) +
    Ln(k.pathOf(outer, true), { tone: "hi" })
  );
}

/* ================================================================== */
/* Silo combustor                                                      */
/* ================================================================== */

const SILO = [50, 0];
const SILO_R = 17;
const SILO_BASE = SZ + 30;
const SILO_TOP = 196;
{
  const F = upFrame(SILO[0], SILO[1], 0);
  /* The neck is a saddle pad cut to the casing's curve; it belongs to the casing, and the silo lifts off its top. */
  {
    const a = 12;
    const host = 31;
    const start = (angle) => SZ + Math.sqrt(host * host - (a * Math.sin(angle)) ** 2);
    const low = SZ + Math.sqrt(host * host - a * a);
    const id = nameFor("casing.silo-neck");
    /* A solid stand-in for the combustor casing, only to cut the pad's base; it moves with the casing. */
    const hostSolid = Object.assign(A.disc(shaftFrame(36), 0, 30, 31, { name: "casing.combustor-solid" }), { piece: "casing", ride: "casing", move: PIECES.casing.move });
    put("casing", [SILO[0], SILO[1], (low + SILO_BASE + 6) / 2], S(G.saddleOf(F, a, start, SILO_BASE + 6, P), { tone: "mid" }), {
      name: id,
      shapes: [record(A.disc(F, low - 0.05, SILO_BASE + 6, a, { name: id, owner: "casing.upper", seated: true, cut: [hostSolid] }))],
    });
  }
  turned("silo", F, [[SILO_BASE + 6, SILO_R + 4], [SILO_BASE + 9, SILO_R + 4]], { tone: "mid" }, { name: "silo.base-flange", extra: Dots(G.dotsOf(F, SILO_BASE + 9, SILO_R + 2, 20, P, { all: true }), { size: 0.42 }) });
  const bands = [130, 162].map((s) => G.arcOf(F, s, SILO_R, P)).join("");
  turned("silo", F, [[SILO_BASE + 9, SILO_R], [SILO_TOP - 10, SILO_R]], { tone: "hi" }, { name: "silo.body", inner: bands, extra: siloWindow() });
  turned("silo", F, [[SILO_TOP - 10, SILO_R + 3], [SILO_TOP - 7, SILO_R + 3]], { tone: "mid" }, { name: "silo.top-flange", extra: Dots(G.dotsOf(F, SILO_TOP - 7, SILO_R + 1.5, 20, P, { all: true }), { size: 0.42 }) });
  const dome = Array.from({ length: 9 }, (_, index) => {
    const t = (index / 8) * (Math.PI / 2);
    return [SILO_TOP - 7 + Math.sin(t) * 9, (SILO_R + 0.5) * Math.cos(t) + (index === 8 ? 0 : 0), index > 0 && index < 8 ? 1 : 0];
  });
  turned("silo", F, dome, { tone: "hi" }, { name: "silo.dome" });
  turned("silo", F, [[SILO_TOP + 2, 3.5], [SILO_TOP + 8, 3.5]], { tone: "mid" }, { name: "silo.burner-stem", inner: G.arcOf(F, SILO_TOP + 5, 3.5, P) });
  boxAt("silo", { x: SILO[0] - 5, y: SILO[1] - 5, w: 10, d: 10, r: 1 }, SILO_TOP + 8, 10, { tone: "mid" }, { name: "silo.burner-head", extra: Dots(k.corners({ x: SILO[0] - 5, y: SILO[1] - 5, w: 10, d: 10, r: 0 }, 1.5).map(([x, y]) => at([x, y, SILO_TOP + 18])), { size: 0.42 }) });
}

/* ================================================================== */
/* Inlet: filter house on legs, duct down to the compressor inlet       */
/* ================================================================== */

/* The filter house stands behind the machine on legs; the duct comes forward over the casing and down into the
 * inlet plenum, as a side intake does. */
const HOUSE = { x: -84, y: -90, w: 76, d: 40, r: 2 };
const HOUSE_Z = 112;
const HOUSE_TOP = 168;
const DUCT_TOP = 150;
{
  for (const [x, y] of k.corners(HOUSE, 3)) boxAt("base", { x: x - 2.5, y: y - 2.5, w: 5, d: 5, r: 0.6 }, 0, HOUSE_Z, { tone: "mid" }, { name: "base.house-leg", ground: true });
  const face = HOUSE.x + HOUSE.w;
  /* Filter cells: columns on the inlet face, and the rows of weather hoods as seams round the visible faces. */
  const grid = [];
  for (let y = HOUSE.y + 10; y < HOUSE.y + HOUSE.d - 2; y += 10) grid.push(k.segment([face, y, HOUSE_Z], [face, y, HOUSE_TOP], P));
  const rows = [];
  for (let z = HOUSE_Z + 11; z < HOUSE_TOP - 2; z += 11) rows.push(k.sideSeam(HOUSE, z, P, 3));
  boxAt("base", HOUSE, HOUSE_Z, HOUSE_TOP - HOUSE_Z, { tone: "hi" }, { name: "base.filter-house", bevel: 0.8, steps: 3, extra: Ln(grid.join(""), { tone: "lo" }) + Ln(rows.join(""), { tone: "lo" }) });
  const PLENUM = { x: -46, y: -30, w: 20, d: 60, r: 1.5 };
  boxAt("inlet", PLENUM, SZ + 30.05, 18, { tone: "mid" }, { name: "inlet.plenum" });
  const DROP = { x: -43, y: -18, w: 14, d: 34, r: 1 };
  boxAt("inlet", DROP, SZ + 48, DUCT_TOP - SZ - 48 - 26, { tone: "hi" }, { name: "inlet.drop" });
  const RUN = { x: -43, y: HOUSE.y + HOUSE.d + 5, w: 14, d: 16 - HOUSE.y - HOUSE.d - 5, r: 1 };
  boxAt("inlet", RUN, DUCT_TOP - 26, 26, { tone: "hi" }, { name: "inlet.run" });
  boxAt("inlet", { x: -44.5, y: HOUSE.y + HOUSE.d, w: 17, d: 5, r: 0.8 }, DUCT_TOP - 27.5, 29, { tone: "mid" }, { name: "inlet.expansion-joint" });
}

/* ================================================================== */
/* Exhaust: diffuser, collector, stack                                 */
/* ================================================================== */

{
  const F = shaftFrame(106);
  const diffuser = Array.from({ length: 10 }, (_, index) => [index * 3.6, 30 + (index / 9) * 7, index > 0 && index < 9 ? 1 : 0]);
  turned("exhaust", F, diffuser, { tone: "hi" }, { name: "exhaust.diffuser", inner: G.arcOf(F, 16, 33.5, P, { slope: 0.216 }) });
  const BOX = { x: 138, y: -42, w: 44, d: 84, r: 2 };
  const face = BOX.y + BOX.d;
  const stiff = [];
  for (let x = BOX.x + 11; x < BOX.x + BOX.w - 2; x += 11) stiff.push(k.segment([x, face, FOUND_TOP], [x, face, FOUND_TOP + 86], P));
  const door = [[BOX.x + 16, face, FOUND_TOP + 10], [BOX.x + 28, face, FOUND_TOP + 10], [BOX.x + 28, face, FOUND_TOP + 30], [BOX.x + 16, face, FOUND_TOP + 30]].map(at);
  const hinge = [at([BOX.x + 16.8, face, FOUND_TOP + 13]), at([BOX.x + 16.8, face, FOUND_TOP + 27]), at([BOX.x + 26.6, face, FOUND_TOP + 20])];
  boxAt("exhaust", BOX, FOUND_TOP, 86, { tone: "mid" }, {
    name: "exhaust.collector",
    extra: Ln(k.sideSeam(BOX, FOUND_TOP + 42, P, 3), { tone: "faint" }) + Ln(stiff.join(""), { tone: "faint" }) + Ln(k.pathOf(door, true), { tone: "lo" }) + Dots(hinge, { size: 0.5, tone: "mid" }),
  });
  const STACK = upFrame(160, 0, 0);
  const stackTop = 244;
  /* The platform rings the stack, so the stack is drawn as the run below it and the run above it. */
  turned("exhaust", STACK, [[FOUND_TOP + 86, 22], [196, 22]], { tone: "hi" }, { name: "exhaust.stack", inner: [140, 172].map((z) => G.arcOf(STACK, z, 22, P)).join("") });
  turned("exhaust", STACK, [[198, 22], [stackTop - 6, 22]], { tone: "hi" }, { name: "exhaust.stack-top", inner: G.arcOf(STACK, 220, 22, P) });
  turned("exhaust", STACK, [[stackTop - 6, 23.5], [stackTop, 23.5]], { tone: "mid" }, { name: "exhaust.stack-lip" });
  /* Rest platform part-way up, and a ladder on the side turned to the reader. */
  {
    const id = nameFor("exhaust.platform");
    put("exhaust", [160, 0, 197], S(G.ringBand(196, 198, 22, 30, STACK, P), { tone: "mid" }), { name: id, shapes: [record(A.ring(STACK, 196, 198, 22, 30, { name: id }))] });
  }
  const ladder = [FACING - 0.32, FACING - 0.18].map((a) => [160 + Math.cos(a) * 24.5, Math.sin(a) * 24.5]);
  const rails = ladder.map(([x, y]) => k.segment([x, y, FOUND_TOP + 88], [x, y, 196], P));
  const rungs = [];
  for (let z = FOUND_TOP + 92; z < 196; z += 4) rungs.push(k.segment([ladder[0][0], ladder[0][1], z], [ladder[1][0], ladder[1][1], z], P));
  /* The rails end in their fixings under the platform. */
  const fixings = Dots(ladder.map(([x, y]) => at([x, y, 196])), { size: 0.55, tone: "mid" });
  put("exhaust", [160 + Math.cos(FACING) * 25, Math.sin(FACING) * 25, 150], Ln(rungs.join(""), { tone: "lo" }) + Ln(rails.join(""), { tone: "mid" }) + fixings, {
    bias: 2,
    name: "exhaust.ladder",
    shapes: ladder.map(([x, y]) => A.tube([[x, y, FOUND_TOP + 88], [x, y, 196]], 0.4, { name: "exhaust.ladder" })),
  });
}

/* ================================================================== */
/* Coupling                                                            */
/* ================================================================== */

{
  const F = shaftFrame(-50);
  disc("rotor", F, -3, 0, 9, { tone: "hi" }, { name: "rotor.coupling-gen", extra: Dots(G.dotsOf(F, 0, 6.6, 8, P, { all: true }), { size: 0.42 }) });
  disc("rotor", F, 0, 3, 9, { tone: "hi" }, { name: "rotor.coupling-gt", extra: Dots(G.dotsOf(F, 3, 6.6, 8, P, { all: true }), { size: 0.42 }) });
  halfShell("coupling", -53.5, -46.5, 13, true, { tone: "mid" }, { name: "coupling.cover", wall: 1, owner: "coupling.guard" });
  for (const side of [-1, 1]) boxAt("coupling", { x: -53.5, y: side > 0 ? 12 : -13, w: 7, d: 1, r: 0.2 }, FOUND_TOP, SZ - FOUND_TOP, { tone: "mid" }, { name: "coupling.skirt", owner: "coupling.guard", bevel: 0 });
}

/* ================================================================== */
/* Lube oil skid                                                       */
/* ================================================================== */

const LUBE = { x: -42, y: 46, w: 46, d: 28, r: 1.5 };
{
  boxAt("lube", { ...LUBE, x: LUBE.x - 2, y: LUBE.y - 2, w: LUBE.w + 4, d: LUBE.d + 4 }, 0, 3, { tone: "lo" }, { name: "lube.frame", ground: true });
  boxAt("lube", LUBE, 3, 19, { tone: "hi" }, { name: "lube.tank", extra: Ln(k.sideSeam(LUBE, 18, P, 3), { tone: "faint" }) });
  for (const x of [-36, -22]) {
    const F = upFrame(x, 52, 0);
    turned("lube", F, [[22, 3.6], [25, 3.6]], { tone: "mid" }, { name: "lube.pump" });
    turned("lube", F, [[25, 4.4], [34, 4.4]], { tone: "hi" }, { name: "lube.motor", extra: Faded(G.ribsOf(F, 25.5, 33.5, 4.4, 20, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
    turned("lube", F, [[34, 2.6], [36, 2.6]], { tone: "mid" }, { name: "lube.fan-cowl" });
  }
  for (const x of [-10, -2]) {
    const F = upFrame(x, 66, 0);
    turned("lube", F, [[22, 3.2], [33, 3.2], [33, 2.6], [35, 2.6]], { tone: "hi" }, { name: "lube.filter", inner: G.arcOf(F, 27, 3.2, P) });
  }
}

/* Feed to the generator bearing pedestal and to the compressor-end bearing on the inlet support, drain back. */
pipe("lube", [[-2, 66, 35], [-2, 66, 46], [-2, 38, 46], [-58, 38, 46], [-58, 11, 46]], 1.5, { bend: 3, name: "lube.feed-gen", free: [false, true] });
/* The compressor-end bearing's oil block, on the outer face of the inlet support, clear below the casing. */
boxAt("base", { x: -36, y: 24, w: 10, d: 3, r: 0.4 }, 28, 10, { tone: "mid" }, { name: "base.bearing-block" });
/* Up from the tank's top between the pump motors, then level over the foundation into the block, turning only in
 * the upright plane x = −29, so the bend keeps its curve on screen. */
pipe("lube", [[-29, 48.5, 22], [-29, 48.5, 33], [-29, 27, 33]], 1.5, { bend: 3, name: "lube.feed-gt", free: [false, true] });
pipe("lube", [[-59, 11, 32], [-59, 52, 32], [-59, 52, 10], [-42, 52, 10]], 2.2, { bend: 2.6, name: "lube.drain", free: [true, false] });

/* ================================================================== */
/* Fuel gas skid                                                       */
/* ================================================================== */

const FUEL = { x: 104, y: 52, w: 48, d: 24, r: 1.2 };
{
  boxAt("fuel", FUEL, 0, 3, { tone: "lo" }, { name: "fuel.frame", ground: true });
  /* One support between the stop valve and the control valve, carrying the run. */
  boxAt("fuel", { x: 129, y: 61, w: 4, d: 6, r: 0.5 }, 3, 9.2, { tone: "mid" }, { name: "fuel.pipe-support" });
}
const BURNER_PORT = [SILO[0] + 5, SILO[1], SILO_TOP + 14];
pipe(
  "fuel",
  [[146, 64, 3], [146, 64, 14], [112, 64, 14], [112, 64, 228], [112, SILO[1], 228], [76, SILO[1], 228], [76, SILO[1], BURNER_PORT[2]], BURNER_PORT],
  1.8,
  /* Stop valve, then control valve, on the run across the skid (positions are lengths along the line). */
  { bend: 3, valves: [[18, [0, 0, 1]], [34, [0, 0, 1]]], name: "fuel.gas-line", free: [false, true], maxLength: 18, touch: ["fuel.pipe-support*"] },
);

/* ================================================================== */
/* Local gauge panel: speed and output                                 */
/* ================================================================== */

const PANEL = { x: 12, y: 58, w: 26, d: 2.4, r: 0.4 };
const PANEL_Z = 26;
const PANEL_TOP = 56;
const GAUGES = [
  { id: "rpm", x: 18.5, max: 3600, major: 600 },
  { id: "mw", x: 31.5, max: 100, major: 20 },
];
const GAUGE_Z = 44;
const GAUGE_R = 5;
/** Dials sweep clockwise from the lower left (zero) through the top to the lower right (full scale). */
const DIAL_FROM = 225 * DEG;
const DIAL_SPAN = 270 * DEG;
const gaugeData = [];
{
  for (const x of [PANEL.x + 3, PANEL.x + PANEL.w - 3]) boxAt("base", { x: x - 1.2, y: PANEL.y + 0.4, w: 2.4, d: 1.6, r: 0.3 }, 0, PANEL_Z, { tone: "mid" }, { name: "base.panel-leg", ground: true });
  const face = PANEL.y + PANEL.d;
  const marks = [];
  const majors = [];
  const needles = [];
  for (const gauge of GAUGES) {
    const c = [gauge.x, face, GAUGE_Z];
    const point = (angle, r) => at([c[0] + Math.cos(angle) * r, face, c[2] + Math.sin(angle) * r]);
    const steps = gauge.max / gauge.major;
    for (let index = 0; index <= steps * 5; index++) {
      const angle = DIAL_FROM - (DIAL_SPAN * index) / (steps * 5);
      const big = index % 5 === 0;
      (big ? majors : marks).push(k.pathOf([point(angle, GAUGE_R - 0.4), point(angle, GAUGE_R - (big ? 1.6 : 1))]));
    }
    marks.push(k.sideRing([c[0], face, c[2]], GAUGE_R, "y", P, 40));
    needles.push(`<path class="iso-line gt-needle" data-tone="lit" data-free="end" data-needle="${gauge.id}" d="${k.pathOf([point(DIAL_FROM, 0.8), point(DIAL_FROM, GAUGE_R - 1.2)])}"/>`);
    needles.push(Dots([at(c)], { size: 0.7, tone: "hi" }));
    const centre = at(c);
    gaugeData.push({ id: gauge.id, c: centre, max: gauge.max, r: GAUGE_R, from: DIAL_FROM, span: DIAL_SPAN });
  }
  const id = boxAt("base", PANEL, PANEL_Z, PANEL_TOP - PANEL_Z, { tone: "hi" }, { name: "base.gauge-panel", extra: Ln(marks.join(""), { tone: "lo" }) + Ln(majors.join(""), { tone: "mid" }) + needles.join("") });
  void id;
}

/* ================================================================== */
/* Settle, write                                                       */
/* ================================================================== */

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};

const scene = {
  W,
  H,
  back: back.join(""),
  front: groups.join(""),
  data: {
    W,
    H,
    V,
    EX: unit([1, 0, 0]),
    EY: unit([0, 1, 0]),
    EZ: unit([0, 0, 1]),
    camera: glCamera(P),
    pieces: Object.fromEntries(Object.entries(PIECES).map(([id, piece]) => [id, { name: piece.name, say: piece.say }])),
    stagger: STAGGER,
    spring: SPRING,
    order: ["generator", "coupling", "casing", "silo", "inlet", "exhaust", "lube", "fuel"],
    unitMw: UNIT_MW,
    stationMw: STATION_MW,
    rpm: RPM,
    gauges: gaugeData,
    window: { ...WINDOW, x: SILO[0], y: SILO[1], r: SILO_R },
    stackTop: [160, 0, 244],
    stackR: 22,
  },
};

const file = join(HERE, "scene.json");
writeFileSync(file, JSON.stringify(scene));
console.log("wrote scene.json", `${(JSON.stringify(scene).length / 1024).toFixed(0)} KB`, `${R.items.length} items`);

A.auditOrExit(R, P);
