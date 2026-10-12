import Link from "next/link";

/** One entry per figure. Add a row when a new component lands in components/isometric/. */
const COMPONENTS = [
  {
    href: "/plan-chest",
    name: "Plan chest",
    what: "Six drawers of drawing sheets, one sheet per item. Hover, click or arrow keys open a drawer; links to any list.",
    source: "components/isometric/plan-chest",
  },
  {
    href: "/overhead-crane",
    name: "Overhead crane",
    what: "A foundry bay crane drawn to scale from its span. Drag the hook or tap for the next lift; the load swings on its ropes.",
    source: "components/isometric/overhead-crane",
  },
  {
    href: "/gas-turbine",
    name: "Gas turbine generator set",
    what: "An epic figure: a heavy-duty single-shaft unit that comes apart into its assemblies and runs from a cold start to full load.",
    source: "components/isometric/gas-turbine",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-16 md:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Isometric components</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Interactive isometric figures built with the anatomy kit. Each one lives in its own folder and shares the kit in
        components/iso.
      </p>
      <ul className="mt-10 border-t border-border">
        {COMPONENTS.map((item) => (
          <li key={item.href} className="border-b border-border">
            <Link href={item.href} className="block py-5 hover:bg-muted/40">
              <span className="block font-medium">{item.name}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{item.what}</span>
              <span className="mt-2 block font-mono text-xs text-muted-foreground">{item.source}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
