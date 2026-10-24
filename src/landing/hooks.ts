import { useEffect, useState } from "react";

/** Tracks the visitor's reduced-motion preference. */
export function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** A heatmap of red and green tiles as an SVG data URI, used by the striped reveal. */
export function heatmapTiles(seed = 3): string {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cols = 24;
  const rows = 14;
  let rects = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = rand() * 2 - 1; // daily move, -1..1
      const colour = v >= 0 ? `rgba(37,211,102,${0.15 + v * 0.6})` : `rgba(242,50,31,${0.15 - v * 0.6})`;
      rects += `<rect x="${c * 10 + 0.5}" y="${r * 10 + 0.5}" width="9" height="9" rx="1" fill="${colour}"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * 10} ${rows * 10}" preserveAspectRatio="none">${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
