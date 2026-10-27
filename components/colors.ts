// Block colors. Mixing happens in CSS (color-mix), so they follow the light/dark theme on their own.
import type { Group } from "@/lib/site-data";

export type Fill = { background: string; strong: boolean }; // strong colors get light text ([data-strong] in globals.css)

// From the neutral color toward `neg` (t < 0) or `pos` (t > 0); t runs from -1 to 1.
export function mix(t: number, neg: string, pos: string): Fill {
  const amount = Math.min(1, Math.abs(t));
  return { background: `color-mix(in oklab, var(${t < 0 ? neg : pos}) ${Math.round(amount * 100)}%, var(--div-mid))`, strong: amount > 0.6 };
}

// A sector is colored by how over- or underweight it is vs VTI, full color at ±15 points.
// ETF themes and cash have nothing to compare to, so they get none (and are drawn hatched).
export function groupFill(g: Group): Fill | null {
  return g.vtiWeight == null ? null : mix((g.weight - g.vtiWeight) / 0.15, "--div-neg", "--div-pos");
}
