// Everything the page shows, computed once at build time from the files in data/.
import { readFileSync } from "node:fs";
import { readHoldingsCsv } from "./holdings";
import { PERIODS, buildFund, compound, fundReturn, periodMonths, type Period } from "./performance";

export type PeriodStats = {
  start: string; // month-end the period starts from
  months: number;
  fundReturn: number;
  vtiReturn: number | null; // filled in once the market data job exists (block 11)
};

export type SiteData = {
  asOf: string; // last month-end in the holdings CSV
  fundValue: number;
  periods: Partial<Record<Period, PeriodStats>>; // a period is missing when the data doesn't go back that far
};

export function loadSiteData(): SiteData {
  const fund = buildFund(readHoldingsCsv(readFileSync("data/holdings.csv", "utf8")), "equity");
  const asOf = fund.months.at(-1)!;

  const periods: SiteData["periods"] = {};
  for (const period of PERIODS) {
    const months = periodMonths(fund, period);
    if (!months) continue;
    periods[period] = {
      start: fund.months[fund.months.indexOf(months[0]) - 1],
      months: months.length,
      fundReturn: compound(months.map((month) => fundReturn(fund, month))),
      vtiReturn: null,
    };
  }
  return { asOf, fundValue: fund.value.get(asOf)!, periods };
}
