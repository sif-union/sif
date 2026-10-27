// Everything the page shows, computed once at build time from the files in data/.
// Returns and weights are fractions: 0.05 means 5%.
import { readFileSync } from "node:fs";
import pitches from "../data/pitches.json";
import { groupOf } from "./groups";
import { readHoldingsCsv } from "./holdings";
import { SECTOR_ETFS, monthlyReturns, type Market, type NewsItem } from "./market";
import { PERIODS, buildFund, compound, contributions, growthOf100, heldSince, periodMonths, positionPeriodReturn, positionReturn, fundReturn, type Period } from "./performance";
import { readVtiHoldings } from "./vti";

export type Pitch = { summary: string; deck?: string; placeholder?: boolean };

export type HoldingPeriod = {
  months: number; // for Max: the months since the fund bought it
  return: number | null; // null when the fund didn't hold it for the whole period
  vtiReturn: number | null; // VTI over the same months
  contribution: number; // what it added to the fund's return
};

export type Holding = {
  ticker: string;
  name: string;
  group: string;
  kind: "stock" | "etf" | "cash";
  value: number;
  weight: number; // share of the fund
  vtiWeight: number | null; // share of VTI; null for ETFs and cash
  since: string; // first month-end of the current stretch of holding it
  sinceIsDataStart: boolean; // already held when the CSV starts, so it may be older
  income12: number; // dividends over the last 12 months
  periods: Partial<Record<Period, HoldingPeriod>>;
  growth: { month: string; holding: number; vti: number }[]; // $100 put in at `since`
  pitch: Pitch | null;
  news: NewsItem[];
};

// A GICS sector, ETF theme or cash. Sectors VTI has but the fund doesn't are included with no holdings.
export type Group = {
  name: string;
  kind: "sector" | "etf" | "cash";
  value: number;
  weight: number;
  vtiWeight: number | null; // only for GICS sectors
  holdings: string[]; // tickers, largest first
};

export type Contribution = { name: string; fund: number; vti: number }; // each side adds up to its total return

export type PeriodStats = {
  start: string; // month-end the period starts from
  months: number;
  fundReturn: number;
  vtiReturn: number | null; // null if the price data is missing a month
  contribution: Contribution[];
};

export type SiteData = {
  asOf: string; // last month-end in the holdings CSV
  dataStart: string;
  fundValue: number;
  periods: Partial<Record<Period, PeriodStats>>; // a period is missing when the data doesn't go back that far
  holdings: Record<string, Holding>; // by ticker
  groups: Group[]; // largest first
};

export const SOLD = "Sold positions";

const read = (file: string) => readFileSync(file, "utf8");

