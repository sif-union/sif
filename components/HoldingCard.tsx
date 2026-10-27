// One holding's row on the sector page. Collapsed: numbers and the pitch. Expanded: the chart and news too.
import type { Period } from "@/lib/performance";
import type { Holding } from "@/lib/site-data";
import { annualize } from "@/lib/performance";
import { money, monthYear, pct, pts, share, tone } from "@/lib/format";
import GrowthChart from "./GrowthChart";
import { vsVti } from "./StockMap";
import { Help } from "./Tooltip";
import styles from "./HoldingCard.module.css";

type Props = { holding: Holding; period: Period; expanded: boolean; hidden: boolean; onToggle: (card: HTMLElement) => void };

export default function HoldingCard({ holding: h, period, expanded, hidden, onToggle }: Props) {
  const p = h.periods[period]!;
  const perYear = p.months > 12 ? "/yr" : "";
  const r = p.return == null ? null : annualize(p.return, p.months);
  const vr = p.vtiReturn == null ? null : annualize(p.vtiReturn, p.months);
  const rel = vsVti(h, period);

  return (
    <article className={styles.card} data-card={h.ticker} data-expanded={expanded} hidden={hidden}
      onClick={(e) => { if (!(e.target as HTMLElement).closest("a, [data-help]")) onToggle(e.currentTarget); }}>
      <div className={styles.head}>
        <span className={styles.ticker}>{h.ticker}</span>
        <span className={styles.name}>{h.name}</span>
        <span className={styles.value}>{money(h.value)}</span>
      </div>
      <div className={styles.chips}>
        <span className={styles.chip}>{h.sinceIsDataStart ? "Held since at least" : "Bought"} {monthYear(h.since)}</span>
        {h.income12 > 0 && <span className={styles.chip}>${Math.round(h.income12).toLocaleString()} dividends, last 12 mo</span>}
      </div>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.k}>Return · {period} <Help text="How much this position gained or lost, including dividends. Over 1 year, shown per year." /></div>
          <div className={`${styles.v} ${tone(r)}`}>{pct(r)}{r != null && <span className={styles.sub}>{perYear}</span>}</div>
          <div className={styles.sub}>{r == null ? `Not held for the full ${period}` : `VTI ${pct(vr)}${perYear}`}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.k}>vs VTI <Help text="This position's return minus VTI's return over the same months. Positive = it beat the market." /></div>
          <div className={`${styles.v} ${tone(rel)}`}>{pts(rel)}</div>
          <div className={styles.sub}>{rel == null ? "" : rel > 0 ? "beat the market" : "trailed the market"}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.k}>Contribution <Help text="Percentage points this position added to the whole fund's return. A big position with a small gain can contribute more than a tiny position with a huge gain." /></div>
          <div className={`${styles.v} ${tone(p.contribution)}`}>{pts(p.contribution, 2)}</div>
          <div className={styles.sub}>of fund return, {period}</div>
        </div>
        {h.vtiWeight != null ? (
          <div className={styles.tile}>
            <div className={styles.k}>Weight: fund vs VTI <Help text="Share of the fund in this stock vs. its share of VTI, the benchmark. Bigger than VTI = overweight, meaning we are betting on it." /></div>
            <div className={styles.v}>{share(h.weight)} <span className={styles.sub}>vs {share(h.vtiWeight, 2)}</span></div>
            <div className={styles.bars}>
              <WeightBar label="SIF" width={h.weight / Math.max(h.weight, h.vtiWeight)} color="var(--series-1)" />
              <WeightBar label="VTI" width={h.vtiWeight / Math.max(h.weight, h.vtiWeight)} color="var(--bench)" />
            </div>
          </div>
        ) : (
          <div className={styles.tile}>
            <div className={styles.k}>Weight in fund <Help text={h.kind === "cash" ? "Cash and T-bills held for flexibility." : "ETFs are baskets of many stocks, so there is no single VTI weight to compare."} /></div>
            <div className={styles.v}>{share(h.weight)}</div>
            <div className={styles.sub}>{h.kind === "cash" ? "cash" : "ETF, not compared to VTI"}</div>
          </div>
        )}
      </div>

      <div className={styles.pitch}>
        <h4 className={styles.panelTitle}>Why we own it {h.pitch && <span className={styles.tag}>{h.pitch.placeholder ? "Placeholder" : "From the pitch"}</span>}</h4>
        <p>{h.pitch?.summary ?? "No pitch summary yet."}</p>
        {h.pitch?.deck
          ? <a className={styles.deck} href={h.pitch.deck} target="_blank" rel="noopener">Full pitch deck →</a>
          : <span className={`${styles.deck} ${styles.off}`}>Pitch deck · link coming</span>}
      </div>

      <div className={styles.more}>
        <div className={styles.moreInner} data-more>
          <div className={styles.body}>
            <GrowthChart holding={h} period={period} />
            <div>
              <h4 className={styles.panelTitle}>Recent news</h4>
              {h.news.length ? (
                <ul className={styles.news}>
                  {h.news.map((n) => (
                    <li key={n.url}>
                      <a href={n.url} target="_blank" rel="noopener">{n.headline}</a>
                      <span className={styles.src}>{n.source} · {monthYear(n.date)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className={styles.note}>No recent news.</p>}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.toggle}>
        <button aria-expanded={expanded}>{expanded ? "Hide" : "Show"} chart &amp; news <span className={styles.chev}>▾</span></button>
      </div>
    </article>
  );
}

function WeightBar({ label, width, color }: { label: string; width: number; color: string }) {
  return <div className={styles.bar}><span>{label}</span><i style={{ width: `${width * 100}%`, background: color }} /></div>;
}
