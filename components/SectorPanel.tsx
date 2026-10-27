// The page for one sector or ETF theme, opened from a map block: a colored header, a search box,
// and a row per holding. The clicked block grows into the header on open and shrinks back on close.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Period } from "@/lib/performance";
import type { Group, SiteData } from "@/lib/site-data";
import { pts, share, tone } from "@/lib/format";
import { groupFill } from "./colors";
import { animateScroll, reduceMotion } from "./dom";
import HoldingCard from "./HoldingCard";
import { useTip } from "./Tooltip";
import styles from "./SectorPanel.module.css";

type Props = {
  data: SiteData;
  group: Group;
  period: Period;
  focusTicker: string | null; // opened from a stock block: that row starts expanded and in view
  from: HTMLElement; // the block that was clicked
  active: boolean; // false while the Contribution tab is showing
  onClose: () => void;
};

const MORPH_MS = 230;
const isPhone = () => matchMedia("(max-width: 820px)").matches;

export default function SectorPanel({ data, group, period, focusTicker, from, active, onClose }: Props) {
  const [expanded, setExpanded] = useState(() => new Set(focusTicker ? [focusTicker] : []));
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLElement>(null), head = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null);
  const facts = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
  const headSize = useRef({ full: 0, compact: 0 });
  const savedScroll = useRef(0); // the panel loses its scroll position while hidden behind the other tab
  const tip = useTip();

  // ---- layout helpers (they work on the DOM directly, after React has rendered)

  // On phones the content pushes the colored header up as you scroll, cutting off the pills, until only
  // the back button and title are left. Height shrinks as margin grows, so the content never jumps.
  function measureHead() {
    const el = head.current!;
    el.style.height = el.style.marginBottom = "";
    headSize.current = { full: 0, compact: 0 };
    if (!isPhone() || !el.offsetHeight) return;
    const top = el.getBoundingClientRect().top;
    const bottom = Math.max(...[...el.querySelectorAll("[data-keep]")].map((e) => e.getBoundingClientRect().bottom));
    headSize.current = { full: el.offsetHeight, compact: Math.ceil(bottom - top + 10) };
    clipHead();
  }
  function clipHead() {
    const { full, compact } = headSize.current;
    if (!full) return;
    const c = Math.min(Math.max(panel.current!.scrollTop, 0), full - compact);
    head.current!.style.height = full - c + "px";
    head.current!.style.marginBottom = c + "px";
  }

  // The row nearest the middle of the screen is full size; the others shrink and fade with distance.
  // At the very top (or bottom) the first (last) row can't reach the middle, so the focus line starts on it.
  function updateFocus() {
    const sec = panel.current!;
    const headBottom = head.current!.getBoundingClientRect().bottom, visible = sec.getBoundingClientRect().bottom - headBottom;
    const cards = [...sec.querySelectorAll<HTMLElement>("[data-card]:not([hidden])")];
    const center = (c: HTMLElement) => { const r = c.getBoundingClientRect(); return r.top + r.height / 2; };
    let focusY = headBottom + visible / 2;
    if (cards.length) {
      const s = sec.scrollTop, rest = sec.scrollHeight - sec.clientHeight - s;
      focusY = s <= rest ? Math.min(focusY, center(cards[0]) + 2 * s) : Math.max(focusY, center(cards.at(-1)!) - 2 * rest);
    }
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const dist = focusY < r.top ? r.top - focusY : focusY > r.bottom ? focusY - r.bottom : 0;
      const t = Math.min(1, dist / (visible * 0.5));
      c.style.opacity = (1 - 0.6 * t).toFixed(3);
      c.style.transform = reduceMotion() ? "" : `scale(${(1 - 0.09 * t).toFixed(4)})`;
    }
  }
  const settleFocus = () => setTimeout(updateFocus, 260); // after a row finishes expanding

  function relayout() {
    packPills(facts.current!);
    measureHead();
    updateFocus();
  }

  // ---- effects, in this order: re-layout every render, restore scroll on tab return, then the opening animation

  useLayoutEffect(relayout);
  useEffect(() => {
    addEventListener("resize", relayout);
    return () => removeEventListener("resize", relayout);
  }, []);

  useLayoutEffect(() => {
    if (!active) return;
    panel.current!.scrollTop = savedScroll.current;
    clipHead();
    updateFocus();
  }, [active]);

  useLayoutEffect(() => {
    const sec = panel.current!, headEl = head.current!, bodyEl = body.current!;
    // Opened from a stock: scroll its row to just under the header, with the phone header fully
    // collapsed. If the page can't scroll that far, open at the top rather than half-collapsed.
    if (focusTicker) {
      const card = sec.querySelector<HTMLElement>(`[data-card="${CSS.escape(focusTicker)}"]`)!;
      const { full, compact } = headSize.current;
      let s = Math.min(card.offsetTop - (full ? compact : headEl.offsetHeight) - 20, sec.scrollHeight - sec.clientHeight);
      if (s < full - compact) s = 0;
      sec.scrollTop = savedScroll.current = s;
      clipHead();
    }
    const afterOpen = () => { updateFocus(); sec.querySelector<HTMLElement>("[data-back]")!.focus({ preventScroll: true }); };
    if (reduceMotion()) return afterOpen();

    headEl.style.visibility = "hidden";
    bodyEl.style.opacity = "0";
    sec.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MORPH_MS, easing: "ease-out" });
    // a stock block is colored by performance and the header by positioning, so the color blends during the move
    fly(from, getComputedStyle(from).backgroundColor, 12, headEl, getComputedStyle(headEl).backgroundColor, 0, "cubic-bezier(.2,.8,.2,1)").then(() => {
      headEl.style.visibility = bodyEl.style.opacity = "";
      bodyEl.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: "ease-out" });
      afterOpen();
    });
  }, []);

  // Back to the block we came from: the stock's block, else the sector's block or frame.
  function close() {
    const target = (focusTicker && document.querySelector<HTMLElement>(`[data-ticker="${CSS.escape(focusTicker)}"]`))
      || document.querySelector<HTMLElement>(`[data-group="${CSS.escape(group.name)}"]`);
    const done = () => { onClose(); target?.focus({ preventScroll: true }); };
    if (reduceMotion() || !target) return done();
    const headEl = head.current!, headBg = getComputedStyle(headEl).backgroundColor;
    fly(headEl, headBg, 0, target, target.tagName === "BUTTON" ? getComputedStyle(target).backgroundColor : headBg, 12, "cubic-bezier(.4,0,.2,1)");
    headEl.style.visibility = "hidden";
    body.current!.style.opacity = "0";
    panel.current!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MORPH_MS, easing: "ease-in" }).onfinish = done;
  }

  // Esc steps back one level: clear the search, then collapse rows, then close. "/" jumps to the search.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const input = search.current!;
      if (e.key === "Escape") {
        e.preventDefault();
        if (document.activeElement === input && input.value) setQuery("");
        else if (expanded.size) { setExpanded(new Set()); settleFocus(); }
        else close();
      } else if (e.key === "/" && document.activeElement !== input) {
        e.preventDefault();
        input.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [active, expanded]);

  // Expanding a row scrolls it to the middle of the space under the header (or its top just under the header if it's taller).
  function toggle(ticker: string, card: HTMLElement) {
    const open = !expanded.has(ticker);
    const next = new Set(expanded);
    open ? next.add(ticker) : next.delete(ticker);
    if (open) {
      const finalHeight = card.offsetHeight + card.querySelector("[data-more]")!.scrollHeight;
      const headH = head.current!.offsetHeight, visible = panel.current!.clientHeight - headH;
      const top = finalHeight <= visible ? card.offsetTop - headH - (visible - finalHeight) / 2 : card.offsetTop - headH - 16;
      animateScroll(panel.current!, Math.max(0, top), 260);
    }
    setExpanded(next);
    settleFocus();
  }

  // ---- what's shown

  const fill = groupFill(group);
  const c = data.periods[period]!.contribution.find((x) => x.name === group.name) ?? { fund: 0, vti: 0 };
  const overweight = group.vtiWeight == null ? null : group.weight - group.vtiWeight;
  // Green when the positioning paid off: the sector added more to the fund than to VTI (or, with nothing to compare, added anything).
  const paid = group.vtiWeight == null ? c.fund : c.fund - c.vti;
  const paidTip = group.vtiWeight == null
    ? `Green when this holding added to the fund's return (${period}).`
    : `Green when the bet paid off: this sector added ${pts(c.fund, 2)} to the fund vs ${pts(c.vti, 2)} for VTI (${period}).`;
  const count = group.holdings.length, plural = count > 1 ? "s" : "";

  const q = query.trim().toLowerCase();
  const matches = new Set(group.holdings.filter((t) => {
    const h = data.holdings[t];
    return !q || [h.ticker, h.name, h.pitch?.summary ?? ""].some((s) => s.toLowerCase().includes(q));
  }));

  return (
    <section className={styles.panel} ref={panel} aria-label={group.name}
      onScroll={(e) => { savedScroll.current = e.currentTarget.scrollTop; clipHead(); requestAnimationFrame(updateFocus); }}>
      <div className={styles.head} ref={head}
        style={{ background: fill?.background ?? "var(--surface-2)", color: fill ? (fill.strong ? "#fff" : "var(--ink)") : "var(--text-primary)" }}>
        <div className={styles.headInner}>
          <button className={styles.back} data-back data-keep onClick={close} aria-label="Back to all sectors (Esc)">← All sectors</button>
          <h2 className={styles.title} data-keep>{group.name}</h2>
          <div className={styles.facts} ref={facts}>
            <span className={styles.pill} {...tip(paidTip)}><b className={tone(paid)}>{share(group.weight)}</b> of fund</span>
            {overweight != null && <>
              <span className={styles.pill}><b>{share(group.vtiWeight!)}</b> of VTI</span>
              <span className={styles.pill} {...tip(paidTip)}><b className={tone(paid)}>{pts(overweight)}</b> {overweight >= 0 ? "overweight" : "underweight"}</span>
            </>}
            <span className={styles.pill}><b>{count}</b> holding{plural}</span>
            <span className={styles.pill}><b className={tone(c.fund)}>{pts(c.fund, 2)}</b> contribution · {period}</span>
          </div>
        </div>
      </div>

      <div ref={body}>
        <div className={styles.tools}>
          <label className={styles.search}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input ref={search} type="search" autoComplete="off" aria-label="Search holdings" value={query}
              placeholder={`Search ${count} holding${plural} in ${group.name}…`} onChange={(e) => setQuery(e.target.value)} />
            <kbd>/</kbd>
          </label>
          {q && <span className={styles.count}>{matches.size} of {count}</span>}
        </div>
        <div className={styles.cards}>
          {group.holdings.map((t) => (
            <HoldingCard key={t} holding={data.holdings[t]} period={period} expanded={expanded.has(t)} hidden={!matches.has(t)}
              onToggle={(card) => toggle(t, card)} />
          ))}
        </div>
        {!matches.size && <p className={styles.empty}>No holdings match your search.</p>}
      </div>
    </section>
  );
}

