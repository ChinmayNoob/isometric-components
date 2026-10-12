/*
 * What is drawn on the top sheet of each drawer, one drawing per phase: a contour survey, a bill of quantities, a bid
 * tabulation, a portal frame elevation, a programme and a commissioning checklist. Coordinates are [x, v] on the
 * sheet, with v measured back from the front border. Lines either end on a frame drawn with them or stand for text.
 */

export type Polyline = [number, number][];
/** `lines` end on a frame drawn with them; `marks` stand for printed text and pen ticks, and may stop on the paper. */
export type Drawing = { lines: Polyline[]; marks: Polyline[] };

/** The drawing area, left of the title block. */
export const AREA = { x0: -100, x1: 54, v0: 8, v1: 84 };

const rect = (x0: number, v0: number, x1: number, v1: number): Polyline => [
  [x0, v0],
  [x1, v0],
  [x1, v1],
  [x0, v1],
  [x0, v0],
];

function contours(): Drawing {
  const out: Polyline[] = [];
  const [cx, cv] = [-24, 44];
  for (let ring = 0; ring < 6; ring++) {
    const r = 7 + ring * 8;
    const line: Polyline = [];
    for (let step = 0; step <= 72; step++) {
      const t = (step / 72) * Math.PI * 2;
      const wobble = 1 + 0.14 * Math.sin(3 * t + ring * 0.7) + 0.06 * Math.cos(5 * t - ring);
      line.push([cx + Math.cos(t) * r * 1.7 * wobble, cv + Math.sin(t) * r * 0.85 * wobble]);
    }
    out.push(line);
  }
  return { lines: [rect(AREA.x0, AREA.v0, AREA.x1, AREA.v1), ...out], marks: [] };
}

function quantities(): Drawing {
  const [x0, x1, v0, v1] = [-96, 50, 12, 80];
  const out: Polyline[] = [rect(x0, v0, x1, v1)];
  for (let v = v0 + 7; v < v1; v += 7) out.push([[x0, v], [x1, v]]);
  for (const x of [x0 + 16, x1 - 46, x1 - 26]) out.push([[x, v0], [x, v1]]);
  return { lines: out, marks: [] };
}

function tabulation(): Drawing {
  const [x0, x1, v0, v1] = [-96, 50, 12, 80];
  const out: Polyline[] = [rect(x0, v0, x1, v1)];
  const columns = [x0 + 40, x0 + 67, x0 + 94, x0 + 121];
  for (const x of columns) out.push([[x, v0], [x, v1]]);
  out.push([[x0, v1 - 9], [x1, v1 - 9]]);
  /* One bar per bidder, of differing length: a picture of a tabulation, not data. */
  const rates = [0.78, 0.86, 0.62, 0.94];
  rates.forEach((rate, index) => {
    const left = columns[index]! - 23;
    out.push(rect(left, v0 + 4, left + 8, v0 + 4 + rate * 48));
  });
  return { lines: out, marks: [] };
}

function frame(): Drawing {
  const [left, right, ground, eave, ridge] = [-82, 32, 16, 50, 66];
  const out: Polyline[] = [
    rect(AREA.x0, AREA.v0, AREA.x1, AREA.v1),
    [[AREA.x0, ground], [AREA.x1, ground]],
    [[left, ground], [left, eave]],
    [[right, ground], [right, eave]],
    [[left, eave], [(left + right) / 2, ridge], [right, eave]],
    [[left, eave], [right, eave]],
  ];
  /* Truss web between the bottom chord and the rafters. */
  const bays = 8;
  const web: Polyline = [];
  for (let bay = 0; bay <= bays; bay++) {
    const x = left + ((right - left) * bay) / bays;
    const top = eave + (ridge - eave) * (1 - Math.abs(x - (left + right) / 2) / ((right - left) / 2));
    web.push([x, bay % 2 ? top : eave]);
  }
  out.push(web);
  for (const x of [left, right]) out.push(rect(x - 4, ground, x + 4, ground + 1.6));
  return { lines: out, marks: [] };
}

function programme(): Drawing {
  const [x0, x1, v0, v1] = [-96, 50, 12, 80];
  const out: Polyline[] = [rect(x0, v0, x1, v1), [[x0 + 30, v0], [x0 + 30, v1]]];
  const bars = [
    [0, 26],
    [14, 48],
    [30, 70],
    [44, 92],
    [60, 104],
    [80, 114],
  ];
  const marks: Polyline[] = [];
  bars.forEach(([from, to], row) => {
    const v = v1 - 7 - row * 10.5;
    out.push(rect(x0 + 34 + from!, v - 3, x0 + 34 + to!, v + 1));
    marks.push([[x0 + 4, v - 1], [x0 + (row % 2 ? 20 : 25), v - 1]]);
  });
  return { lines: out, marks };
}

function checklist(): Drawing {
  const out: Polyline[] = [];
  const marks: Polyline[] = [];
  for (let row = 0; row < 6; row++) {
    const v = 76 - row * 11;
    const x = -92;
    out.push(rect(x, v - 4, x + 5, v + 1));
    if (row < 4) marks.push([[x + 1, v - 1.5], [x + 2.2, v - 3], [x + 4.4, v + 0.2]]);
    marks.push([[x + 10, v - 1.5], [x + (row % 3 === 1 ? 70 : 110), v - 1.5]]);
  }
  return { lines: out, marks };
}


/** Cut a polyline to a rectangle (Liang-Barsky per segment), so contours end on the border they run into. */
export function clipToArea(line: Polyline, { x0, x1, v0, v1 } = AREA): Polyline[] {
  const out: Polyline[] = [];
  let run: Polyline = [];
  for (let index = 0; index + 1 < line.length; index++) {
    const [ax, av] = line[index]!;
    const [bx, bv] = line[index + 1]!;
    const dx = bx - ax;
    const dv = bv - av;
    let t0 = 0;
    let t1 = 1;
    const sides: [number, number][] = [
      [-dx, ax - x0],
      [dx, x1 - ax],
      [-dv, av - v0],
      [dv, v1 - av],
    ];
    let inside = true;
    for (const [p, q] of sides) {
      if (p === 0) {
        if (q < 0) inside = false;
        continue;
      }
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
    if (!inside || t0 > t1) {
      if (run.length > 1) out.push(run);
      run = [];
      continue;
    }
    const start: [number, number] = [ax + dx * t0, av + dv * t0];
    const end: [number, number] = [ax + dx * t1, av + dv * t1];
    if (!run.length || t0 > 0) {
      if (run.length > 1) out.push(run);
      run = [start];
    }
    run.push(end);
    if (t1 < 1) {
      out.push(run);
      run = [];
    }
  }
  if (run.length > 1) out.push(run);
  return out;
}

/* Clipped to the drawing area, so a contour that runs out of it ends on the border drawn round it. */
const clipped = (lines: Polyline[]) => lines.flatMap((line) => clipToArea(line));

export const DRAWINGS: Drawing[] = [contours(), quantities(), tabulation(), frame(), programme(), checklist()].map(({ lines, marks }) => ({
  lines: clipped(lines),
  marks: clipped(marks),
}));
