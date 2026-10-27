// Reads Vanguard's "Export full holdings" file for VTI (data/vti-holdings.csv) and turns it into
// VTI's weight in each stock and in each GICS sector. Vanguard's own sector table uses ICB, so we
// build GICS sector weights from each stock's GICS sub-industry instead.
import { splitCsvLine } from "./csv";
import gicsSectors from "../data/gics-sectors.json"; // GICS sector -> its sub-industries

export type VtiWeights = {
  asOf: string; // YYYY-MM-DD
  stock: Record<string, number>; // ticker -> % of VTI
  sector: Record<string, number>; // GICS sector -> % of VTI
  stockSector: Record<string, string>; // ticker -> GICS sector
  unknownSubIndustries: string[]; // missing from data/gics-sectors.json; add them there
};

const SECTOR_OF_SUB_INDUSTRY = new Map(
  Object.entries(gicsSectors).flatMap(([sector, subIndustries]) => subIndustries.map((sub) => [sub, sector])),
);
const NONE = "---"; // what Vanguard writes for a missing ticker or sub-industry

export function readVtiHoldings(text: string): VtiWeights {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const equityAt = lines.findIndex((line) => line.startsWith("Equity,as of"));
  const date = /as of (\d{2})\/(\d{2})\/(\d{4})/.exec(lines[equityAt] ?? "");
  if (!date) throw new Error('Not a Vanguard holdings export: no "Equity,as of" line');

  // Stocks are the rows under the first header after "Equity", up to the first blank line.
  const headerAt = lines.findIndex((line, i) => i > equityAt && line.startsWith(",SEDOL"));
  const header = splitCsvLine(lines[headerAt]);
  const [tickerCol, subIndustryCol, valueCol] = ["TICKER", "SUB-INDUSTRY", "MARKET VALUE*"].map((name) => header.indexOf(name));
  if ([tickerCol, subIndustryCol, valueCol].includes(-1)) throw new Error("Missing TICKER, SUB-INDUSTRY or MARKET VALUE* column");

  const stocks = [];
  for (let i = headerAt + 1; lines[i]?.startsWith(","); i++) {
    const cells = splitCsvLine(lines[i]);
    // Weights come from exact market values; the "% OF FUNDS" column is rounded and shows "<0.01%".
    stocks.push({ ticker: cells[tickerCol], subIndustry: cells[subIndustryCol], value: Number(cells[valueCol].replace(/[$,]/g, "")) });
  }
  const total = stocks.reduce((sum, s) => sum + s.value, 0);

  const stock: Record<string, number> = {};
  const sector: Record<string, number> = {};
  const stockSector: Record<string, string> = {};
  const unknown = new Set<string>();
  for (const s of stocks) {
    const weight = (s.value / total) * 100;
    const gicsSector = SECTOR_OF_SUB_INDUSTRY.get(s.subIndustry);
    if (s.ticker !== NONE) stock[s.ticker] = (stock[s.ticker] ?? 0) + weight;
    if (s.ticker !== NONE && gicsSector) stockSector[s.ticker] = gicsSector;
    if (gicsSector) sector[gicsSector] = (sector[gicsSector] ?? 0) + weight;
    else if (s.subIndustry !== NONE) unknown.add(s.subIndustry);
  }

  const [, month, day, year] = date;
  return { asOf: `${year}-${month}-${day}`, stock, sector, stockSector, unknownSubIndustries: [...unknown] };
}
