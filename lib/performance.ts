// Performance math on the holdings CSV: monthly returns, period returns, contribution.
// Returns are fractions: 0.05 means +5%.
import type { HoldingRow } from "./holdings";

export type Fund = {
  months: string[]; // month-ends, oldest first
  value: Map<string, number>; // month -> total value of the fund
  positions: Map<string, Map<string, HoldingRow>>; // ticker -> month -> row
};

export type Period = "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y" | "Max";

// Reorganizes the CSV rows of one fund ("equity" or "fixed income") so the math below can look
// things up directly instead of searching all ~3,300 rows every time. One pass over the rows fills:
//   value:     the fund's total value at each month-end (all its positions added up),
//              which is what every return is divided by
//   positions: each ticker's row for each month, e.g. positions.get("GOOG").get("2026-09-30")
//   months:    every month-end in the data, oldest first, so "the month before" is one step back
export function buildFund(rows: HoldingRow[], fundName: string): Fund {
  const fund: Fund = { months: [], value: new Map(), positions: new Map() };
  for (const row of rows.filter((r) => r.fund === fundName)) {
    // add this position's value to the fund's total for that month
    fund.value.set(row.date, (fund.value.get(row.date) ?? 0) + row.value);
    // file the row under its ticker and month
    if (!fund.positions.has(row.ticker)) fund.positions.set(row.ticker, new Map());
    fund.positions.get(row.ticker)!.set(row.date, row);
  }
  fund.months = [...fund.value.keys()].sort();
  return fund;
}

// The months whose returns make up a period, or null if the data doesn't go back that far.
export function periodMonths(fund: Fund, period: Period): string[] | null {
  const withReturns = fund.months.slice(1); // the first month has nothing before it
  const lastMonth = Number(fund.months.at(-1)!.slice(5, 7));
  const count = { "1M": 1, "3M": 3, "6M": 6, YTD: lastMonth, "1Y": 12, "3Y": 36, "5Y": 60, Max: withReturns.length }[period];
  return count <= withReturns.length ? withReturns.slice(-count) : null;
}

// The fund's return in one month: everything it earned divided by its value at the start of the month.
export function fundReturn(fund: Fund, month: string): number {
  return earnedIn(fund, month) / fund.value.get(previousMonth(fund, month))!;
}

// One position's return in one month. Money added or removed during the month counts half (Modified Dietz).
export function positionReturn(fund: Fund, ticker: string, month: string): number | null {
  const row = fund.positions.get(ticker)?.get(month);
  if (!row) return null;
  const startValue = fund.positions.get(ticker)!.get(previousMonth(fund, month))?.value ?? 0;
  const base = startValue + row.flow / 2;
  return base > 1 ? (row.capGains + row.income) / base : null;
}

// How much one position added to the fund's return in one month. All positions add up to fundReturn.
export function positionContribution(fund: Fund, ticker: string, month: string): number {
  const row = fund.positions.get(ticker)?.get(month);
  return row ? (row.capGains + row.income) / fund.value.get(previousMonth(fund, month))! : 0;
}

// A position's return over several months, or null if the fund didn't hold it for all of them.
export function positionPeriodReturn(fund: Fund, ticker: string, months: string[]): number | null {
  if (heldSince(fund, ticker) > previousMonth(fund, months[0])) return null;
  return compound(months.map((month) => positionReturn(fund, ticker, month) ?? 0));
}

// Each position's contribution over several months. Adding up monthly contributions doesn't exactly
// equal the compounded fund return, so they're scaled to add up to it.
export function contributions(fund: Fund, months: string[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const ticker of fund.positions.keys()) {
    sums.set(ticker, months.reduce((sum, month) => sum + positionContribution(fund, ticker, month), 0));
  }
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  const scale = total ? compound(months.map((month) => fundReturn(fund, month))) / total : 0;
  return new Map([...sums].map(([ticker, sum]) => [ticker, sum * scale]));
}

// First month of the position's current, unbroken stretch of being held.
export function heldSince(fund: Fund, ticker: string): string {
  const byMonth = fund.positions.get(ticker)!;
  let i = fund.months.length - 1;
  while (i > 0 && (byMonth.get(fund.months[i - 1])?.value ?? 0) > 0) i--;
  return fund.months[i];
}

export function compound(returns: number[]): number {
  return returns.reduce((growth, r) => growth * (1 + r), 1) - 1;
}

// Per-year return for periods longer than a year; shorter periods are left as they are.
export function annualize(total: number, months: number): number {
  return months > 12 ? (1 + total) ** (12 / months) - 1 : total;
}

// $100 invested at the start, month by month (one more value than returns).
export function growthOf100(returns: number[]): number[] {
  const values = [100];
  for (const r of returns) values.push(values.at(-1)! * (1 + r));
  return values;
}

function earnedIn(fund: Fund, month: string): number {
  let earned = 0;
  for (const byMonth of fund.positions.values()) {
    const row = byMonth.get(month);
    if (row) earned += row.capGains + row.income;
  }
  return earned;
}

function previousMonth(fund: Fund, month: string): string {
  return fund.months[fund.months.indexOf(month) - 1];
}
