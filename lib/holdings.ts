// Reads and checks the monthly holdings CSV the professor assembles (data/holdings.csv).

export type HoldingRow = {
  line: number; // line number in the CSV, for error messages
  date: string; // month-end, YYYY-MM-DD
  fund: string; // "equity" or "fixed income"
  ticker: string;
  name: string;
  type: string; // Equities, ETFs, Cash, Bond, Mutual Fund
  value: number; // market value at month-end
  income: number; // dividends or interest received this month
  flow: number; // money put in (+) or taken out (-) this month
  capGains: number; // gain or loss in price this month
};

const REQUIRED_COLUMNS = ["Date", "fund", "Ticker", "name", "type", "value", "income", "flow", "cap_gains"];
const FUNDS = ["equity", "fixed income"];

export function readHoldingsCsv(text: string): HoldingRow[] {
  const [header, ...lines] = text.trim().split(/\r?\n/).map(splitCsvLine);
  const column = new Map(header.map((name, i) => [name.trim(), i]));
  const missing = REQUIRED_COLUMNS.filter((name) => !column.has(name));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);

  return lines.map((cells, i) => {
    const get = (name: string) => (cells[column.get(name)!] ?? "").trim();
    return {
      line: i + 2,
      date: get("Date"),
      fund: get("fund"),
      ticker: get("Ticker"),
      name: get("name"),
      type: get("type"),
      value: toNumber(get("value"), NaN), // required
      income: toNumber(get("income"), 0), // NA means none
      flow: toNumber(get("flow"), 0),
      capGains: toNumber(get("cap_gains"), 0),
    };
  });
}

// Returns problems in plain English. An empty list means the file is usable.
export function checkHoldings(rows: HoldingRow[]): string[] {
  const problems: string[] = [];
  const byKey = new Map<string, HoldingRow>(); // "fund|ticker|date" -> row

  for (const row of rows) {
    const at = `Line ${row.line} (${row.ticker} ${row.date})`;
    if (!isMonthEnd(row.date)) problems.push(`${at}: Date must be a month-end, like 2026-09-30`);
    if (!FUNDS.includes(row.fund)) problems.push(`${at}: fund must be "equity" or "fixed income"`);
    if (!row.ticker) problems.push(`${at}: Ticker is empty`);
    for (const field of ["value", "income", "flow", "capGains"] as const) {
      if (Number.isNaN(row[field])) problems.push(`${at}: ${field} is not a number`);
    }
    const key = `${row.fund}|${row.ticker}|${row.date}`;
    if (byKey.has(key)) problems.push(`${at}: same fund, ticker and date as line ${byKey.get(key)!.line}`);
    byKey.set(key, row);
  }

  const dates = [...new Set(rows.map((row) => row.date))].sort();
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] !== nextMonthEnd(dates[i - 1])) problems.push(`No rows for the month after ${dates[i - 1]}`);
  }

  // Every month must add up: value = last month's value + flow + cap_gains.
  // Returns are calculated from this, so a mismatch would mean wrong numbers on the site.
  for (const row of rows) {
    const i = dates.indexOf(row.date);
    if (i === 0) continue; // first month has nothing before it
    const lastMonth = byKey.get(`${row.fund}|${row.ticker}|${dates[i - 1]}`)?.value ?? 0;
    const expected = lastMonth + row.flow + row.capGains;
    if (Math.abs(row.value - expected) > 1) {
      problems.push(`Line ${row.line} (${row.ticker} ${row.date}): value is ${row.value} but last month + flow + cap_gains = ${expected.toFixed(2)}`);
    }
  }
  return problems;
}

function toNumber(text: string, blank: number): number {
  return text === "" || text === "NA" ? blank : Number(text);
}

// Splits one CSV line. Handles "quoted, cells" because spreadsheet apps quote names that contain commas.
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { cells.push(cell); cell = ""; }
    else cell += ch;
  }
  return [...cells, cell];
}

// Last day of a month as YYYY-MM-DD (month is 1-12; 13 rolls into next year).
function monthEnd(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function isMonthEnd(date: string): boolean {
  const [year, month] = date.split("-").map(Number);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date === monthEnd(year, month);
}

function nextMonthEnd(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return monthEnd(year, month + 1);
}
