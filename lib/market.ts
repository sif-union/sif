// Prices and news fetched nightly by scripts/fetch-market-data.ts into data/market.json.
export type NewsItem = { headline: string; url: string; source: string; date: string };

export type Market = {
  updated: string; // when the job last ran
  monthEndClose: Record<string, Record<string, number>>; // ticker -> month-end -> close, dividends included
  news: Record<string, NewsItem[]>; // ticker -> latest headlines
};

// Stand-ins for VTI's slice of each sector on the contribution chart: Vanguard's US sector ETFs,
// which cover large, mid and small caps like VTI and use GICS sectors.
export const SECTOR_ETFS: Record<string, string> = {
  "Information Technology": "VGT",
  Financials: "VFH",
  "Health Care": "VHT",
  "Communication Services": "VOX",
  Industrials: "VIS",
  "Consumer Discretionary": "VCR",
  "Consumer Staples": "VDC",
  Energy: "VDE",
  "Real Estate": "VNQ",
  Utilities: "VPU",
  Materials: "VAW",
};

// A ticker's return in each month, from one month-end close to the next.
export function monthlyReturns(closes: Record<string, number>): Map<string, number> {
  const months = Object.keys(closes).sort();
  return new Map(months.slice(1).map((month, i) => [month, closes[month] / closes[months[i]] - 1]));
}
