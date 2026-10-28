"use client";
// One tooltip box for the whole page. Any element can show it:
//   const tip = useTip();
//   <div {...tip(<><b>AAPL</b><TipRow label="Return" value="+12%" /></>)}>
// It follows the mouse, and appears under the element when it gets keyboard focus. On touch screens
// it stays off (a finger scrolling over blocks would make it flicker), except for the "?" icons, which open on tap.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Tooltip.module.css";

type Tip = { x: number; y: number; content: ReactNode; open: boolean };
const TipContext = createContext<(update: (tip: Tip) => Tip) => void>(() => {});

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip>({ x: 0, y: 0, content: null, open: false });
  const box = useRef<HTMLDivElement>(null);

  // keep the box inside the window
  useLayoutEffect(() => {
    const el = box.current!;
    el.style.left = Math.min(tip.x + 14, innerWidth - el.offsetWidth - 8) + "px";
    el.style.top = Math.min(tip.y + 14, innerHeight - el.offsetHeight - 8) + "px";
  }, [tip]);

  // any tap or click elsewhere closes it
  useEffect(() => {
    const hide = () => setTip((tip) => ({ ...tip, open: false }));
    addEventListener("pointerdown", hide);
    return () => removeEventListener("pointerdown", hide);
  }, []);

  return (
    <TipContext.Provider value={setTip}>
      {children}
      <div ref={box} role="tooltip" className={styles.tip} data-open={tip.open}>{tip.content}</div>
    </TipContext.Provider>
  );
}

export function useTip() {
  const setTip = useContext(TipContext);
  const hide = () => setTip((tip) => ({ ...tip, open: false }));
  return (content: ReactNode) => ({
    onPointerMove: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setTip(() => ({ x: e.clientX, y: e.clientY, content, open: true })); },
    onPointerLeave: hide,
    onFocus: (e: React.FocusEvent) => { if (e.currentTarget.matches(":focus-visible")) showBelow(setTip, e.currentTarget, content); },
    onBlur: hide,
  });
}

function showBelow(setTip: (update: (tip: Tip) => Tip) => void, el: Element, content: ReactNode) {
  const r = el.getBoundingClientRect();
  setTip(() => ({ x: r.left, y: r.bottom, content, open: true }));
}

// A label/value line inside a tooltip.
export function TipRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return <div className={styles.row}><span>{label}</span><b>{value}</b></div>;
}

// The small "?" next to a label that explains it.
export function Help({ text }: { text: string }) {
  const tip = useTip(), setTip = useContext(TipContext);
  return <span className={styles.help} tabIndex={0} data-help {...tip(text)} onClick={(e) => showBelow(setTip, e.currentTarget, text)}>?</span>;
}