// A colored box that moves and reshapes from one element to another, for the open and close animations.
function fly(from: HTMLElement, fromBg: string, fromRadius: number, to: HTMLElement, toBg: string, toRadius: number, easing: string) {
  const el = document.body.appendChild(document.createElement("div"));
  el.className = styles.fly;
  const frame = (r: DOMRect, radius: number, background: string) =>
    ({ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: radius + "px", background });
  const anim = el.animate([frame(from.getBoundingClientRect(), fromRadius, fromBg), frame(to.getBoundingClientRect(), toRadius, toBg)],
    { duration: MORPH_MS, easing, fill: "forwards" });
  return new Promise<void>((resolve) => (anim.onfinish = () => { el.remove(); resolve(); }));
}

// When the header pills wrap, fit them into as few lines as possible: widest first, each into the first line
// with room. Lines and the pills within them keep their usual order; only the CSS order changes.
function packPills(facts: HTMLElement) {
  const pills = [...facts.children] as HTMLElement[];
  pills.forEach((p) => (p.style.order = ""));
  const W = facts.clientWidth, gap = parseFloat(getComputedStyle(facts).columnGap) || 8;
  const widths = pills.map((p) => p.getBoundingClientRect().width);
  if (widths.reduce((a, b) => a + b, 0) + gap * (pills.length - 1) <= W) return;
  const lines: { width: number; items: number[] }[] = [];
  for (const i of pills.map((_, i) => i).sort((a, b) => widths[b] - widths[a])) {
    const line = lines.find((l) => l.width + gap + widths[i] <= W);
    if (line) { line.items.push(i); line.width += gap + widths[i]; } else lines.push({ width: widths[i], items: [i] });
  }
  lines.forEach((l) => l.items.sort((a, b) => a - b));
  lines.sort((a, b) => a.items[0] - b.items[0]);
  lines.forEach((l, li) => l.items.forEach((i) => (pills[i].style.order = String(li * 100 + i))));
}
