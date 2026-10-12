"use client";

import * as React from "react";
import { glLayer as glLayerJs, settle } from "@/components/iso/gl.mjs";
import { useInView, useLoop, useReadout } from "@/components/iso/react/live";
import { FLAME, type FlameData } from "./flame";

/*
 * Moves the generated scene and runs the unit.
 *
 * Explode: one spring per assembly, opened and closed in the staggered order the build settled the painter's keys
 * for, items re-sorted each frame by key + lift × share, and a selection that lights one assembly.
 *
 * Run: a start sequence over three physical quantities, each on a critically damped envelope: shaft speed (a
 * fraction of 3000 rpm), electrical output (MW) and fuel (which sets the flame). Phases change when a quantity
 * arrives, never on a timer alone, so the gauges, the readout and the flame always agree. The machine is put back
 * together before it starts, and stays together while it runs.
 */

type Piece = { name: string; say: string };
type Gauge = { id: string; c: number[]; max: number; r: number; from: number; span: number };
export type SceneData = {
  W: number;
  H: number;
  V: number[];
  EX: number[];
  EY: number[];
  EZ: number[];
  camera: unknown;
  pieces: Record<string, Piece>;
  stagger: string[];
  spring: { stagger: number; stiffness: number; damping: number; substeps: number };
  order: string[];
  unitMw: number;
  stationMw: number;
  rpm: number;
  gauges: Gauge[];
  window: FlameData;
};

type Node = { el: SVGGElement; piece: string; key: number; m: number[]; lift: number; shown: string };
type Spring = { x: number; v: number; target: number; pending: { value: number; at: number } | null };
type Level = { x: number; v: number };

/** The kit's WebGL layer, with the signature its documentation gives (the JS defaults narrow the inferred one). */
type Uniform = number | number[];
type Layer = { set: (values: Record<string, Uniform>) => void; draw: (values: Record<string, Uniform>, time: number) => void; clear: () => void };
const glLayer = glLayerJs as unknown as (options: {
  canvas: HTMLCanvasElement;
  fragment: string;
  view: number[];
  camera: unknown;
  uniforms?: string[];
  fixed?: Record<string, Uniform>;
}) => Layer | null;

type Phase = "cold" | "arming" | "cranking" | "purging" | "ignition" | "accelerating" | "synchronising" | "loading" | "full load" | "unloading" | "flame out" | "coasting";

/** Purge and ignition speed, as a share of rated speed: typical of heavy-duty units, not a 13D2 figure. */
const CRANK = 0.2;
/** Loading and unloading go at a fixed rate, as a unit's load controller does; time-compressed here, MW per second. */
const LOAD_RATE = 18;
const HOLD: Partial<Record<Phase, number>> = { purging: 1.6, ignition: 0.9, synchronising: 1.4, "flame out": 0.7 };
const LEAVE = 0.45;

const WORDS: Record<Phase, string> = {
  cold: "cold",
  arming: "closing up · arming",
  cranking: "cranking",
  purging: "purging",
  ignition: "ignition",
  accelerating: "accelerating",
  synchronising: "synchronising",
  loading: "loading",
  "full load": "full load",
  unloading: "unloading",
  "flame out": "breaker open · flame out",
  coasting: "coasting down",
};

