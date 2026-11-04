import React, { useMemo, useState } from "react";
import { scaleLinear, scaleSqrt } from "d3";
import type { ScreenerRow } from "../../types";
import { METRIC, MetricKey, colorScale, formatMetric, formatPrice, formatValue, quantile, valuesOf } from "./metrics";
import { useWidth } from "./ScreenerHeatmap";

interface Props {
  rows: ScreenerRow[];
  x: MetricKey;
  y: MetricKey;
  colorBy: MetricKey;
  watchlist: Set<string>;
  onSelect: (r: ScreenerRow) => void;
}

const PAD = { l: 56, r: 18, t: 18, b: 44 };

function domain(rows: ScreenerRow[], key: MetricKey): [number, number] {
  const vals = valuesOf(rows, key);
  if (!vals.length) return [0, 1];
  let lo = quantile(vals, 0.02);
  let hi = quantile(vals, 0.98);
  const clip = METRIC[key].clip;
  if (clip) {
    lo = Math.max(lo, clip[0]);
    hi = Math.min(hi, clip[1]);
  }
  if (hi <= lo) hi = lo + 1;
  const pad = (hi - lo) * 0.06;
  return [lo - pad, hi + pad];
}

/** Any two metrics against each other: bubble size is market cap, colour is a third metric. */
export default function ScreenerScatter({ rows, x, y, colorBy, watchlist, onSelect }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const height = width < 640 ? 440 : 560;
  const [hover, setHover] = useState<ScreenerRow | null>(null);

  const { sx, sy, sr, points, mx, my } = useMemo(() => {
    const sx = scaleLinear().domain(domain(rows, x)).range([PAD.l, width - PAD.r]).nice();
    const sy = scaleLinear().domain(domain(rows, y)).range([height - PAD.b, PAD.t]).nice();
    const caps = valuesOf(rows, "mktCapUsd");
    const sr = scaleSqrt().domain([0, Math.max(1, ...caps)]).range([2.5, 16]);
    const points = rows
      .filter((r) => r[x] !== null && r[y] !== null)
      .sort((a, b) => (b.mktCapUsd ?? 0) - (a.mktCapUsd ?? 0)); // big ones underneath
    return { sx, sy, sr, points, mx: quantile(valuesOf(points, x), 0.5), my: quantile(valuesOf(points, y), 0.5) };
  }, [rows, x, y, width, height]);

  const color = useMemo(() => colorScale(colorBy, rows), [colorBy, rows]);
  const clampX = (v: number) => Math.max(PAD.l, Math.min(width - PAD.r, sx(v)));
  const clampY = (v: number) => Math.max(PAD.t, Math.min(height - PAD.b, sy(v)));
  const labelled = new Set(points.slice(0, 12).map((p) => p.id));

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <svg width={width} height={height} role="img" aria-label={`${METRIC[y].label} against ${METRIC[x].label} for ${points.length} stocks`}>
        {sx.ticks(8).map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={height - PAD.b} stroke="var(--lq-line-soft)" />
            <text x={sx(t)} y={height - PAD.b + 16} textAnchor="middle" fill="var(--lq-muted)" fontSize={10.5} fontFamily="JetBrains Mono">
              {formatValue(x, t)}
            </text>
          </g>
        ))}
        {sy.ticks(7).map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.l} x2={width - PAD.r} y1={sy(t)} y2={sy(t)} stroke="var(--lq-line-soft)" />
            <text x={PAD.l - 8} y={sy(t) + 3.5} textAnchor="end" fill="var(--lq-muted)" fontSize={10.5} fontFamily="JetBrains Mono">
              {formatValue(y, t)}
            </text>
          </g>
        ))}
        {/* Median crosshair splits the field into quadrants */}
        <line x1={clampX(mx)} x2={clampX(mx)} y1={PAD.t} y2={height - PAD.b} stroke="var(--lq-gold-line)" strokeDasharray="4 4" />
        <line x1={PAD.l} x2={width - PAD.r} y1={clampY(my)} y2={clampY(my)} stroke="var(--lq-gold-line)" strokeDasharray="4 4" />
        <text x={width - PAD.r} y={height - 8} textAnchor="end" fill="var(--lq-text-2)" fontSize={11.5} fontFamily="Inter">
          {METRIC[x].label} →
        </text>
        <text transform={`translate(14,${PAD.t}) rotate(-90)`} textAnchor="end" fill="var(--lq-text-2)" fontSize={11.5} fontFamily="Inter">
          {METRIC[y].label} →
        </text>

        {points.map((r) => {
          const cx = clampX(r[x]!);
          const cy = clampY(r[y]!);
          const rad = sr(r.mktCapUsd ?? 0);
          const isHover = hover?.id === r.id;
          return (
            <g key={r.id} onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(r)} className="cursor-pointer">
              <circle
                cx={cx}
                cy={cy}
                r={isHover ? rad + 2 : rad}
                fill={color(r[colorBy])}
                fillOpacity={0.82}
                stroke={isHover || watchlist.has(r.id) ? "var(--lq-gold)" : "rgba(243,239,230,.25)"}
                strokeWidth={isHover || watchlist.has(r.id) ? 1.6 : 0.6}
              />
              {(labelled.has(r.id) || isHover) && (
                <text x={cx + rad + 3} y={cy + 3.5} fill="var(--lq-text)" fontSize={10.5} fontFamily="JetBrains Mono">
                  {r.id}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 lq-panel !rounded-[10px] px-3 py-2.5 w-[220px] text-[12px]"
          style={{ left: Math.min(clampX(hover[x]!) + 16, width - 230), top: Math.max(8, Math.min(clampY(hover[y]!) - 20, height - 150)) }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="lq-num text-lq-gold font-medium">{hover.id}</span>
            <span className="lq-num text-lq-text">{formatPrice(hover.price, hover.currency)}</span>
          </div>
          <div className="text-lq-muted text-[11px] truncate mb-1.5">{hover.name}</div>
          {([x, y, colorBy, "mktCapUsd"] as MetricKey[])
            .filter((k, i, a) => a.indexOf(k) === i)
            .map((k) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-lq-muted">{METRIC[k].label}</span>
                <span className="lq-num text-lq-text-2">{formatMetric(k, hover)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
