// The Holdings tab: the stock map (default) or the sector map, zooming into one sector,
// and the sector page that opens when you click a block.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Period } from "@/lib/performance";
import type { Group, SiteData } from "@/lib/site-data";
import { share } from "@/lib/format";
import { reduceMotion } from "./dom";
import SectorMap from "./SectorMap";
import SectorPanel from "./SectorPanel";
import StockMap from "./StockMap";
import styles from "./HoldingsView.module.css";

type Props = { data: SiteData; period: Period; active: boolean };
type Opened = { group: Group; ticker: string | null; from: HTMLElement };

export default function HoldingsView({ data, period, active }: Props) {
  const [mode, setMode] = useState<"stocks" | "sectors">("stocks");
  const [zoom, setZoom] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const zoomedFrom = useRef({ scroll: 0, group: "", animate: "" as "" | "in" | "out" });
  const mapArea = useRef<HTMLDivElement>(null);

  const zoomTo = (group: string) => {
    zoomedFrom.current = { scroll: scrollY, group, animate: "in" };
    setZoom(group);
  };
  const unzoom = () => {
    zoomedFrom.current.animate = "out";
    setZoom(null);
  };

  // A zoomed sector always opens at the top; going back returns to where you were, with focus on that sector's label.
  useLayoutEffect(() => {
    const { scroll, group, animate } = zoomedFrom.current;
    if (!animate) return;
    zoomedFrom.current.animate = "";
    scrollTo(0, animate === "in" ? 0 : scroll);
    if (animate === "out") mapArea.current?.querySelector<HTMLElement>(`[data-group="${CSS.escape(group)}"] button`)?.focus({ preventScroll: true });
    if (!reduceMotion()) mapArea.current?.animate(
      [{ opacity: 0, transform: `scale(${animate === "in" ? 0.97 : 1.03})` }, { opacity: 1, transform: "none" }],
      { duration: 180, easing: "ease-out" });
  }, [zoom]);

  // Esc steps back out of a zoom (the sector page handles Esc itself while open).
  useEffect(() => {
    if (!active || opened || !zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); unzoom(); } };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [active, opened, zoom]);

  const zoomed = mode === "stocks" ? data.groups.find((g) => g.name === zoom) : undefined;
  const open = (group: Group, ticker: string | null, from: HTMLElement) => setOpened({ group, ticker, from });

  return (
    <>
      <div className={styles.tools}>
        {zoomed ? (
          <>
            <button className={styles.crumb} onClick={unzoom}>← All stocks</button>
            <h2 className={styles.zoomTitle}>{zoomed.name}</h2>
            <p className={styles.zoomFacts}>
              {share(zoomed.weight)} of fund · {zoomed.holdings.length} holding{zoomed.holdings.length > 1 ? "s" : ""} · tap a stock for details
            </p>
          </>
        ) : (
          <>
            <div className="seg" aria-label="Group holdings">
              <button aria-pressed={mode === "stocks"} onClick={() => setMode("stocks")}>By stock</button>
              <button aria-pressed={mode === "sectors"} onClick={() => { setMode("sectors"); setZoom(null); }}>By sector</button>
            </div>
            <span className={styles.hint}>
              {mode === "stocks"
                ? `Size = share of the fund · color = return vs VTI, ${period} · tap a sector name to zoom in`
                : "Size = share of the fund · color = over / underweight vs VTI"}
            </span>
          </>
        )}
      </div>

      <div ref={mapArea}>
        {mode === "stocks"
          ? <StockMap data={data} period={period} zoom={zoom} onZoom={zoomTo} onOpen={open} />
          : <SectorMap data={data} period={period} onOpen={open} />}
      </div>

      {opened && (
        <SectorPanel data={data} group={opened.group} period={period} focusTicker={opened.ticker} from={opened.from}
          active={active} onClose={() => setOpened(null)} />
      )}
    </>
  );
}
