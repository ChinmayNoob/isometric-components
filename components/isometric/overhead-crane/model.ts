import { BAIL, DRUM_Z, DRUM_R, HOOK_MAX, HOOK_MIN, HOOK_TRAVEL, LADLE_R, LADLE_TOP, RAIL_X, SPAN_UNITS, STANDS, STAND_TOP, TROLLEY_MAX, TROLLEY_MIN } from "./view";

/*
 * The crane's truth, with no DOM. Drawing units are converted to metres by the span the crane is given. The trolley
 * and the hoist move on trapezoidal profiles (top speed, constant acceleration); the hook hangs as a pendulum from the
 * drum, so the load swings when the trolley speeds up or slows down. The hook takes the ladle's bail when lifted up
 * through it and lets go once the ladle sits on a stand and the ropes go slack.
 */

/** Standard gravity in drawing units (10 units to a metre at the sample span). */
const G = 98.1;
/* Faster than a real foundry crane (about 0.5 m/s), so a lift fits a figure; acceleration near a real one, so the swing is true to size. */
const TROLLEY = { speed: 34, accel: 6 };
const HOIST = { speed: 22, accel: 40 };
/** Damping ratio of the swing. Foundry cranes carry anti-sway control; without it the ratio would be nearer 0.05. */
const SWING_DAMPING = 0.45;
/** Below the hook's bowl, the ladle's centre of mass hangs about this far further down. */
const LADLE_DROP = 20;

/** One move. `steady` waits for the load to stop swinging before the move starts, as a driver does before lowering. */
export type Step = { tx?: number; hz?: number; hold?: number; steady?: boolean };

export type Crane = {
  tx: number;
  tv: number;
  hz: number;
  hv: number;
  /** Swing angle of the ropes from vertical, radians, positive toward +x. */
  swing: number;
  spin: number;
  /** Ladle bottom centre. */
  lx: number;
  lz: number;
  hooked: boolean;
  target: { tx: number; hz: number };
  plan: Step[];
  hold: number;
};

export const initialCrane = (): Crane => ({
  tx: 0,
  tv: 0,
  hz: HOOK_TRAVEL,
  hv: 0,
  swing: 0,
  spin: 0,
  lx: STANDS[0]!,
  lz: STAND_TOP,
  hooked: false,
  target: { tx: 0, hz: HOOK_TRAVEL },
  plan: [],
  hold: 0,
});

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Where a ladle at x would rest: on a stand when over one, on the floor otherwise. */
export const restAt = (x: number) => (STANDS.some((stand) => Math.abs(x - stand) < 10) ? STAND_TOP : 0);

/** Length of rope from the drum to the hook's bowl, plus the ladle's hang when it is on the hook. */
const pendulumOf = (crane: Crane) => DRUM_Z - DRUM_R - crane.hz + (crane.hooked ? LADLE_DROP : 4);

/** The load hangs still enough to lower onto a bail or a stand: within 0.6 units of plumb and barely moving. */
const isSteady = (crane: Crane) => {
  const length = DRUM_Z - DRUM_R - crane.hz;
  return Math.abs(Math.sin(crane.swing) * length) < 0.6 && Math.abs(crane.spin * length) < 1;
};

/** Horizontal offset of the hook from below the trolley. */
export const hookX = (crane: Crane) => crane.tx + Math.sin(crane.swing) * (DRUM_Z - DRUM_R - crane.hz);

/** Keep the hook out of the ladle: inside the bail it may drop below the crossbar, elsewhere over the ladle it stays above the rim. */
function hookFloor(crane: Crane, x: number) {
  if (crane.hooked) return restAt(crane.lx) + BAIL - 4;
  const off = Math.abs(x - crane.lx);
  if (off < 2) return crane.lz + BAIL - 4;
  if (off < LADLE_R + 2) return crane.lz + LADLE_TOP + 2;
  return HOOK_MIN;
}

function drive(position: number, velocity: number, target: number, { speed, accel }: { speed: number; accel: number }, dt: number) {
  const error = target - position;
  if (Math.abs(error) < 1e-3 && Math.abs(velocity) < accel * dt) return { position: target, velocity: 0, accel: -velocity / dt };
  /* Top speed, or the speed from which constant braking stops exactly on the target. */
  const wanted = Math.sign(error) * Math.min(speed, Math.sqrt(2 * accel * Math.abs(error)));
  const change = clamp(wanted - velocity, -accel * dt, accel * dt);
  const next = velocity + change;
  const moved = position + next * dt;
  if ((target - moved) * error <= 0) return { position: target, velocity: 0, accel: -velocity / dt };
  return { position: moved, velocity: next, accel: change / dt };
}

export type Event = "hooked" | "released" | null;

