"use client";

import * as React from "react";
import { cameraOf, translateAlong } from "@/components/iso/iso-kit";
import { IsoFigure } from "@/components/iso/react/draw";
import { useInView, useLoop, useReadout } from "@/components/iso/react/live";
import { ropesOf } from "./frame";
import { hookX, initialCrane, isSettled, nextLift, readoutOf, step, type Crane } from "./model";
import { HEIGHT, HOOK_MAX, HOOK_MIN, P, STANDS, TROLLEY_MAX, TROLLEY_MIN, WIDTH } from "./view";

const TOUR_DELAY = 1.4;
const TOUR_RESUME = 4;

const LABEL =
  "An overhead travelling crane in a foundry bay: a bridge of two girders on end trucks running on runway rails, a trolley with a hoist drum, and a hook block on four rope falls. A ladle waits on a stand by the furnace; a second stand is by the mould line.";

type LiveProps = {
  span: number;
  back: React.ReactNode;
  nearGirder: React.ReactNode;
  front: React.ReactNode;
  trolleyBack: React.ReactNode;
  trolleyFront: React.ReactNode;
  hook: React.ReactNode;
  ladleBack: React.ReactNode;
  ladleFront: React.ReactNode;
  mouth: string;
  metal: string;
};

const placeOf = (x: number, z: number) => translateAlong(P, [x, 0, z]);
const standName = (x: number) => (Math.abs(x - STANDS[0]!) < 10 ? "the furnace stand" : Math.abs(x - STANDS[1]!) < 10 ? "the pouring stand" : "the floor");

/** Inverse of the projection on the plane y = 0: a point in the SVG to the hook's x and height. */
function hookAt(svg: SVGSVGElement, clientX: number, clientY: number) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  const { sinA, cosA, sinE, cosE, k } = cameraOf(P);
  const x = (point.x - P.origin[0]) / (sinA * k);
  const z = (x * cosA * sinE * k + P.origin[1] - point.y) / (cosE * k);
  return { x, z };
}

