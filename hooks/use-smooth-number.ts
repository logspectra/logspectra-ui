"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Eases displayed value toward `target` so stat cards do not jump on every SSE tick.
 */
export function useSmoothNumber(target: number, durationMs = 550): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return;

    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      const next = from + (target - from) * eased;
      setDisplay(Math.round(next));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return display;
}
