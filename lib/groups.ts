// Which group a holding belongs to on the maps and contribution chart:
// a GICS sector for stocks, a theme for ETFs, or "Cash".
import etfThemes from "../data/etf-themes.json";
import extraSectors from "../data/extra-sectors.json";
import type { VtiWeights } from "./vti";

// Returns null when the ticker isn't in any list; the upload page reports those so someone can add them.
export function groupOf(ticker: string, type: string, vti: VtiWeights): string | null {
  if (type === "Cash") return "Cash";
  if (type === "ETFs") return (etfThemes as Record<string, string>)[ticker] ?? null;
  // stocks VTI holds get their sector from Vanguard's file; the rest come from data/extra-sectors.json
  return vti.stockSector[ticker] ?? (extraSectors as Record<string, string>)[ticker] ?? null;
}
