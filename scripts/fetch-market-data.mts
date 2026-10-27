// Nightly job (.github/workflows/market-data.yml): month-end prices for VTI and the sector ETFs
// from Yahoo Finance, and recent headlines for each current holding from Finnhub.
// Run by hand with: npm run market-data   (news needs FINNHUB_API_KEY; without it the old news is kept)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readHoldingsCsv } from "../lib/holdings";
import { SECTOR_ETFS, type Market, type NewsItem } from "../lib/market";

const OUT = "data/market.json";
const FIRST_MONTH = "2018-08-01"; // one month before the holdings CSV starts
const NEWS_PER_HOLDING = 3;

const old: Market | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const market: Market = { updated: new Date().toISOString(), monthEndClose: {}, news: old?.news ?? {} };

for (const ticker of ["VTI", ...Object.values(SECTOR_ETFS)]) {
  market.monthEndClose[ticker] = await monthEndCloses(ticker);
}

const key = process.env.FINNHUB_API_KEY;
if (key) {
  const rows = readHoldingsCsv(readFileSync("data/holdings.csv", "utf8"));
  const lastMonth = rows.reduce((last, r) => (r.date > last ? r.date : last), "");
  const held = rows.filter((r) => r.date === lastMonth && r.fund === "equity" && r.type !== "Cash" && r.value > 0);
  market.news = {};
  for (const { ticker } of held) market.news[ticker] = await news(ticker, key);
}

writeFileSync(OUT, JSON.stringify(market, null, 1) + "\n");
console.log(`Wrote ${OUT}: ${Object.keys(market.monthEndClose).length} price series, news for ${Object.keys(market.news).length} holdings`);

// Yahoo's monthly bars are dated the 1st of the month and close on the month's last trading day.
// "adjclose" counts dividends as reinvested, so returns match a total return.
async function monthEndCloses(ticker: string): Promise<Record<string, number>> {
  const from = Date.parse(FIRST_MONTH) / 1000, to = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${from}&period2=${to}&interval=1mo`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Yahoo ${ticker}: ${res.status}`);
  const result = (await res.json()).chart.result[0];
  const closes: Record<string, number> = {};
  result.timestamp.forEach((t: number, i: number) => {
    const close = result.indicators.adjclose[0].adjclose[i];
    if (close != null) closes[monthEnd(new Date(t * 1000))] = close;
  });
  return closes;
}

async function news(ticker: string, key: string): Promise<NewsItem[]> {
  const day = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${day(30 * 86400e3)}&to=${day(0)}&token=${key}`;
  const res = await fetch(url);
  if (!res.ok) return market.news[ticker] ?? []; // e.g. rate limited: keep what we had
  const items: { headline: string; url: string; source: string; datetime: number }[] = await res.json();
  return items
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, NEWS_PER_HOLDING)
    .map((n) => ({ headline: n.headline, url: n.url, source: n.source, date: new Date(n.datetime * 1000).toISOString().slice(0, 10) }));
}

function monthEnd(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}
