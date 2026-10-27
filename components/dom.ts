// Small browser helpers shared by the views.
import { useLayoutEffect, useRef, useState } from "react";

// The current width and height of an element, updated when it resizes.
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

export const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Scrolls `el` to `to` over `ms` with an ease-out curve (the same feel as rows expanding).
let scrollFrame = 0;
export function animateScroll(el: HTMLElement, to: number, ms: number) {
  cancelAnimationFrame(scrollFrame);
  const from = el.scrollTop, start = performance.now();
  if (!ms || reduceMotion() || Math.abs(to - from) < 2) { el.scrollTop = to; return; }
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    el.scrollTop = from + (to - from) * (1 - (1 - t) ** 3);
    if (t < 1) scrollFrame = requestAnimationFrame(step);
  };
  scrollFrame = requestAnimationFrame(step);
}
