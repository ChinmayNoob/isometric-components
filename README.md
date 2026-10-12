# Isometric components

Interactive isometric SVG figures for Next.js, built with the [anatomy](https://skills.wheresryan.sh/anatomy) kit. Each figure is a self-contained folder you can copy into another Next.js (App Router) project.

```bash
pnpm install
pnpm dev     # http://localhost:3000 lists every component
```

## Layout

| Path | What it is |
| --- | --- |
| `components/iso/` | The anatomy kit (MIT, see `LICENSE`): geometry, React drawing components, live hooks and `iso.css`. One edit: its light tokens also apply when `<html>` has no `.dark` class. `skin.css` maps the card onto this app's shadcn tokens. |
| `components/isometric/<name>/` | One figure per folder. |
| `app/<name>/page.tsx` | A demo page per figure. |

## Components

### Plan chest (`components/isometric/plan-chest`)

A steel plan chest with six drawers; each drawer holds one sheet per item, and the top sheet of each drawer carries a small drawing. Hover previews a drawer, click or the arrow keys open it, and an idle tour runs until the reader chooses. Reduced motion turns the tour off and drawers jump to place.

```tsx
import { PlanChest, PlanChestProvider } from "@/components/isometric/plan-chest";

// On its own, with sample data:
<PlanChest />

// With your own six drawers, linked to a list through the provider:
<PlanChestProvider defaultOpen={0}>
  <MyList />            {/* reads and sets the open drawer with usePlanChest() */}
  <PlanChest drawers={[{ n: "01", title: "Survey", sheets: 8 }, /* …six in all */]} />
</PlanChestProvider>
```

- `drawers` must hold exactly six entries, top to bottom. Stacks are drawn up to 18 sheets high; larger counts are still read out.
- `PlanChest` is a server component; `PlanChestProvider` and `usePlanChest` are client.
- To copy it into another project: take `components/iso/` and `components/isometric/plan-chest/`, and keep the `@/` path alias. `skin.css` expects `--foreground`, `--muted-foreground`, `--border` and `--font-geist-mono`; point them at your own tokens.
- The kit's own hooks trip `react-hooks/refs`, so `components/iso/**` is excluded from lint.

### Overhead crane (`components/isometric/overhead-crane`)

A double-girder overhead travelling crane in a foundry bay, drawn to scale from its span: stanchions and runway girders, end trucks, two box girders with a walkway and line-shaft drive, a cab, a trolley with hoist drum and motor, a hook block on four rope falls, and a ladle that moves between a furnace-side stand and a pouring stand by the mould line.

- **Model** (`model.ts`, no DOM): the trolley and hoist move on trapezoidal profiles; the load hangs as a damped pendulum from the drum (`θ'' = −(g/L)·sin θ − (a/L)·cos θ − 2ζω·θ'`, with g = 9.81 m/s² in drawing units), so it swings when the trolley speeds up or slows down. The hook takes the bail when lifted up through it and lets go once the ladle sits on a stand and the ropes go slack. A lift waits for the swing to settle before lowering, as a driver does.
- **Controls:** drag the hook (on touch, drag moves the trolley only so the page still scrolls); click or tap, Enter or Space for the next lift; arrows move the trolley and hoist (Shift for bigger steps); Home and End run the trolley to its limits; Escape stops. An idle tour carries the ladle back and forth and resumes four seconds after the crane comes to rest. Reduced motion turns the tour off and moves in steps.
- **Readout:** trolley position along the span and hook height, in metres, from the drawing's scale, and whether the ladle is on the hook. Lifts are announced in a polite live region.

```tsx
import { OverheadCrane } from "@/components/isometric/overhead-crane";

<OverheadCrane span={22.5} />
```

- `span` (metres, default 22.5) sets the scale; the drawing itself doesn't change. Speeds are faster than a real foundry crane so a lift fits a figure; acceleration is near a real one, so the swing is true to size. Damping stands in for anti-sway control.
- Round parts use the kit's `lathe.mjs` and the hook uses `tube.mjs` (both in `components/iso/`, imported from TypeScript through `allowJs`).

### Gas turbine generator set (`components/isometric/gas-turbine`) — Epic

A single-shaft heavy-duty gas turbine generator set on its foundation, of the kind at NTPC Anta (three 88.71 MW units, ABB 13D2, 1989; 419.33 MW station with its 153.2 MW steam turbine). About 200 depth-sorted parts: generator with air cooler, terminal box and bus ducts; coupling and guard; compressor and turbine in a split casing over a bladed rotor; a silo combustor standing on the casing on a saddle neck, with a cutaway window; inlet duct from a filter house on legs; exhaust diffuser, collector and stack with ladder and platform; lube oil and fuel gas skids with their pipework and valves; a local gauge panel.

- **Take it apart:** hover (or arrow keys, or the parts list) and it comes apart into eight assemblies on staggered springs, the upper casing lifting off the rotor. Escape puts it back together.
- **Run it:** Start (or S) arms the unit (puts it back together first), then cranks, purges, ignites, accelerates to 3000 rpm, synchronises and loads to 88.71 MW at a fixed rate; Stop unloads, opens the breaker, puts the flame out and coasts down. Speed, output and fuel each ride an envelope; the gauges, the readout and the flame all read from them. Time is compressed. Reduced motion jumps to the steady state.
- **Flame:** a WebGL layer (`flame.ts`) ray-marches the flame inside the combustor's flame tube in the figure's own camera, masked by the window in both walls; light ink for paper, added light in dark. Without WebGL the window glows warm through CSS.
- **Build step:** the scene is generated. After changing `build.mjs`, run `node components/isometric/gas-turbine/build.mjs` (about 2 minutes: it settles the painter's order from measured depth in every frame of the explode) and `--audit` to prove the geometry (clearances, pipe ends, supports, depth order at rest, apart and in flight, crowding). It writes `scene.json`, which the component imports. The anatomy skill's `scripts/lines.mjs <url> --select .gt-front` checks line ends on the page.
- Truth: only the plant's figures above and 3000 rpm (two poles, 50 Hz) are stated; purge speed is typical of heavy-duty units, not a 13D2 value, and the drawing is a general arrangement, not the unit's own drawings.

```tsx
import { GasTurbine } from "@/components/isometric/gas-turbine";

<GasTurbine />
```
