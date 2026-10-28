// How numbers and dates are written on the page. Returns come in as fractions (0.05 = +5%).
const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");

export const pct = (v: number | null, digits = 1) => (v == null ? "—" : sign(v) + Math.abs(v * 100).toFixed(digits) + "%");
export const pp = (v: number | null, digits = 1) => (v == null ? "—" : sign(v) + Math.abs(v * 100).toFixed(digits) + " pp");
export const share = (v: number, digits = 1) => (v * 100).toFixed(digits) + "%"; // a weight, no sign
export const money = (v: number) => (v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + Math.round(v / 1000) + "K");

// green for gains, red for losses (classes in app/globals.css)
export const tone = (v: number | null) => (v == null ? "" : v > 0 ? "pos" : v < 0 ? "neg" : "");

// "2026-09-30" -> "Sep 2026"; noon so no time zone can shift it to another day
export const monthYear = (date: string) => new Date(date + "T12:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
export const fullDate = (date: string) => new Date(date + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
