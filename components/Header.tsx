// Sticky header: title, tabs, period bar and the fund's headline numbers for the chosen period.
import { useEffect, useRef } from "react";
import { annualize, PERIODS, type Period } from "@/lib/performance";
import { fullDate, money, monthYear, pct, pts, tone } from "@/lib/format";
import type { SiteData } from "@/lib/site-data";
import styles from "./Header.module.css";

export type View = "holdings" | "contribution";

type Props = { data: SiteData; period: Period; onPeriod: (p: Period) => void; view: View; onView: (v: View) => void };

export default function Header({ data, period, onPeriod, view, onView }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <span className={styles.eyebrow}>Union College Student Investment Fund</span>
            <h1>Equity Fund Holdings</h1>
          </div>
          <div className="seg" role="tablist" aria-label="View">
            <button aria-pressed={view === "holdings"} onClick={() => onView("holdings")}>Holdings</button>
            <button aria-pressed={view === "contribution"} onClick={() => onView("contribution")}>Contribution</button>
          </div>
          <PeriodBar data={data} period={period} onPeriod={onPeriod} />
        </div>
        <Stats data={data} period={period} />
      </div>
    </header>
  );
}

// On phones the periods scroll sideways: keep the chosen one centered, and fade an edge only when more periods hide behind it.
function PeriodBar({ data, period, onPeriod }: Pick<Props, "data" | "period" | "onPeriod">) {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = list.current!, on = el.querySelector<HTMLElement>('[aria-pressed="true"]')!;
    el.scrollLeft += on.getBoundingClientRect().left - el.getBoundingClientRect().left - (el.clientWidth - on.offsetWidth) / 2;
    updateFades(el);
  }, [period]);

  return (
    <div className={`seg ${styles.periods}`} aria-label="Time period">
      <div className={styles.periodList} ref={list} onScroll={(e) => updateFades(e.currentTarget)}>
        {PERIODS.filter((p) => data.periods[p]).map((p) => (
          <button key={p} aria-pressed={p === period} onClick={() => onPeriod(p)}
            title={p === "Max" ? `Fund: since ${monthYear(data.periods.Max!.start)} (start of data). Stocks: since the fund bought them.` : undefined}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function updateFades(el: HTMLElement) {
  el.toggleAttribute("data-more-left", el.scrollLeft > 2);
  el.toggleAttribute("data-more-right", el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
}

function Stats({ data, period }: Pick<Props, "data" | "period">) {
  const p = data.periods[period]!;
  const diff = p.vtiReturn == null ? null : p.fundReturn - p.vtiReturn;
  const perYear = (r: number | null) => r != null && p.months > 12 && <span className={styles.muted}> ({pct(annualize(r, p.months))}/yr)</span>;

  return (
    <div className={styles.stats}>
      <span>Fund value <b>{money(data.fundValue)}</b></span>
      <span>Fund return <b className={tone(p.fundReturn)}>{pct(p.fundReturn)}</b>{perYear(p.fundReturn)}</span>
      <span>VTI <b className={tone(p.vtiReturn)}>{pct(p.vtiReturn)}</b>{perYear(p.vtiReturn)}</span>
      <span>Difference <b className={tone(diff)}>{pts(diff)}</b></span>
      <span className={styles.muted}>{monthYear(p.start)} → {monthYear(data.asOf)} · data as of {fullDate(data.asOf)}</span>
    </div>
  );
}
