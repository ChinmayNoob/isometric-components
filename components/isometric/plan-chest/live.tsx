"use client";

import * as React from "react";
import { translateAlong, type SolidPaths, type Tone } from "@/components/iso/iso-kit";
import { IsoFigure } from "@/components/iso/react/draw";
import { spring, useInView, useLoop, useReadout, type Spring } from "@/components/iso/react/live";
import { PlanChestContext } from "./state";
import { bodyOf, type Body } from "./frame";
import { DRAWER_COUNT, RUNNER, drawnSheets, readoutOf, valueTextOf, type Drawer } from "./model";
import { HEIGHT, P, TRAVEL, WIDTH } from "./view";

/** Bottom drawer first: a drawer that comes out hangs over the fronts below it, so it is painted after them. */
const ORDER = [5, 4, 3, 2, 1, 0];

type Part = keyof Body;
const SOLIDS: [Part, Tone][] = [
  ["floor", "lo"],
  ["wallL", "mid"],
  ["back", "mid"],
  ["stack", "hi"],
];
const LINES: [Part, Tone][] = [
  ["edges", "lo"],
  ["sheet", "mid"],
  ["title", "mid"],
  ["drawing", "mid"],
  ["marks", "mid"],
];
/** Printed text and pen ticks on a sheet may stop on the paper. */
const FREE = new Set<Part>(["marks"]);
const NEAR: [Part, Tone][] = [
  ["wallR", "mid"],
  ["runner", "lo"],
  ["slide", "mid"],
];

const TOUR_DELAY = 1.4;
const TOUR_RESUME = 3.6;
const TOUR_HOLD = 3.2;

const LABEL = "A steel plan chest with six drawers. The open drawer holds one drawing sheet for each item it stands for.";

function SolidSlot({ part, paths, tone }: { part: Part; paths: SolidPaths; tone: Tone }) {
  return (
    <g className="iso-solid" data-p={part}>
      <path className="iso-fill" d={paths.fill} />
      {paths.shades.map((d, shade) => (
        <path key={shade} className="iso-shade" data-shade={shade} d={d} />
      ))}
      <path className="iso-top" d={paths.top} />
      <path className="iso-line iso-crease" data-tone={tone === "hi" ? "lo" : "faint"} d={paths.crease} />
      <path className="iso-line iso-edge" data-tone={tone} d={paths.outline} />
    </g>
  );
}

function BodySlots({ body }: { body: Body }) {
  const solid = ([part, tone]: [Part, Tone]) => <SolidSlot key={part} part={part} paths={body[part] as SolidPaths} tone={tone} />;
  const line = ([part, tone]: [Part, Tone]) => <path key={part} className="iso-line" data-p={part} data-tone={tone} data-free={FREE.has(part) ? "" : undefined} d={body[part] as string} />;
  return (
    <>
      {SOLIDS.map(solid)}
      {LINES.map(line)}
      {NEAR.map(solid)}
    </>
  );
}

function writeBody(group: Element | null, body: Body) {
  if (!group) return;
  for (const node of group.querySelectorAll<SVGElement>("[data-p]")) {
    const value = body[node.dataset.p as Part];
    if (typeof value === "string") {
      node.setAttribute("d", value);
      continue;
    }
    const [fill, s0, s1, s2, s3, top, crease, edge] = Array.from(node.children);
    fill!.setAttribute("d", value.fill);
    [s0, s1, s2, s3].forEach((shade, index) => shade!.setAttribute("d", value.shades[index] ?? ""));
    top!.setAttribute("d", value.top);
    crease!.setAttribute("d", value.crease);
    edge!.setAttribute("d", value.outline);
  }
}

const drawerAt = (target: EventTarget | null) => {
  const found = (target as Element | null)?.closest?.("[data-drawer]")?.getAttribute("data-drawer");
  return found == null ? null : Number(found);
};

type LiveProps = {
  carcass: React.ReactNode;
  top: React.ReactNode;
  fronts: React.ReactNode[];
  openings: string[];
  drawers: Drawer[];
  defaultOpen: number | null;
};

