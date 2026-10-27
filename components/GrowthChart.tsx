// Growth of $100 in one holding vs VTI over the chosen period, with a hover readout.
import { useState } from "react";
import { curveMonotoneX, line } from "d3-shape";
import type { Period } from "@/lib/performance";
import type { Holding } from "@/lib/site-data";
import { monthYear } from "@/lib/format";
import { useSize } from "./dom";
import { TipRow, useTip } from "./Tooltip";
import styles from "./HoldingCard.module.css";

const H = 180, M = { top: 10, right: 46, bottom: 22, left: 36 };

export default function GrowthChart({ holding: h, period }: { holding: Holding; period: Period }) {
  const [ref, { width: W }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const tip = useTip();

  // The period's months plus the starting point, rebased to $100 there. Held for less than the period: everything since bought.
  const months = h.periods[period]!.months;
  const all = h.growth;
  const shown = period === "Max" || all.length < months + 1 ? all : all.slice(-(months + 1));
  const points = shown.map((p) => ({ month: p.month, a: (p.holding / shown[0].holding) * 100, v: (p.vti / shown[0].vti) * 100 }));
  const note = period !== "Max" && all.length < months + 1 ? `Held for less than ${period}, showing since ${monthYear(h.since)}.`
    : h.sinceIsDataStart && shown === all ? `Data starts ${monthYear(h.since)}; the position may be older.` : "";

  const n = points.length;
  const values = points.flatMap((p) => [p.a, p.v]);
  const y = niceScale(Math.min(...values), Math.max(...values), H - M.bottom, M.top);
  const x = (i: number) => M.left + (n > 1 ? (i / (n - 1)) * (W - M.left - M.right) : 0);
  const path = (key: "a" | "v") => line<(typeof points)[number]>().x((_, i) => x(i)).y((p) => y.at(p[key])).curve(curveMonotoneX)(points) ?? "";

  // x labels: years on long charts (at each January), months on short ones, thinned to fit
  const long = n > 14;
  const candidates = points.map((_, i) => i).filter((i) => !long || points[i].month.slice(5, 7) === "01");
  const every = Math.ceil(candidates.length / Math.max(2, Math.floor(W / 140)));
  const xLabels = candidates.filter((_, k) => k % every === 0);

  // end labels, pushed apart when the lines finish close together
  const last = points[n - 1];
  let ya = y.at(last.a), yv = y.at(last.v);
  if (Math.abs(ya - yv) < 13) { const mid = (ya + yv) / 2, up = ya < yv; ya = mid + (up ? -7 : 7); yv = mid + (up ? 7 : -7); }

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const mx = e.clientX - e.currentTarget.ownerSVGElement!.getBoundingClientRect().left;
    const i = Math.max(0, Math.min(n - 1, Math.round(((mx - M.left) / (W - M.left - M.right)) * (n - 1))));
    setHover(i);
    tip(<><b>{monthYear(points[i].month)}</b><TipRow label={h.ticker} value={`$${points[i].a.toFixed(0)}`} /><TipRow label="VTI" value={`$${points[i].v.toFixed(0)}`} /></>).onPointerMove(e);
  };

  return (
    <div className={styles.chart} ref={ref}>
      <h4 className={styles.panelTitle}>Growth of $100 vs VTI</h4>
      {W > 0 && n > 1 && (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Growth of 100 dollars in ${h.ticker} vs VTI`}>
          {y.ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y.at(t)} y2={y.at(t)} style={{ stroke: "var(--border)" }} />
              <text x={M.left - 6} y={y.at(t) + 4} textAnchor="end" className={styles.axis}>${t}</text>
            </g>
          ))}
          {xLabels.map((i) => (
            <text key={i} x={x(i)} y={H - 4} textAnchor="middle" className={styles.axis}>
              {long ? points[i].month.slice(0, 4) : monthYear(points[i].month).replace(/ 20(\d\d)$/, " $1")}
            </text>
          ))}
          <path d={path("v")} fill="none" strokeWidth={2} strokeDasharray="4 3" style={{ stroke: "var(--bench)" }} />
          <path d={path("a")} fill="none" strokeWidth={2} style={{ stroke: "var(--series-1)" }} />
          <text x={W - M.right + 6} y={ya + 4} className={styles.endLabel}>{h.ticker}</text>
          <text x={W - M.right + 6} y={yv + 4} className={styles.axis}>VTI</text>
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={H - M.bottom} opacity={0.5} style={{ stroke: "var(--text-muted)" }} />
              <circle cx={x(hover)} cy={y.at(points[hover].v)} r={4} strokeWidth={2} style={{ fill: "var(--bench)", stroke: "var(--surface-1)" }} />
              <circle cx={x(hover)} cy={y.at(points[hover].a)} r={4} strokeWidth={2} style={{ fill: "var(--series-1)", stroke: "var(--surface-1)" }} />
            </g>
          )}
          <rect x={M.left} width={Math.max(0, W - M.left - M.right)} height={H} fill="transparent"
            onPointerMove={onMove} onPointerLeave={() => { setHover(null); tip(null).onPointerLeave(); }} />
        </svg>
      )}
      {n < 2 && <p className={styles.note}>Bought this month; the chart starts next month.</p>}
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}

// A y scale whose ends land on round numbers, with about 4 gridlines.
function niceScale(lo: number, hi: number, bottom: number, top: number) {
  const rough = (hi - lo || 1) / 4, mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough)!;
  const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t));
  return { ticks, at: (v: number) => bottom - ((v - min) / (max - min || 1)) * (bottom - top) };
}
