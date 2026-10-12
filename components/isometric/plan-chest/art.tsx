import * as React from "react";
import { Dots, Line, Solid } from "@/components/iso/react/draw";
import { CARCASS_ART, FEET_ART, FRONTS, PLINTH_ART, TOP_ART } from "./geometry";
import { PlanChestLive } from "./live";
import type { Drawer } from "./model";

/* Static parts, built on the server and handed to the live component as element props. Every root carries a key. */

const CARCASS = (
  <g key="carcass">
    <path className="iso-halo" d={PLINTH_ART.halo} />
    {FEET_ART.map((foot, index) => (
      <g key={index}>
        <Solid paths={foot.pad} tone="lo" crease="faint" />
        <Solid paths={foot.nut} tone="mid" crease="faint" />
        <Solid paths={foot.stem} tone="mid" crease="none" />
      </g>
    ))}
    <Solid paths={PLINTH_ART.slab} tone="lo" crease="faint" />
    <Line d={PLINTH_ART.vents} tone="lo" />
    {CARCASS_ART.units.map((unit, index) => (
      <g key={index}>
        <Solid paths={unit.body} tone="mid" crease="faint" />
        <Line d={unit.side.panel} tone="faint" />
        <Dots points={unit.side.screws} size={0.5} tone="mid" />
      </g>
    ))}
    <Line d={CARCASS_ART.lock.bezel} tone="lo" />
    <Line d={CARCASS_ART.lock.barrel} tone="mid" />
    <Line d={CARCASS_ART.lock.keyway} tone="hi" />
    <Solid paths={CARCASS_ART.maker.plate} tone="lo" crease="none" />
    <Line d={CARCASS_ART.maker.rule} tone="lo" free />
    <Dots points={CARCASS_ART.maker.screws} size={0.45} tone="mid" />
  </g>
);

const TOP = (
  <g key="top">
    <Solid paths={TOP_ART.slab} tone="mid" crease="faint" />
    <Solid paths={TOP_ART.inlay} tone="lo" crease="none" flat />
    <Line d={TOP_ART.inlayLine} tone="faint" />
    <Dots points={TOP_ART.screws} size={0.5} tone="mid" />
    <Solid paths={TOP_ART.loose} tone="mid" crease="none" className="pc-sheet" />
    <Line d={TOP_ART.looseBorder} tone="lo" />
    <Line d={TOP_ART.looseTitle} tone="lo" />
    <Solid paths={TOP_ART.rule} tone="mid" crease="faint" />
    <Line d={TOP_ART.ruleTicks.minor} tone="lo" />
    <Line d={TOP_ART.ruleTicks.major} tone="mid" />
    <Line d={TOP_ART.ruleHole} tone="lo" />
  </g>
);

const FRONT_ART = FRONTS.map((front, index) => (
  <g key={`front-${index}`}>
    <Solid paths={front.panel} tone="mid" crease="faint" className="pc-panel" />
    <Solid paths={front.holder} tone="lo" crease="none" />
    <Line d={front.window} tone="faint" />
    <Line d={front.card} tone="lo" free />
    <Dots points={front.rivets} size={0.45} tone="mid" />
    {front.posts.map((paths, post) => (
      <Solid key={post} paths={paths} tone="mid" crease="none" />
    ))}
    {front.bars.map((paths, bar) => (
      <Solid key={`bar-${bar}`} paths={paths} tone="hi" crease="lo" />
    ))}
  </g>
));

export function PlanChestArt({ openings, drawers, defaultOpen }: { openings: string[]; drawers: Drawer[]; defaultOpen: number | null }) {
  return <PlanChestLive carcass={CARCASS} top={TOP} fronts={FRONT_ART} openings={openings} drawers={drawers} defaultOpen={defaultOpen} />;
}
