import * as React from "react";
import { Dots, Line, Solid } from "@/components/iso/react/draw";
import { BRIDGE, BUILDING, FIXTURES, FLOOR_ART, HOOK, LADLE, TROLLEY } from "./geometry";
import { OverheadCraneLive } from "./live";

/*
 * Static parts, built on the server and handed to the live component as element props. Painter's order is back to
 * front: the far runway and everything on the floor, the far girder, then (in the live component) the ladle and the
 * hook between the girders, the near girder, the trolley, and last the walkway and the near runway.
 */

type Runway = typeof BUILDING.left;
type Truck = typeof BRIDGE.left;
type Girder = typeof BRIDGE.far;

const runwayArt = (side: Runway, key: string) => (
  <g key={key}>
    {side.columns.map((column, index) => (
      <g key={index}>
        <Solid paths={column.base} tone="lo" crease="none" />
        <Dots points={column.bolts} size={0.45} tone="mid" />
        <Solid paths={column.shaft} tone="mid" crease="faint" />
        <Line d={column.flanges} tone="faint" />
      </g>
    ))}
    <Solid paths={side.girder} tone="mid" crease="faint" />
    <Line d={side.stiffeners} tone="faint" />
    <Solid paths={side.rail} tone="lo" crease="none" />
    {side.stops.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
  </g>
);

const truckArt = (truck: Truck, key: string) => (
  <g key={key}>
    <Solid paths={truck.farBuffer} tone="mid" crease="none" />
    <Solid paths={truck.body} tone="mid" crease="faint" inner={<Line d={truck.seam} tone="faint" />} />
    {truck.wheels.map((wheel, index) => (
      <g key={index}>
        <Line d={wheel.rim} tone="lo" />
        <Line d={wheel.hub} tone="mid" />
        <Dots points={[wheel.centre]} size={0.5} tone="mid" />
      </g>
    ))}
    <Solid paths={truck.nearBuffer} tone="mid" crease="none" />
  </g>
);

const girderArt = (girder: Girder, key: string) => (
  <g key={key}>
    <Solid paths={girder.body} tone="mid" crease="faint" />
    <Line d={girder.diaphragms} tone="faint" />
    <Solid paths={girder.rail} tone="lo" crease="none" />
    {girder.stops.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
  </g>
);

const { furnace, mould, stands } = FIXTURES;

const BACK = (
  <g key="back">
    <path className="iso-halo" d={FLOOR_ART.halo} />
    <Solid paths={FLOOR_ART.slab} tone="lo" crease="faint" />
    <Line d={FLOOR_ART.joints} tone="faint" />
    <Line d={FLOOR_ART.route} tone="lo" />
    <Line d={BUILDING.bracing} tone="lo" />
    {runwayArt(BUILDING.left, "left-runway")}

    <Solid paths={furnace.base} tone="lo" crease="faint" />
    <Dots points={furnace.bolts} size={0.45} tone="mid" />
    <Solid paths={furnace.body} tone="mid" crease="faint" inner={<Line d={furnace.seams} tone="faint" />} />
    <Line d={furnace.ribs} tone="lo" />
    <Solid paths={furnace.lid} tone="mid" crease="faint" />
    <Solid paths={furnace.spout} tone="mid" crease="none" />

    <Solid paths={mould.farRail} tone="lo" crease="none" />
    {mould.rollers.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
    <Solid paths={mould.nearRail} tone="lo" crease="none" />
    {mould.flasks.map((flask, index) => (
      <g key={index}>
        <Solid paths={flask.lugs[0]!} tone="lo" crease="none" />
        <Solid paths={flask.paths} tone="mid" crease="faint" inner={<Line d={flask.joint} tone="faint" />} />
        <Line d={flask.sprue} tone="lo" />
        <Line d={flask.riser} tone="lo" />
        <Solid paths={flask.lugs[1]!} tone="lo" crease="none" />
      </g>
    ))}

    {stands.map((stand, index) => (
      <g key={index}>
        {stand.legs.map((leg, part) => (
          <Solid key={part} paths={leg.paths} tone="mid" crease="none" />
        ))}
        <Line d={stand.braces} tone="lo" />
        <Solid paths={stand.top} tone="mid" crease="faint" />
        <Line d={stand.seat} tone="faint" />
        <Dots points={stand.bolts} size={0.45} tone="mid" />
      </g>
    ))}

    {truckArt(BRIDGE.left, "left-truck")}
    <Solid paths={BRIDGE.cab.body} tone="mid" crease="faint" />
    <Line d={BRIDGE.cab.windows} tone="lo" />
    <Line d={BRIDGE.cab.sill} tone="faint" />
    {girderArt(BRIDGE.far, "far-girder")}
  </g>
);

const NEAR_GIRDER = girderArt(BRIDGE.near, "near-girder");

const { walkway } = BRIDGE;

const FRONT = (
  <g key="front">
    <Solid paths={walkway.deck} tone="lo" crease="faint" />
    {walkway.shafts.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
    {walkway.couplings.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
    <Solid paths={walkway.gearbox} tone="mid" crease="faint" />
    <Solid paths={walkway.motor} tone="mid" crease="faint" />
    <Solid paths={walkway.toe} tone="lo" crease="none" />
    <Line d={walkway.rails} tone="lo" />
    {walkway.posts.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
    {runwayArt(BUILDING.right, "right-runway")}
    {truckArt(BRIDGE.right, "right-truck")}
  </g>
);

const TROLLEY_ART = {
  back: (
    <g key="trolley-back">
      {TROLLEY.wheels.map((paths, index) => (
        <Solid key={index} paths={paths} tone="lo" crease="none" />
      ))}
      <Solid paths={TROLLEY.farBar} tone="mid" crease="faint" />
      <Solid paths={TROLLEY.motor} tone="mid" crease="faint" />
      <g dangerouslySetInnerHTML={{ __html: TROLLEY.motorRibs }} />
      <Solid paths={TROLLEY.motorShaft} tone="mid" crease="none" />
      <Solid paths={TROLLEY.leftBar} tone="mid" crease="faint" />
    </g>
  ),
  front: (
    <g key="trolley-front">
      <Solid paths={TROLLEY.rightBar} tone="mid" crease="faint" />
      <Solid paths={TROLLEY.nearBar} tone="mid" crease="faint" />
      {TROLLEY.pedestals.map((paths, index) => (
        <Solid key={index} paths={paths} tone="mid" crease="none" />
      ))}
      <Solid paths={TROLLEY.farFlange} tone="hi" crease="lo" />
      <Solid paths={TROLLEY.drum} tone="hi" crease="lo" inner={<Line d={TROLLEY.grooves} tone="faint" />} />
      <Solid paths={TROLLEY.nearFlange} tone="hi" crease="lo" />
      <Solid paths={TROLLEY.gearbox} tone="mid" crease="faint" inner={<Line d={TROLLEY.gearboxSeam} tone="faint" />} />
      <Dots points={TROLLEY.gearboxBolts} size={0.45} tone="mid" />
    </g>
  ),
};

const HOOK_ART = (
  <g key="hook">
    <Solid paths={HOOK.block} tone="hi" crease="lo" />
    <Line d={HOOK.sheave} tone="mid" />
    <Dots points={[HOOK.pin]} size={0.6} tone="hi" />
    <Dots points={HOOK.ropeEnds} size={0.7} tone="hi" />
    <Solid paths={HOOK.crosshead} tone="mid" crease="none" />
    <g dangerouslySetInnerHTML={{ __html: HOOK.hook }} />
  </g>
);

const LADLE_ART = {
  back: (
    <g key="ladle-back">
      <Solid paths={LADLE.farArm} tone="mid" crease="none" />
      <Solid paths={LADLE.farTrunnion} tone="mid" crease="none" />
      <Solid paths={LADLE.foot} tone="mid" crease="lo" />
      <Solid paths={LADLE.body} tone="hi" crease="lo" inner={<Line d={LADLE.bands} tone="faint" />} />
      <Solid paths={LADLE.lip} tone="hi" crease="lo" />
    </g>
  ),
  mouth: LADLE.mouth,
  metal: LADLE.metal,
  front: (
    <g key="ladle-front">
      <Solid paths={LADLE.nearTrunnion} tone="mid" crease="none" />
      <Solid paths={LADLE.nearArm} tone="mid" crease="none" />
      <Solid paths={LADLE.crossbar} tone="mid" crease="none" />
    </g>
  ),
};

export function OverheadCraneArt({ span }: { span: number }) {
  return (
    <OverheadCraneLive
      span={span}
      back={BACK}
      nearGirder={NEAR_GIRDER}
      front={FRONT}
      trolleyBack={TROLLEY_ART.back}
      trolleyFront={TROLLEY_ART.front}
      hook={HOOK_ART}
      ladleBack={LADLE_ART.back}
      ladleFront={LADLE_ART.front}
      mouth={LADLE_ART.mouth}
      metal={LADLE_ART.metal}
    />
  );
}