export function PlanChestLive({ carcass, top, fronts, openings, drawers, defaultOpen }: LiveProps) {
  /* Shared state when a PlanChestProvider is above the chest, its own state otherwise. */
  const shared = React.useContext(PlanChestContext);
  const [own, setOwn] = React.useState<number | null>(defaultOpen);
  const open = shared ? shared.open : own;
  const setOpen = shared ? shared.setOpen : setOwn;
  const sheets = React.useMemo(() => drawers.map(drawnSheets), [drawers]);
  const { anchor, say } = useReadout<HTMLDivElement>();
  const visible = useInView(anchor);

  /* The first render is the rest pose for whatever phase is open, on the server and the client alike. */
  const [rest] = React.useState(() => drawers.map((_, index): number => (index === open ? 1 : 0)));
  const [restBodies] = React.useState(() => rest.map((share, index) => bodyOf(index, share * TRAVEL, sheets[index]!)));

  const groups = React.useRef<(SVGGElement | null)[]>([]);
  const state = React.useRef({
    share: rest.map((at): Spring => ({ at, rate: 0 })),
    drawn: [...rest],
    committed: open,
    hover: null as number | null,
    mute: null as number | null,
    focus: false,
    chose: false,
    touched: false,
    idle: 0,
    clock: 0,
    lit: undefined as number | null | undefined,
  });

  const kick = useLoop((dt, calm) => {
    const s = state.current;
    s.idle += dt;
    const touring = !calm && !s.chose && s.hover === null && !s.focus && s.idle > (s.touched ? TOUR_RESUME : TOUR_DELAY);
    if (touring) s.clock += dt;
    const target = s.hover ?? (touring ? Math.floor(s.clock / TOUR_HOLD + 1) % DRAWER_COUNT : s.committed);

    let moving = false;
    s.share.forEach((runner, index) => {
      const goal = index === target ? 1 : 0;
      if (calm) {
        runner.at = goal;
        runner.rate = 0;
      } else if (!spring(runner, goal, dt, RUNNER.stiffness, RUNNER.damping)) {
        moving = true;
      }
      /* The runners end on stops: a drawer can't pass fully open or go back into the carcass. */
      if (runner.at > 1 || runner.at < 0) {
        runner.at = Math.min(1, Math.max(0, runner.at));
        runner.rate = 0;
      }
      if (Math.abs(runner.at - s.drawn[index]!) < 5e-4 && !(runner.at === goal && s.drawn[index] !== goal)) return;
      s.drawn[index] = runner.at;
      const travel = runner.at * TRAVEL;
      const group = groups.current[index];
      if (!group) return;
      const { inside, outside } = bodyOf(index, travel, sheets[index]!);
      writeBody(group.querySelector("[data-side='inside']"), inside);
      writeBody(group.querySelector("[data-side='outside']"), outside);
      group.querySelector(".pc-front")?.setAttribute("transform", translateAlong(P, [0, travel, 0]));
    });

    if (s.lit !== target) {
      s.lit = target;
      groups.current.forEach((group, index) => {
        const panel = group?.querySelector(".pc-panel");
        if (index === target) panel?.setAttribute("data-lit", "");
        else panel?.removeAttribute("data-lit");
      });
    }

    const settled = target !== null && s.share[target]!.at === 1 && s.share[target]!.rate === 0;
    say(readoutOf(drawers, target, settled));
    return moving || (!calm && !s.chose);
  }, visible);

  /* A drawer opened from outside (a linked list) counts as the reader's choice, and ends the tour. */
  const seen = React.useRef(open);
  React.useEffect(() => {
    const s = state.current;
    s.committed = open;
    if (seen.current !== open) {
      seen.current = open;
      s.chose = true;
    }
    kick();
  }, [open, kick]);

  const touch = () => {
    const s = state.current;
    s.idle = 0;
    s.touched = true;
    kick();
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (event.pointerType === "touch") return;
    const index = drawerAt(event.target);
    const s = state.current;
    if (index === null || index === s.mute) return;
    s.mute = null;
    if (index !== s.hover) {
      s.hover = index;
      touch();
    }
  };

  const onPointerLeave = () => {
    const s = state.current;
    s.hover = null;
    s.mute = null;
    touch();
  };

  const choose = (index: number | null) => {
    state.current.chose = true;
    setOpen(index);
    touch();
  };

  const onClick = (event: React.MouseEvent) => {
    const index = drawerAt(event.target);
    if (index === null) return;
    const s = state.current;
    /* After a click the committed drawer shows, even under the pointer, until the pointer moves to another drawer. */
    s.hover = null;
    s.mute = index;
    choose(open === index ? null : index);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = DRAWER_COUNT - 1;
    const from = open ?? -1;
    const keys: Record<string, () => number | null> = {
      ArrowDown: () => Math.min(last, from + 1),
      ArrowRight: () => Math.min(last, from + 1),
      ArrowUp: () => Math.max(0, from - 1),
      ArrowLeft: () => Math.max(0, from - 1),
      Home: () => 0,
      End: () => last,
      Escape: () => null,
    };
    const next = keys[event.key];
    if (!next) return;
    event.preventDefault();
    state.current.hover = null;
    choose(next());
  };

  return (
    <div
      ref={anchor}
      className="pc"
      tabIndex={0}
      role="slider"
      aria-label="A plan chest of six drawers. Arrow keys open the next or previous drawer, Escape closes it."
      aria-valuemin={0}
      aria-valuemax={DRAWER_COUNT}
      aria-valuenow={open === null ? 0 : open + 1}
      aria-valuetext={valueTextOf(drawers, open)}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={() => {
        state.current.focus = true;
        touch();
      }}
      onBlur={() => {
        state.current.focus = false;
        touch();
      }}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={LABEL}>
        <defs>
          {openings.map((d, index) => (
            <clipPath key={index} id={`pc-open-${index}`}>
              <path d={d} />
            </clipPath>
          ))}
        </defs>
        {carcass}
        {ORDER.map((index) => (
          <g
            key={index}
            data-drawer={index}
            className="pc-drawer"
            ref={(node) => {
              groups.current[index] = node;
            }}
          >
            <path className="pc-cavity" d={openings[index]} />
            <g data-side="inside" clipPath={`url(#pc-open-${index})`}>
              <BodySlots body={restBodies[index]!.inside} />
            </g>
            <g data-side="outside">
              <BodySlots body={restBodies[index]!.outside} />
            </g>
            <g className="pc-front" transform={translateAlong(P, [0, rest[index]! * TRAVEL, 0])}>
              {fronts[index]}
            </g>
          </g>
        ))}
        {top}
      </IsoFigure>
    </div>
  );
}