export function loadSiteData(): SiteData {
  const fund = buildFund(readHoldingsCsv(read("data/holdings.csv")), "equity");
  const vti = readVtiHoldings(read("data/vti-holdings.csv"));
  const market: Market = JSON.parse(read("data/market.json"));
  const asOf = fund.months.at(-1)!;
  const fundValue = fund.value.get(asOf)!;

  const returnsOf = (ticker: string) => monthlyReturns(market.monthEndClose[ticker] ?? {});
  const vtiMonthly = returnsOf("VTI");
  const compoundOf = (returns: Map<string, number>, months: string[]) =>
    months.every((m) => returns.has(m)) ? compound(months.map((m) => returns.get(m)!)) : null;
  const typeOf = (ticker: string) => fund.positions.get(ticker)!.values().next().value!.type;

  const windows = new Map(PERIODS.flatMap((p) => { const m = periodMonths(fund, p); return m ? [[p, m] as const] : []; }));
  const contributionsBy = new Map([...windows].map(([p, months]) => [p, contributions(fund, months)]));

  // ---- holdings: everything the fund owns at the last month-end
  const holdings: Holding[] = [];
  for (const [ticker, byMonth] of fund.positions) {
    const row = byMonth.get(asOf);
    if (!row || row.value <= 0.5) continue;
    const kind = row.type === "Cash" ? "cash" : row.type === "ETFs" ? "etf" : "stock";
    const since = heldSince(fund, ticker);
    const heldMonths = fund.months.filter((m) => m > since);

    const periods: Holding["periods"] = {};
    for (const [p, months] of windows) {
      const own = p === "Max" ? heldMonths : months;
      periods[p] = {
        months: own.length,
        return: own.length ? positionPeriodReturn(fund, ticker, own) : null,
        vtiReturn: compoundOf(vtiMonthly, own),
        contribution: contributionsBy.get(p)!.get(ticker) ?? 0,
      };
    }
    const holdingGrowth = growthOf100(heldMonths.map((m) => positionReturn(fund, ticker, m) ?? 0));
    const vtiGrowth = growthOf100(heldMonths.map((m) => vtiMonthly.get(m) ?? 0));

    holdings.push({
      ticker,
      name: row.name,
      group: groupOf(ticker, row.type, vti) ?? "Other",
      kind,
      value: row.value,
      weight: row.value / fundValue,
      vtiWeight: kind === "stock" ? (vti.stock[ticker] ?? 0) / 100 : null,
      since,
      sinceIsDataStart: since === fund.months[0],
      income12: fund.months.slice(-12).reduce((sum, m) => sum + (byMonth.get(m)?.income ?? 0), 0),
      periods,
      growth: [since, ...heldMonths].map((month, i) => ({ month, holding: holdingGrowth[i], vti: vtiGrowth[i] })),
      pitch: (pitches as Record<string, Pitch>)[ticker] ?? null,
      news: market.news[ticker] ?? [],
    });
  }
  holdings.sort((a, b) => b.value - a.value); // so each group lists its holdings largest first

  // ---- groups
  const groups = new Map<string, Group>();
  const groupNamed = (name: string): Group => {
    const isSector = name in vti.sector;
    if (!groups.has(name)) groups.set(name, {
      name, kind: isSector ? "sector" : name === "Cash" ? "cash" : "etf",
      value: 0, weight: 0, vtiWeight: isSector ? vti.sector[name] / 100 : null, holdings: [],
    });
    return groups.get(name)!;
  };
  for (const h of holdings) {
    const g = groupNamed(h.group);
    g.value += h.value;
    g.weight += h.weight;
    g.holdings.push(h.ticker);
  }
  Object.keys(vti.sector).forEach(groupNamed);

  // ---- periods: fund and VTI returns, and contribution by group
  const sectorMonthly = Object.entries(SECTOR_ETFS).map(([sector, etf]) => [sector, returnsOf(etf)] as const);
  const periods: SiteData["periods"] = {};
  for (const [p, months] of windows) {
    const fundTotal = compound(months.map((month) => fundReturn(fund, month)));
    const vtiTotal = compoundOf(vtiMonthly, months);

    // Fund side: each position's contribution, added up by group. Positions sold since go in their
    // sector if it's a GICS sector, otherwise (an old ETF) into "Sold positions".
    const fundSide = new Map<string, number>();
    for (const [ticker, c] of contributionsBy.get(p)!) {
      const name = groupOf(ticker, typeOf(ticker), vti) ?? SOLD;
      const key = groups.has(name) ? name : SOLD;
      fundSide.set(key, (fundSide.get(key) ?? 0) + c);
    }
    // VTI side: each sector's weight in VTI times its sector ETF's return. That sum is close to VTI's
    // return but not equal, so the gap is spread over the sectors by weight to make it add up exactly.
    const vtiSide = new Map(sectorMonthly.map(([sector, r]) => [sector, (vti.sector[sector] ?? 0) / 100 * (compoundOf(r, months) ?? 0)]));
    const gap = (vtiTotal ?? 0) - [...vtiSide.values()].reduce((a, b) => a + b, 0);
    for (const [sector, c] of vtiSide) vtiSide.set(sector, c + (vti.sector[sector] ?? 0) / 100 * gap);

    const names = new Set([...fundSide.keys(), ...vtiSide.keys()]);
    periods[p] = {
      start: fund.months[fund.months.indexOf(months[0]) - 1],
      months: months.length,
      fundReturn: fundTotal,
      vtiReturn: vtiTotal,
      contribution: [...names].map((name) => ({ name, fund: fundSide.get(name) ?? 0, vti: vtiSide.get(name) ?? 0 })),
    };
  }

  return {
    asOf,
    dataStart: fund.months[0],
    fundValue,
    periods,
    holdings: Object.fromEntries(holdings.map((h) => [h.ticker, h])),
    groups: [...groups.values()].sort((a, b) => b.value - a.value),
  };
}
