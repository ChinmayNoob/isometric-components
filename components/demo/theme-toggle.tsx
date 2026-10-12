"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Flips the shadcn `.dark` class on <html>, so each figure can be checked in both themes. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return (
    <Button variant="outline" size="sm" onClick={() => setDark((value) => !value)} aria-pressed={dark}>
      {dark ? "Light theme" : "Dark theme"}
    </Button>
  );
}
