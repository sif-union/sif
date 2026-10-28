// Sticky header: title, tabs, period bar and the fund's headline numbers for the chosen period.
import { useEffect, useLayoutEffect, useRef } from "react";
import { annualize, PERIODS, type Period } from "@/lib/performance";
import { fullDate, money, monthYear, pct, pp, tone } from "@/lib/format";
import type { SiteData } from "@/lib/site-data";
import styles from "./Header.module.css";

export type View = "holdings" | "contribution";

type Props = { data: SiteData; period: Period; onPeriod: (p: Period) => void; view: View; onView: (v: View) => void };

export default function Header({ data, period, onPeriod, view, onView }: Props) {
  // The map and the sector page size themselves to the space under the header (--hdr-h).
  const header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = header.current!;
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty("--hdr-h", el.offsetHeight + "px"));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header className={styles.header} ref={header}>
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
      <UploadCorner />
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

// An invisible spot in the top-right corner: 6 clicks within 3 seconds open the upload page.
function UploadCorner() {
  const clicks = useRef<number[]>([]);
  const onClick = () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 3000), now];
    if (clicks.current.length >= 6) location.href = "/upload";
  };
  return <button className={styles.corner} tabIndex={-1} aria-hidden="true" onClick={onClick} />;
}

function updateFades(el: HTMLElement) {
  el.toggleAttribute("data-more-left", el.scrollLeft > 2);
  el.toggleAttribute("data-more-right", el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
}

function Stats({ data, period }: Pick<Props, "data" | "period">) {
  const p = data.periods[period]!;
  // Over a year, lead with the yearly rate and put the total for the whole period in parentheses.
  const long = p.months > 12;
  const yearly = (r: number | null) => (r == null || !long ? r : annualize(r, p.months));
  const perYear = long ? "/yr" : "";
  const total = (text: string) => long && <span className={styles.muted}> ({text} total)</span>;
  const diff = p.vtiReturn == null ? null : yearly(p.fundReturn)! - yearly(p.vtiReturn)!;
  const totalDiff = p.vtiReturn == null ? null : p.fundReturn - p.vtiReturn;

  return (
    <div className={styles.stats}>
      <span>Fund value <b>{money(data.fundValue)}</b></span>
      <span>Fund return <b className={tone(p.fundReturn)}>{pct(yearly(p.fundReturn))}{perYear}</b>{total(pct(p.fundReturn))}</span>
      <span>VTI <b className={tone(p.vtiReturn)}>{pct(yearly(p.vtiReturn))}{perYear}</b>{total(pct(p.vtiReturn))}</span>
      <span>Difference <b className={tone(diff)}>{pp(diff)}{perYear}</b>{total(pp(totalDiff))}</span>
      <span className={styles.muted}>{monthYear(p.start)} → {monthYear(data.asOf)} · data as of {fullDate(data.asOf)}</span>
    </div>
  );
}
