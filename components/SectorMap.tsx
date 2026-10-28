// One block per sector or ETF theme, sized by its share of the fund, colored by how over- or underweight it is vs VTI.
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import type { Period } from "@/lib/performance";
import type { Group, SiteData } from "@/lib/site-data";
import { pp, share } from "@/lib/format";
import { groupFill } from "./colors";
import { useSize } from "./dom";
import { box } from "./StockMap";
import { TipRow, useTip } from "./Tooltip";
import styles from "./Treemap.module.css";

type Props = { data: SiteData; period: Period; onOpen: (group: Group, ticker: null, from: HTMLElement) => void };

export default function SectorMap({ data, period, onOpen }: Props) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const tip = useTip();
  const contributionOf = (name: string) => data.periods[period]!.contribution.find((c) => c.name === name)?.fund ?? 0;

  const held = data.groups.filter((g) => g.value > 0);
  const notHeld = data.groups.filter((g) => g.value === 0);
  const root = hierarchy<{ group?: Group; children?: { group: Group }[] }>({ children: held.map((group) => ({ group })) })
    .sum((d) => d.group?.value ?? 0)
    .sort((a, b) => b.value! - a.value!);
  const layout = treemap<typeof root.data>().size([width, height]).paddingInner(5).round(true).tile(treemapSquarify.ratio(1.15))(root);

  return (
    <>
      <div className={styles.map} ref={ref} aria-label="Fund sectors sized by weight">
        {width > 0 && layout.leaves().map((n) => {
          const g = n.data.group!, w = n.x1 - n.x0, h = n.y1 - n.y0;
          const fill = groupFill(g);
          const overweight = g.vtiWeight == null ? null : g.weight - g.vtiWeight;
          const meta = overweight != null ? `${pp(overweight)} vs VTI` : g.kind === "cash" ? "Cash" : "ETF theme";
          const c = contributionOf(g.name);
          const size = w < 70 || h < 46 ? "xxs" : w < 120 || h < 90 ? "xs" : w < 190 || h < 140 ? "s" : "l";
          const show = linesThatFit(g.name, w, h, size);
          return (
            <button key={g.name} className={styles.block} data-group={g.name} data-size={size}
              data-strong={fill?.strong || undefined} data-hatched={!fill || undefined}
              style={{ ...box(n), background: fill?.background }}
              aria-label={`${g.name}, ${share(g.weight)} of fund, ${meta}`}
              onClick={(e) => onOpen(g, null, e.currentTarget)}
              {...tip(<>
                <b>{g.name}</b>
                <TipRow label="Share of fund" value={share(g.weight)} />
                {overweight != null && <>
                  <TipRow label="Share of VTI" value={share(g.vtiWeight!)} />
                  <TipRow label="Over / under" value={pp(overweight)} />
                </>}
                <TipRow label={`Contribution (${period})`} value={pp(c, 2)} />
                <div className={styles.tipNote}>{g.holdings.join(", ")}</div>
              </>)}>
              {show.nameLines > 0 && <span className={styles.bname} data-lines={show.nameLines}>{g.name}</span>}
              <span className={styles.bweight}>{share(g.weight)}</span>
              {show.meta && <span className={styles.bmeta}>{meta}</span>}
              {show.contribution && <span className={styles.bmeta}>{pp(c, 2)} contribution · {period}</span>}
              {show.tickers && <span className={styles.btick}>{g.holdings.join(" · ")}</span>}
            </button>
          );
        })}
      </div>

      <div className={styles.legend}>
        <div className={styles.ramp}>
          <span>Underweight</span>
          <div className={styles.rampBar} style={{ background: "linear-gradient(90deg, var(--div-neg), var(--div-mid), var(--div-pos))" }} />
          <span>Overweight vs VTI</span>
          <div className={styles.rampTicks}><span>−15 pp</span><span>same</span><span>+15 pp</span></div>
        </div>
        <span><span className={styles.swatch} />ETF themes &amp; cash (no VTI weight to compare)</span>
        {notHeld.length > 0 && (
          <span className={styles.muted}>Not held: {notHeld.map((g) => `${g.name} (${share(g.vtiWeight!)} of VTI)`).join(", ")}</span>
        )}
      </div>
    </>
  );
}

// Heights in px, matching Treemap.module.css. The share of the fund is always shown; the other lines
// are added in order of importance while they fit, and each is cut off with "…" if it's too wide.
const SHARE_PX = { l: 38, s: 28, xs: 18, xxs: 16 };
const PAD = { l: [12, 14], s: [12, 14], xs: [8, 9], xxs: [8, 9] };
const LINE_PX = 17, GAP = 2, NAME_CHAR_PX = 8, MIN_NAME_WIDTH = 36;

function linesThatFit(label: string, w: number, h: number, size: keyof typeof SHARE_PX) {
  const [padY, padX] = PAD[size];
  let room = h - 2 * padY - SHARE_PX[size];
  const fits = () => room >= LINE_PX + GAP && ((room -= LINE_PX + GAP), true);
  const nameRoom = w - 2 * padX;
  const name = nameRoom >= MIN_NAME_WIDTH && fits();
  const longestWord = Math.max(...label.split(" ").map((word) => word.length)) * NAME_CHAR_PX;
  const twoLineName = name && label.length * NAME_CHAR_PX > nameRoom && longestWord <= nameRoom && fits(); // never split a word
  const meta = name && fits();
  const contribution = meta && fits();
  const tickers = contribution && fits();
  return { nameLines: twoLineName ? 2 : name ? 1 : 0, meta, contribution, tickers };
}