export function GasTurbineLive({ data, children }: { data: SceneData; children: React.ReactNode }) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const visible = useInView(anchor);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [apart, setApartState] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [announce, setAnnounce] = React.useState("");
  const picked = React.useRef<string | null>(null);

  const state = React.useRef({
    nodes: [] as Node[],
    order: [] as number[],
    springs: Object.fromEntries(Object.keys(data.pieces).map((id) => [id, { x: 0, v: 0, target: 0, pending: null } as Spring])),
    clock: 0,
    apart: false,
    leaveAt: -1,
    machine: null as SVGGElement | null,
    needles: {} as Record<string, SVGPathElement | null>,
    phase: "cold" as Phase,
    since: 0,
    speed: { x: 0, v: 0 } as Level,
    load: { x: 0, v: 0 } as Level,
    fuel: { x: 0, v: 0 } as Level,
    shown: { rpm: -1, mw: -1 },
    layer: null as ReturnType<typeof glLayer> | null,
    painted: false,
  });

  /* Collect the generated items, the gauge needles and the flame layer once the server markup is in the DOM. */
  React.useEffect(() => {
    const root = anchor.current;
    const s = state.current;
    s.machine = root?.querySelector<SVGGElement>(".gt-machine") ?? null;
    s.nodes = [...(s.machine?.querySelectorAll<SVGGElement>(".it") ?? [])].map((el) => {
      const m = (el.dataset.m ?? "0,0,0").split(",").map(Number);
      return { el, piece: el.dataset.piece ?? "base", key: Number(el.dataset.k), m, lift: m[0]! * data.V[0]! + m[1]! * data.V[1]! + m[2]! * data.V[2]!, shown: "" };
    });
    s.order = s.nodes.map((_, index) => index);
    for (const gauge of data.gauges) s.needles[gauge.id] = root?.querySelector<SVGPathElement>(`[data-needle="${gauge.id}"]`) ?? null;

    const canvas = root?.querySelector<HTMLCanvasElement>(".gt-gl");
    const light = () => (document.documentElement.classList.contains("dark") ? 0 : 1);
    if (canvas) {
      s.layer = glLayer({
        canvas,
        fragment: FLAME,
        view: [data.W, data.H],
        camera: data.camera,
        uniforms: ["uFire"],
        fixed: {
          uSilo: [data.window.x, data.window.y, data.window.liner, data.window.r],
          uWin: [data.window.a0, data.window.a1, data.window.z0, data.window.z1],
          uLight: light(),
        },
      });
      if (s.layer) root?.querySelector(".gt-stage")?.setAttribute("data-gl", "");
    }
    /* The demo flips the theme at runtime: keep the shader's ink in step. */
    const watch = new MutationObserver(() => {
      s.layer?.set({ uLight: light() });
      s.painted = false;
      kick();
    });
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, data]);

  const kick = useLoop((dt, calm) => {
    const s = state.current;
    s.clock += dt;
    if (s.leaveAt >= 0 && s.clock >= s.leaveAt) {
      s.leaveAt = -1;
      setApart(false);
    }
    const exploding = stepSprings(dt, calm);
    place();
    const runningNow = stepRun(dt, calm);
    drawGauges();
    drawFlame(calm);
    sayState();
    return exploding || runningNow || s.leaveAt >= 0;
  }, visible);

  function stepSprings(dt: number, calm: boolean) {
    const s = state.current;
    let moving = false;
    for (const spring of Object.values(s.springs)) {
      if (spring.pending && s.clock >= spring.pending.at) {
        spring.target = spring.pending.value;
        spring.pending = null;
      }
      if (calm) {
        spring.x = spring.target;
        spring.v = 0;
      } else {
        const { stiffness, damping, substeps } = data.spring;
        for (let step = 0; step < substeps; step++) {
          const h = dt / substeps;
          spring.v += ((spring.target - spring.x) * stiffness - spring.v * damping) * h;
          spring.x += spring.v * h;
        }
        if (Math.abs(spring.target - spring.x) < 2e-4 && Math.abs(spring.v) < 2e-4) {
          spring.x = spring.target;
          spring.v = 0;
        }
      }
      if (spring.x !== spring.target || spring.pending) moving = true;
    }
    return moving;
  }

  function place() {
    const s = state.current;
    for (const node of s.nodes) {
      const share = s.springs[node.piece]?.x ?? 0;
      const tx = (data.EX[0]! * node.m[0]! + data.EY[0]! * node.m[1]! + data.EZ[0]! * node.m[2]!) * share;
      const ty = (data.EX[1]! * node.m[0]! + data.EY[1]! * node.m[1]! + data.EZ[1]! * node.m[2]!) * share;
      const text = share === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
      if (text !== node.shown) {
        node.shown = text;
        if (text) node.el.setAttribute("transform", text);
        else node.el.removeAttribute("transform");
      }
    }
    const keyOf = (index: number) => {
      const node = s.nodes[index]!;
      return node.key + node.lift * (s.springs[node.piece]?.x ?? 0);
    };
    const next = s.nodes.map((_, index) => index).sort((a, b) => keyOf(a) - keyOf(b));
    if (s.machine && next.some((index, at) => index !== s.order[at])) {
      const fragment = document.createDocumentFragment();
      for (const index of next) fragment.appendChild(s.nodes[index]!.el);
      s.machine.appendChild(fragment);
      s.order = next;
    }
  }

  const homeAll = () => Object.values(state.current.springs).every((spring) => spring.x === 0 && spring.target === 0 && !spring.pending);

  function enter(phase: Phase) {
    const s = state.current;
    if (s.phase === phase) return;
    s.phase = phase;
    s.since = 0;
    const words: Partial<Record<Phase, string>> = {
      cranking: "Cranking",
      ignition: "Ignition, flame in the combustor",
      synchronising: `At ${data.rpm} rpm, synchronising`,
      loading: "Breaker closed, loading",
      "full load": `Full load, ${data.unitMw} megawatts`,
      "flame out": "Breaker open, flame out",
      cold: "Stopped, cold",
    };
    if (words[phase]) setAnnounce(words[phase]!);
    setRunning(phase !== "cold");
  }

  /** One frame of the start (or stop) sequence. Returns true while anything is still changing. */
  function stepRun(dt: number, calm: boolean) {
    const s = state.current;
    s.since += dt;
    const p = s.phase;
    const rated = data.unitMw;
    let speedGoal = 0;
    let loadGoal = 0;
    let fuelGoal = 0;
    switch (p) {
      case "arming":
        if (homeAll()) enter("cranking");
        break;
      case "cranking":
        speedGoal = CRANK;
        if (s.speed.x > CRANK - 0.004) enter("purging");
        break;
      case "purging":
        speedGoal = CRANK;
        if (s.since > HOLD.purging!) enter("ignition");
        break;
      case "ignition":
        speedGoal = CRANK;
        fuelGoal = 0.32;
        if (s.since > HOLD.ignition!) enter("accelerating");
        break;
      case "accelerating":
        speedGoal = 1;
        fuelGoal = 0.32 + 0.2 * s.speed.x;
        if (s.speed.x > 0.995) enter("synchronising");
        break;
      case "synchronising":
        speedGoal = 1;
        fuelGoal = 0.52;
        if (s.since > HOLD.synchronising!) enter("loading");
        break;
      case "loading":
        speedGoal = 1;
        loadGoal = rated;
        fuelGoal = 0.52 + 0.48 * (s.load.x / rated);
        if (s.load.x >= rated) enter("full load");
        break;
      case "full load":
        speedGoal = 1;
        loadGoal = rated;
        fuelGoal = 1;
        break;
      case "unloading":
        speedGoal = 1;
        loadGoal = 0;
        fuelGoal = 0.52 + 0.48 * (s.load.x / rated);
        if (s.load.x <= 0) enter("flame out");
        break;
      case "flame out":
        speedGoal = 1;
        if (s.since > HOLD["flame out"]!) enter("coasting");
        break;
      case "coasting":
        if (s.speed.x < 0.002) enter("cold");
        break;
      default:
        break;
    }
    /* Reduced motion: no run-up to watch; the unit jumps to the steady state of where it is going. */
    if (calm && p !== "cold" && p !== "arming" && p !== "full load") {
      const stopping = p === "unloading" || p === "flame out" || p === "coasting";
      s.speed.x = stopping ? 0 : 1;
      s.load.x = stopping ? 0 : rated;
      s.fuel.x = stopping ? 0 : 1;
      enter(stopping ? "cold" : "full load");
      return false;
    }
    const a = settle(s.speed, speedGoal, dt, p === "coasting" ? 2 : p === "accelerating" ? 0.95 : 0.6, calm);
    const before = s.load.x;
    s.load.x = calm ? loadGoal : loadGoal > before ? Math.min(loadGoal, before + LOAD_RATE * dt) : Math.max(loadGoal, before - LOAD_RATE * dt);
    const b = s.load.x !== before;
    const c = settle(s.fuel, fuelGoal, dt, p === "ignition" ? 0.18 : 0.6, calm);
    return a || b || c || (p !== "cold" && p !== "full load");
  }

  function drawGauges() {
    const s = state.current;
    const values: Record<string, number> = { rpm: s.speed.x * data.rpm, mw: s.load.x };
    for (const gauge of data.gauges) {
      const value = Math.max(0, Math.min(gauge.max, values[gauge.id] ?? 0));
      const rounded = Math.round(value * 10) / 10;
      if (s.shown[gauge.id as "rpm" | "mw"] === rounded) continue;
      s.shown[gauge.id as "rpm" | "mw"] = rounded;
      const angle = gauge.from - gauge.span * (value / gauge.max);
      const at = (r: number) => {
        const dx = Math.cos(angle) * r;
        const dz = Math.sin(angle) * r;
        return `${(gauge.c[0] + data.EX[0]! * dx + data.EZ[0]! * dz).toFixed(2)} ${(gauge.c[1] + data.EX[1]! * dx + data.EZ[1]! * dz).toFixed(2)}`;
      };
      s.needles[gauge.id]?.setAttribute("d", `M${at(0.8)}L${at(gauge.r - 1.2)}`);
    }
  }

  function drawFlame(calm: boolean) {
    const s = state.current;
    const fire = s.fuel.x;
    const stage = anchor.current?.querySelector<HTMLElement>(".gt-stage");
    stage?.style.setProperty("--gt-fire", fire.toFixed(3));
    if (fire > 0.002) stage?.setAttribute("data-firing", "");
    else stage?.removeAttribute("data-firing");
    if (!s.layer) return;
    if (fire > 0.001) {
      s.layer.draw({ uFire: fire }, calm ? 0.8 : s.clock);
      s.painted = true;
    } else if (s.painted) {
      s.layer.clear();
      s.painted = false;
    }
  }

  function sayState() {
    const s = state.current;
    const sel = picked.current;
    if (s.phase !== "cold") {
      const rpm = Math.round(s.speed.x * data.rpm);
      say(`${WORDS[s.phase]} · ${rpm.toLocaleString("en-US")} rpm · ${s.load.x.toFixed(2)} MW`);
    } else say(sel ? data.pieces[sel]!.say : s.apart ? `apart · ${data.order.length} assemblies` : "cold · assembled");
  }

  function setApart(on: boolean) {
    const s = state.current;
    if (on && s.phase !== "cold") return;
    if (s.apart === on) return;
    s.apart = on;
    setApartState(on);
    const goal = on ? 1 : 0;
    let index = 0;
    for (const id of on ? data.stagger : [...data.stagger].reverse()) {
      const spring = s.springs[id];
      if (!spring) continue;
      if (spring.target === goal && !spring.pending) continue;
      spring.pending = { value: goal, at: s.clock + index++ * data.spring.stagger };
    }
    kick();
  }

  function select(id: string | null) {
    const pick = id && data.order.includes(id) ? id : null;
    picked.current = pick;
    setSelected(pick);
    for (const node of state.current.nodes) {
      if (pick && node.piece === pick) node.el.setAttribute("data-on", "");
      else node.el.removeAttribute("data-on");
    }
    kick();
  }

  function start() {
    const s = state.current;
    select(null);
    s.leaveAt = -1;
    setApart(false);
    enter(homeAll() ? "cranking" : "arming");
    kick();
  }

  function stop() {
    const s = state.current;
    if (s.phase === "cold") return;
    if (s.phase === "arming") enter("cold");
    else if (s.load.x > 0.05) enter("unloading");
    else enter(s.fuel.x > 0.01 ? "flame out" : "coasting");
    kick();
  }

  const pieceAt = (target: EventTarget | null) => (target as Element | null)?.closest?.(".it")?.getAttribute("data-piece") ?? null;

  return (
    <div className="gt" ref={anchor}>
      <div
        className="gt-stage"
        tabIndex={0}
        role="slider"
        aria-label="Gas turbine generator set. Hover or use the arrow keys to take it apart assembly by assembly; Escape puts it back together; S starts and stops the unit."
        aria-valuemin={0}
        aria-valuemax={data.order.length}
        aria-valuenow={selected ? data.order.indexOf(selected) + 1 : 0}
        aria-valuetext={running ? "Running" : selected ? data.pieces[selected]!.say : apart ? "Apart" : "Assembled, cold"}
        data-focus={selected ? "" : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          state.current.leaveAt = -1;
          setApart(true);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "touch" || state.current.phase !== "cold") return;
          select(pieceAt(event.target));
        }}
        onPointerLeave={() => {
          state.current.leaveAt = state.current.clock + LEAVE;
          if (state.current.phase === "cold") select(null);
          kick();
        }}
        onClick={(event) => {
          if (state.current.phase !== "cold") return;
          if (!state.current.apart) setApart(true);
          select(pieceAt(event.target));
        }}
        onKeyDown={(event) => {
          const list = data.order;
          const current = picked.current;
          const at = current ? list.indexOf(current) : -1;
          if (event.key === "s" || event.key === "S") {
            event.preventDefault();
            if (state.current.phase === "cold") start();
            else stop();
            return;
          }
          if (state.current.phase !== "cold") return;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            setApart(true);
            select(list[(at + 1) % list.length]!);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            setApart(true);
            select(list[(at - 1 + list.length) % list.length]!);
          } else if (event.key === "Escape") {
            select(null);
            setApart(false);
          }
        }}
      >
        {children}
      </div>
      <div className="gt-controls">
        <button type="button" className="gt-run" data-state={running ? "on" : "off"} onClick={() => (running ? stop() : start())} aria-pressed={running}>
          <span className="gt-lamp" aria-hidden="true" />
          {running ? "Stop" : "Start"}
        </button>
        <div className="gt-parts">
          {data.order.map((id, index) => (
            <button
              key={id}
              type="button"
              className="gt-part"
              data-on={selected === id ? "" : undefined}
              disabled={running}
              onClick={() => {
                setApart(true);
                select(selected === id ? null : id);
              }}
            >
              <span className="gt-num">{String(index + 1).padStart(2, "0")}</span>
              {data.pieces[id]!.name}
            </button>
          ))}
        </div>
      </div>
      <span className="gt-sr" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
