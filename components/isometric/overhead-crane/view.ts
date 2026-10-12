import { boxCorners, fitProjection, iso, type Plan, type Point3 } from "@/components/iso/iso-kit";

/*
 * World layout of the foundry bay, in drawing units: x across the bay (along the bridge), y along the runway, z up.
 * The drawing is to scale: SPAN_UNITS between the runway rail centres stands for the crane's span, 10 units to a metre
 * at the sample 22.5 m. Everything else is sized to that scale.
 */

export const WIDTH = 600;
export const HEIGHT = 460;
export const AZIMUTH = 58;
export const ELEVATION = 46;

export const SPAN_UNITS = 225;
export const RAIL_X = SPAN_UNITS / 2;

export const FLOOR: Plan = { x: -146, y: -104, w: 292, d: 172, r: 1 };
export const FLOOR_H = 4;

/* Building: stanchions under each runway girder. */
export const COLUMN_Y = [-88, 52];
export const COLUMN = 8;
export const COLUMN_TOP = 80;
export const RUNWAY_W = 6;
export const RUNWAY_TOP = 90;
export const RAIL_TOP = 92;
/** The runway runs further behind the bridge than in front of it, so the bay fills the card. */
export const RUNWAY_Y0 = -96;
export const RUNWAY_Y1 = 60;

/* Bridge: two box girders between two end trucks. */
export const TRUCK_W = 10;
export const TRUCK_HALF = 27;
export const TRUCK_TOP = 106;
export const GIRDER_END = RAIL_X - TRUCK_W / 2;
export const GIRDER_Y = 10;
export const GIRDER_W = 8;
export const GIRDER_Z = 98;
export const GIRDER_TOP = 114;
export const TROLLEY_RAIL_TOP = 115.5;

/* Trolley, in its own x (moved along the bridge). */
export const FRAME_Z = 116;
export const FRAME_TOP = 121;
export const DRUM_Z = 127;
export const DRUM_R = 5;
export const ROPE_TOP = DRUM_Z - DRUM_R;
export const ROPES = [-4, -1.5, 1.5, 4];

/* Hook block, in its own z: the hook's bowl is at 0. */
export const BLOCK_Z = 7;
export const BLOCK_TOP = 17;

/* Ladle, in its own z: the bottom is at 0. The hook takes the bail crossbar at BAIL. */
export const LADLE_R = 14.8;
export const LADLE_TOP = 28;
export const BAIL = 38;
export const BAIL_Y = 18;

/* Floor fixtures. */
export const STANDS = [-62, 62];
export const STAND_TOP = 12;
export const FURNACE: [number, number] = [-80, -44];
export const MOULD_Y = -44;

/* Travel limits: the trolley's frame stays clear of the end trucks, the hook block clear of the girders. */
export const TROLLEY_MIN = -84;
export const TROLLEY_MAX = 84;
export const HOOK_MIN = 4;
export const HOOK_MAX = GIRDER_Z - BLOCK_TOP - 2;
/** Where a driver carries the hook: low enough that the hook block and ropes show below the bridge. */
export const HOOK_TRAVEL = 66;

export const P = fitProjection(
  [
    ...boxCorners(FLOOR, -FLOOR_H, 0),
    ...boxCorners({ x: -RAIL_X - TRUCK_W / 2, y: -TRUCK_HALF - 4, w: SPAN_UNITS + TRUCK_W, d: TRUCK_HALF * 2 + 8, r: 0 }, 0, DRUM_Z + 8),
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);

export const at = (point: Point3) => iso(point, P);