export function OverheadCraneLive(props: LiveProps) {
  const { span, mouth, metal } = props;
  const { anchor, say } = useReadout<HTMLDivElement>();
  const visible = useInView(anchor);
  const [rest] = React.useState(() => {
    const crane = initialCrane();
    return { crane, ropes: ropesOf(crane) };
  });

  const crane = React.useRef<Crane>(initialCrane());
  const live = React.useRef({ idle: 0, touched: false, chose: false, drag: null as null | { id: number; x: number; y: number; moved: boolean }, swapped: false });
  const trolley = React.useRef<SVGGElement>(null);
  const upper = React.useRef<SVGPathElement>(null);
  const lower = React.useRef<SVGPathElement>(null);
  const hook = React.useRef<SVGGElement>(null);
  const ladle = React.useRef<SVGGElement>(null);
  const contents = React.useRef<SVGGElement>(null);
  const [said, setSaid] = React.useState("");

  const kick = useLoop((dt, calm) => {
    const c = crane.current;
    const l = live.current;
    /* The tour comes back only after the crane has stood still for a while. */
    if (isSettled(c)) l.idle += dt;
    const touring = !calm && !l.drag && l.idle > (l.touched ? TOUR_RESUME : TOUR_DELAY);
    if (touring && !c.plan.length) c.plan = nextLift(c);
    const event = step(c, dt, calm);
    if (event === "hooked") setSaid("Ladle on the hook");
    if (event === "released") setSaid(`Ladle set down on ${standName(c.lx)}`);

    const hx = hookX(c);
    trolley.current?.setAttribute("transform", placeOf(c.tx, 0));
    hook.current?.setAttribute("transform", placeOf(hx, c.hz));
    ladle.current?.setAttribute("transform", placeOf(c.lx, c.lz));
    const ropes = ropesOf(c);
    upper.current?.setAttribute("d", ropes.upper);
    lower.current?.setAttribute("d", ropes.lower);

    /* A hook let down beside the ladle, on its far side, is behind it. */
    const swap = !c.hooked && c.hz < c.lz + 41 && hx < c.lx - 2;
    if (swap !== l.swapped && contents.current && hook.current && ladle.current) {
      l.swapped = swap;
      contents.current.appendChild(swap ? ladle.current : hook.current);
    }

    say(readoutOf(c, span));
    /* While on screen the tour can always resume, so the loop keeps running unless motion is reduced. */
    return !calm || !isSettled(c) || !!l.drag;
  }, visible);

  const takeOver = () => {
    const l = live.current;
    l.idle = 0;
    l.touched = true;
    crane.current.plan = [];
    kick();
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    live.current.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    kick();
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = live.current.drag;
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      /* The pointer can be gone by now (a cancelled touch); the drag still works without capture. */
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {}
      anchor.current?.setAttribute("data-drag", "");
    }
    const svg = anchor.current?.querySelector("svg");
    const point = svg ? hookAt(svg, event.clientX, event.clientY) : null;
    if (!point) return;
    takeOver();
    const c = crane.current;
    c.target.tx = Math.min(TROLLEY_MAX, Math.max(TROLLEY_MIN, point.x));
    /* On touch the page keeps vertical pans, so only the trolley follows; the hoist stays put. */
    if (event.pointerType !== "touch") c.target.hz = Math.min(HOOK_MAX, Math.max(HOOK_MIN, point.z));
  };

  const endDrag = (event: React.PointerEvent) => {
    const drag = live.current.drag;
    if (!drag || drag.id !== event.pointerId) return;
    live.current.drag = null;
    anchor.current?.removeAttribute("data-drag");
    if (!drag.moved && event.type === "pointerup") nextJob();
    else takeOver();
  };

  const nextJob = () => {
    takeOver();
    crane.current.plan = nextLift(crane.current);
    kick();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const c = crane.current;
    const big = event.shiftKey;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => (c.target.tx = Math.max(TROLLEY_MIN, c.tx - (big ? 40 : 10))),
      ArrowRight: () => (c.target.tx = Math.min(TROLLEY_MAX, c.tx + (big ? 40 : 10))),
      ArrowUp: () => (c.target.hz = Math.min(HOOK_MAX, c.hz + (big ? 20 : 6))),
      ArrowDown: () => (c.target.hz = Math.max(HOOK_MIN, c.hz - (big ? 20 : 6))),
      Home: () => (c.target.tx = TROLLEY_MIN),
      End: () => (c.target.tx = TROLLEY_MAX),
      Escape: () => {
        c.target.tx = c.tx;
        c.target.hz = c.hz;
      },
    };
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      nextJob();
      return;
    }
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    takeOver();
    move();
  };

  return (
    <div
      ref={anchor}
      className="cr"
      tabIndex={0}
      role="application"
      aria-roledescription="crane"
      aria-label="Overhead crane. Left and right arrows move the trolley, up and down arrows raise and lower the hook, Enter makes the next lift."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onFocus={() => {
        live.current.idle = 0;
        live.current.touched = true;
      }}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={LABEL}>
        <defs>
          <clipPath id="cr-mouth">
            <path d={mouth} />
          </clipPath>
        </defs>
        {props.back}
        <g ref={contents}>
          <g ref={ladle} transform={placeOf(rest.crane.lx, rest.crane.lz)}>
            {props.ladleBack}
            <path className="cr-cavity" d={mouth} />
            <path className="cr-metal" d={metal} clipPath="url(#cr-mouth)" />
            <path className="iso-line" data-tone="lo" d={mouth} />
            {props.ladleFront}
          </g>
          <g ref={hook} transform={placeOf(hookX(rest.crane), rest.crane.hz)}>
            {props.hook}
          </g>
          <path ref={lower} className="iso-line cr-rope" data-tone="hi" d={rest.ropes.lower} />
        </g>
        {props.nearGirder}
        <g ref={trolley} transform={placeOf(rest.crane.tx, 0)}>
          {props.trolleyBack}
          <path ref={upper} className="iso-line cr-rope" data-tone="hi" d={rest.ropes.upper} />
          {props.trolleyFront}
        </g>
        {props.front}
      </IsoFigure>
      <span className="cr-sr" aria-live="polite">
        {said}
      </span>
    </div>
  );
}
