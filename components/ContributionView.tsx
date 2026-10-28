// The Contribution tab: a butterfly chart of how many points each group added to the return, VTI on the left, the fund on the right.
import type { Period } from "@/lib/performance";
import type { Contribution, SiteData } from "@/lib/site-data";
import { monthYear, pct, pp, tone } from "@/lib/format";
import { TipRow, useTip } from "./Tooltip";
import styles from "./ContributionView.module.css";

const TINY = 0.00005; // under half a hundredth of a point shows as "–"

export default function ContributionView({ data, period }: { data: SiteData; period: Period }) {
  const p = data.periods[period]!;
  const tip = useTip();
  const rows = p.contribution.filter((c) => Math.abs(c.fund) > TINY || Math.abs(c.vti) > TINY).sort((a, b) => b.fund - a.fund);
  const max = Math.max(...rows.flatMap((r) => [Math.abs(r.fund), Math.abs(r.vti)]), 1e-9);
  const kindOf = (name: string) => data.groups.find((g) => g.name === name)?.kind; // none for "Sold positions"
  const number = (v: number) => (Math.abs(v) < TINY ? "–" : pp(v, 2).replace(" pp", ""));

  const bar = (v: number, side: "left" | "right") => (
    <div className={`${styles.track} ${styles[side]}`}>
      <div className={styles.bar} style={{ width: `${(Math.abs(v) / max) * 100}%`, background: v >= 0 ? "var(--good)" : "var(--bad)" }} />
    </div>
  );
  const row = (r: Contribution) => {
    const kind = kindOf(r.name);
    const sub = !kind ? "no longer held" : kind === "etf" ? "ETF theme" : kind === "cash" ? "cash" : "";
    return (
      <div key={r.name} className={styles.row}
        {...tip(<><b>{r.name}</b><TipRow label="SIF contribution" value={pp(r.fund, 2)} /><TipRow label="VTI contribution" value={pp(r.vti, 2)} /><TipRow label="Difference" value={pp(r.fund - r.vti, 2)} /></>)}>
        <span className={`${styles.val} ${styles.l} ${tone(r.vti)}`}>{number(r.vti)}</span>
        {bar(r.vti, "left")}
        <span className={styles.label}>{r.name}{sub && <small>{sub}</small>}</span>
        {bar(r.fund, "right")}
        <span className={`${styles.val} ${tone(r.fund)}`}>{number(r.fund)}</span>
      </div>
    );
  };

  return (
    <>
      <div className={styles.head}>
        <div>
          <h2>Where the return came from</h2>
          <p>
            Percentage points each sector added to (or took away from) the return, {monthYear(p.start)} → {monthYear(data.asOf)}.
            {p.months > 12 && " Multi-year periods show the total over the whole period, not per year."}
          </p>
        </div>
        <div className={styles.key}>
          <span><i style={{ background: "var(--good)" }} />Added to return (+)</span>
          <span><i style={{ background: "var(--bad)" }} />Subtracted (−)</span>
        </div>
      </div>
      <div className={styles.chart}>
        <div className={`${styles.row} ${styles.colHead}`}><span className={styles.l}>← VTI</span><span /><span className={styles.r}>SIF →</span></div>
        {rows.map(row)}
        <div className={`${styles.row} ${styles.total}`}>
          <span className={`${styles.val} ${styles.l} ${tone(p.vtiReturn)}`}>{pct(p.vtiReturn)}</span><span />
          <span className={styles.label}>Total return</span><span />
          <span className={`${styles.val} ${tone(p.fundReturn)}`}>{pct(p.fundReturn)}</span>
        </div>
      </div>
      <p className={styles.foot}>
        Contribution = how many percentage points each group added to the total return over the period. The SIF side comes from
        the holdings CSV and adds up to the fund&apos;s return; sold positions stay in their sector, and sold ETFs are grouped together.
        The VTI side multiplies each sector&apos;s current weight in VTI by the return of Vanguard&apos;s ETF for that sector, then
        spreads the small leftover gap so it adds up to VTI&apos;s actual return. It is an estimate, best for recent periods.
      </p>
    </>
  );
}
