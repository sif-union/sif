// Every holding as a block sized by its share of the fund, grouped in sector frames,
// colored by its return vs VTI over the chosen period.
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import type { Period } from "@/lib/performance";
import type { Group, Holding, SiteData } from "@/lib/site-data";
import { annualize } from "@/lib/performance";
import { monthYear, pct, pp, share } from "@/lib/format";
import { mix } from "./colors";
import { useSize } from "./dom";
import { TipRow, useTip } from "./Tooltip";
import styles from "./Treemap.module.css";

// Return vs VTI (points) that gets the full green or red. Multi-year periods are per year, so they get a tighter range.
const RANGE: Record<Period, number> = { "1M": 0.1, "3M": 0.15, "6M": 0.2, YTD: 0.25, "1Y": 0.3, "3Y": 0.15, "5Y": 0.15, Max: 0.15 };
const LABEL_H = 22;

type Node = { group?: Group; holding?: Holding; children?: Node[] };
type Rect = HierarchyRectangularNode<Node>;

type Props = {
  data: SiteData;
  period: Period;
  zoom: string | null; // the sector zoomed into, if any
  onZoom: (group: string) => void;
  onOpen: (group: Group, ticker: string, from: HTMLElement) => void;
};

// The holding's return minus VTI's over the same months, per year for periods over a year. Null if not held throughout.
export function vsVti(h: Holding, period: Period): number | null {
  const p = h.periods[period];
  if (!p || p.return == null || p.vtiReturn == null) return null;
  return annualize(p.return, p.months) - annualize(p.vtiReturn, p.months);
}

export default function StockMap({ data, period, zoom, onZoom, onOpen }: Props) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const tip = useTip();

  // A frame gets a label (and its padding) only when there's room left for stocks under it; zoomed, the title is above the map instead.
  const hasLabel = (n: Rect) => !zoom && n.y1 - n.y0 >= LABEL_H + 22 && n.x1 - n.x0 >= 44;
  const pad = (n: Rect) => (n.y1 - n.y0 >= 16 && n.x1 - n.x0 >= 16 ? 3 : 0);
  const padTop = (n: Rect) => (hasLabel(n) ? LABEL_H : pad(n));

  const groups = data.groups.filter((g) => g.value > 0 && (!zoom || g.name === zoom));
  const root = hierarchy<Node>({ children: groups.map((g) => ({ group: g, children: g.holdings.map((t) => ({ holding: data.holdings[t] })) })) })
    .sum((d) => d.holding?.value ?? 0)
    .sort((a, b) => b.value! - a.value!);
  const layout = treemap<Node>().size([width, height]).round(true).tile(treemapSquarify.ratio(1.15))
    .paddingInner((n) => (n.depth === 0 ? 6 : 3))
    .paddingTop((n) => (n.depth === 1 ? padTop(n as Rect) : 0))
    .paddingLeft((n) => (n.depth === 1 ? pad(n as Rect) : 0))
    .paddingRight((n) => (n.depth === 1 ? pad(n as Rect) : 0))
    .paddingBottom((n) => (n.depth === 1 ? pad(n as Rect) : 0))(root);

  return (
    <>
      <div className={styles.map} ref={ref} aria-label="Fund holdings sized by weight">
        {width > 0 && layout.children?.map((frame) => {
          const g = frame.data.group!;
          return (
            <div key={g.name} className={styles.frame} data-group={g.name} style={box(frame)}>
              {hasLabel(frame) && (
                <button className={styles.frameLabel} onClick={() => onZoom(g.name)} aria-label={`Zoom into ${g.name}`}>
                  {g.name} <span>{share(g.weight)}</span><i aria-hidden="true">›</i>
                </button>
              )}
            </div>
          );
        })}
        {width > 0 && layout.leaves().map((n) => {
          const h = n.data.holding!, frame = n.parent!, g = frame.data.group!;
          // keep blocks inside the frame's padding (d3 can push tiny ones past it) and skip slivers; zooming shows them
          const x0 = Math.max(n.x0, frame.x0 + pad(frame)), x1 = Math.min(n.x1, frame.x1 - pad(frame));
          const y0 = Math.max(n.y0, frame.y0 + padTop(frame)), y1 = Math.min(n.y1, frame.y1 - pad(frame));
          const w = x1 - x0, ht = y1 - y0;
          if (w < 6 || ht < 6) return null;

          const size = w < 26 || ht < 18 ? "xxs" : w < 56 || ht < 40 ? "xs" : w < 110 || ht < 70 ? "s" : w > 220 && ht > 150 ? "big" : undefined;
          const tiny = !zoom && (size === "xxs" || w < 40 || ht < 30); // too small to read or tap: tapping zooms into the sector
          const rel = vsVti(h, period);
          const t = rel == null ? 0 : Math.max(-1, Math.min(1, rel / RANGE[period]));
          const fill = h.kind === "cash" ? null : mix(t && Math.sign(t) * (Math.abs(t) * 0.85 + 0.15), "--bad", "--good");
          const relText = h.kind === "cash" ? "cash" : rel == null ? `held < ${period}` : pp(rel);
          const p = h.periods[period];

          return (
            <button key={h.ticker} className={`${styles.block} ${styles.stock}`} data-size={size} data-ticker={h.ticker}
              data-strong={fill?.strong || undefined} data-hatched={!fill || undefined}
              style={{ left: x0, top: y0, width: w, height: ht, background: fill?.background }}
              aria-label={`${h.ticker}, ${share(h.weight)} of fund, ${relText} vs VTI`}
              onClick={(e) => (tiny ? onZoom(g.name) : onOpen(g, h.ticker, e.currentTarget))}
              {...tip(<>
                <b>{h.ticker}</b> · {h.name}
                <TipRow label="Share of fund" value={share(h.weight)} />
                {h.kind !== "cash" && (rel == null
                  ? <div className={styles.tipNote}>Held since {monthYear(h.since)}, less than {period}</div>
                  : <>
                      <TipRow label={`Return (${period === "Max" ? "since bought" : period})`} value={pct(annualize(p!.return!, p!.months))} />
                      <TipRow label="VTI, same months" value={pct(annualize(p!.vtiReturn!, p!.months))} />
                      <TipRow label="vs VTI" value={pp(rel)} />
                    </>)}
                <div className={styles.tipNote}>{g.name} · {tiny ? "click to zoom into the sector" : "click for details"}</div>
              </>)}>
              <span className={styles.tk}>{h.ticker}</span>
              <span className={styles.tv}>{relText}</span>
              <span className={styles.tm}>{share(h.weight)} of fund</span>
            </button>
          );
        })}
      </div>

      <div className={styles.legend}>
        <div className={styles.ramp}>
          <span>Trailed VTI</span>
          <div className={styles.rampBar} style={{ background: "linear-gradient(90deg, var(--bad), var(--div-mid), var(--good))" }} />
          <span>Beat VTI</span>
          <div className={styles.rampTicks}><span>−{RANGE[period] * 100} pp</span><span>same</span><span>+{RANGE[period] * 100} pp</span></div>
        </div>
        <span><span className={`${styles.swatch} ${styles.flat}`} />Not held for the full period</span>
        <span><span className={styles.swatch} />Cash</span>
      </div>
    </>
  );
}

export const box = (n: { x0: number; y0: number; x1: number; y1: number }) => ({ left: n.x0, top: n.y0, width: n.x1 - n.x0, height: n.y1 - n.y0 });
