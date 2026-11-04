import React, { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3";
import type { ScreenerRow } from "../../types";
import { METRIC, MetricKey, colorScale, formatMetric, formatPrice } from "./metrics";

interface Props {
  rows: ScreenerRow[];
  colorBy: MetricKey;
  onSelect: (r: ScreenerRow) => void;
}

interface Node {
  name: string;
  row?: ScreenerRow;
  value?: number;
  children?: Node[];
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export { useWidth };

/** Treemap of the matches: grouped by sector, sized by market cap (USD), coloured by any metric. */
export default function ScreenerHeatmap({ rows, colorBy, onSelect }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const height = width < 640 ? 520 : 640;
  const [hover, setHover] = useState<{ row: ScreenerRow; x: number; y: number } | null>(null);
  const color = useMemo(() => colorScale(colorBy, rows), [colorBy, rows]);

  const layout = useMemo(() => {
    const caps = rows.map((r) => r.mktCapUsd).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const fallback = caps.length ? caps[Math.floor(caps.length / 2)] : 1e10;
    const bySector = new Map<string, ScreenerRow[]>();
    rows.forEach((r) => bySector.set(r.sector, [...(bySector.get(r.sector) ?? []), r]));
    const root: Node = {
      name: "root",
      children: [...bySector].map(([name, list]) => ({
        name,
        // sqrt keeps mega caps from swallowing the map while preserving order
        children: list.map((row) => ({ name: row.id, row, value: Math.sqrt(row.mktCapUsd ?? fallback) })),
      })),
    };
    const h = hierarchy<Node>(root)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return treemap<Node>().tile(treemapSquarify).size([width, height]).paddingOuter(3).paddingTop(20).paddingInner(1.5).round(true)(h);
  }, [rows, width, height]);

  const metric = METRIC[colorBy];

  return (
    <div ref={wrapRef} className="relative w-full select-none" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={`Heatmap of ${rows.length} stocks by sector, coloured by ${metric.label}`}>
        {layout.children?.map((sector) => (
          <g key={sector.data.name}>
            <rect x={sector.x0} y={sector.y0} width={sector.x1 - sector.x0} height={sector.y1 - sector.y0} fill="var(--lq-bg-2)" stroke="var(--lq-line)" rx={4} />
            {sector.x1 - sector.x0 > 60 && (
              <text x={sector.x0 + 6} y={sector.y0 + 14} fill="var(--lq-muted)" fontSize={10.5} fontFamily="Inter" letterSpacing="0.06em">
                {sector.data.name.toUpperCase()} · {sector.children?.length ?? 0}
              </text>
            )}
            {sector.leaves().map((leaf) => {
              const r = leaf.data.row!;
              const w = leaf.x1 - leaf.x0;
              const h = leaf.y1 - leaf.y0;
              const big = w > 46 && h > 30;
              return (
                <g
                  key={r.id}
                  transform={`translate(${leaf.x0},${leaf.y0})`}
                  onClick={() => onSelect(r)}
                  onMouseMove={(e) => {
                    const box = wrapRef.current!.getBoundingClientRect();
                    setHover({ row: r, x: e.clientX - box.left, y: e.clientY - box.top });
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    width={w}
                    height={h}
                    fill={color(r[colorBy])}
                    stroke={hover?.row.id === r.id ? "var(--lq-gold)" : "rgba(7,8,12,.6)"}
                    strokeWidth={hover?.row.id === r.id ? 1.5 : 0.5}
                    rx={2}
                  />
                  {big && (
                    <>
                      <text x={w / 2} y={h / 2 - (h > 44 ? 3 : -3)} textAnchor="middle" fill="#F3EFE6" fontFamily="JetBrains Mono" fontWeight={500} fontSize={Math.min(15, Math.max(9.5, w / 6))}>
                        {r.id.length > 10 ? r.id.slice(0, 9) + "…" : r.id}
                      </text>
                      {h > 44 && (
                        <text x={w / 2} y={h / 2 + 13} textAnchor="middle" fill="rgba(243,239,230,.8)" fontFamily="JetBrains Mono" fontSize={10}>
                          {formatMetric(colorBy, r)}
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 lq-panel !rounded-[10px] px-3 py-2.5 w-[220px] text-[12px]"
          style={{ left: Math.min(hover.x + 14, width - 230), top: Math.min(hover.y + 14, height - 150) }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="lq-num text-lq-gold font-medium">{hover.row.id}</span>
            <span className="lq-num text-lq-text">{formatPrice(hover.row.price, hover.row.currency)}</span>
          </div>
          <div className="text-lq-muted text-[11px] truncate">{hover.row.name}</div>
          <div className="text-lq-muted text-[11px] truncate mb-1.5">{hover.row.industry}</div>
          {(["chg", colorBy, "mktCapUsd", "scoreComposite"] as MetricKey[])
            .filter((k, i, a) => a.indexOf(k) === i)
            .map((k) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-lq-muted">{METRIC[k].label}</span>
                <span className="lq-num text-lq-text-2">{formatMetric(k, hover.row)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