/** Advance the crane by dt seconds. `calm` (reduced motion) moves straight to the targets with no swing. */
export function step(crane: Crane, dt: number, calm: boolean): Event {
  const waiting = crane.plan[0]?.steady && !isSteady(crane);
  const goal = waiting ? undefined : crane.plan[0];
  if (goal?.tx !== undefined) crane.target.tx = goal.tx;
  if (goal?.hz !== undefined) crane.target.hz = goal.hz;
  const before = crane.hz;
  const goalZ = clamp(crane.target.hz, Math.max(HOOK_MIN, hookFloor(crane, hookX(crane))), HOOK_MAX);
  const goalX = clamp(crane.target.tx, TROLLEY_MIN, TROLLEY_MAX);

  if (calm) {
    crane.tx = goalX;
    crane.tv = 0;
    crane.hz = goalZ;
    crane.hv = 0;
    crane.swing = 0;
    crane.spin = 0;
  } else {
    const trolley = drive(crane.tx, crane.tv, goalX, TROLLEY, dt);
    crane.tx = trolley.position;
    crane.tv = trolley.velocity;
    const hoist = drive(crane.hz, crane.hv, goalZ, HOIST, dt);
    crane.hz = hoist.position;
    crane.hv = hoist.velocity;
    /* Pendulum on a moving pivot: θ'' = −(g/L)·sin θ − (a/L)·cos θ − 2ζω·θ', sub-stepped for stability. */
    const length = pendulumOf(crane);
    const omega = Math.sqrt(G / length);
    const slices = Math.max(1, Math.ceil(dt * 240));
    const h = dt / slices;
    for (let slice = 0; slice < slices; slice++) {
      const theta = crane.swing;
      const alpha = -(G / length) * Math.sin(theta) - (trolley.accel / length) * Math.cos(theta) - 2 * SWING_DAMPING * omega * crane.spin;
      crane.spin += alpha * h;
      crane.swing += crane.spin * h;
    }
    if (Math.abs(crane.swing) < 2e-4 && Math.abs(crane.spin) < 2e-4) {
      crane.swing = 0;
      crane.spin = 0;
    }
  }

  const event = latch(crane, before);
  if (goal) {
    const done = (goal.tx === undefined || (crane.tx === goalX && crane.tv === 0)) && (goal.hz === undefined || (crane.hz === goalZ && crane.hv === 0));
    if (done) {
      crane.hold += dt;
      if (crane.hold >= (goal.hold ?? 0.35)) {
        crane.hold = 0;
        crane.plan.shift();
      }
    }
  }
  return event;
}

function latch(crane: Crane, before: number): Event {
  const hx = hookX(crane);
  if (crane.hooked) {
    crane.lx = hx;
    const rest = restAt(hx);
    crane.lz = Math.max(rest, crane.hz - BAIL);
    if (crane.hz < rest + BAIL - 1.5) {
      crane.hooked = false;
      crane.lx = Math.round(hx * 10) / 10;
      crane.lz = rest;
      return "released";
    }
    return null;
  }
  const bail = crane.lz + BAIL;
  if (Math.abs(hx - crane.lx) < 2 && before < bail && crane.hz >= bail) {
    crane.hooked = true;
    return "hooked";
  }
  return null;
}

/* ---------- Plans: the moves a crane driver makes for one lift ---------- */

/** The next lift: fetch the ladle if it is on a stand, or carry it to the other stand if it is on the hook. */
export function nextLift(crane: Crane): Step[] {
  if (crane.hooked) {
    const to = Math.abs(crane.lx - STANDS[0]!) < Math.abs(crane.lx - STANDS[1]!) ? STANDS[1]! : STANDS[0]!;
    const clear = to + (to < 0 ? 20 : -20);
    return [{ hz: HOOK_TRAVEL }, { tx: to }, { hz: STAND_TOP + BAIL - 4, steady: true }, { tx: clear }, { hz: HOOK_TRAVEL, hold: 0.8 }];
  }
  return [{ hz: HOOK_TRAVEL }, { tx: crane.lx }, { hz: crane.lz + BAIL - 4, steady: true }, { hz: HOOK_TRAVEL, hold: 0.8 }];
}

/* ---------- Readout ---------- */

export const metresOf = (units: number, span: number) => (units * span) / SPAN_UNITS;

export function readoutOf(crane: Crane, span: number) {
  const along = metresOf(crane.tx + RAIL_X, span).toFixed(1);
  const hook = metresOf(crane.hz, span).toFixed(1);
  return `trolley ${along} m · hook ${hook} m · ${crane.hooked ? "ladle on hook" : "hook free"}`;
}

export const isSettled = (crane: Crane) => crane.tv === 0 && crane.hv === 0 && crane.swing === 0 && crane.spin === 0 && !crane.plan.length;
