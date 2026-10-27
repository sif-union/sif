"use client";
// One tooltip box for the whole page. Any element can show it:
//   const tip = useTip();
//   <div {...tip(<><b>AAPL</b><TipRow label="Return" value="+12%" /></>)}>
// It follows the pointer, and appears under the element when it gets keyboard focus.
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
    onPointerMove: (e: React.PointerEvent) => setTip(() => ({ x: e.clientX, y: e.clientY, content, open: true })),
    onPointerLeave: hide,
    onFocus: (e: React.FocusEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip(() => ({ x: r.left, y: r.bottom, content, open: true }));
    },
    onBlur: hide,
  });
}

// A label/value line inside a tooltip.
export function TipRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return <div className={styles.row}><span>{label}</span><b>{value}</b></div>;
}

// The small "?" next to a label that explains it.
export function Help({ text }: { text: string }) {
  const tip = useTip();
  return <span className={styles.help} tabIndex={0} {...tip(text)}>?</span>;
}
