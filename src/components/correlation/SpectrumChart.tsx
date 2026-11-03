import { useMemo, useState } from "react";
import * as d3 from "d3";
import { INK, GROUP_COLORS } from "./palette";
import type { Structure } from "./types";

/**
 * Eigenvalue scree plot against the Marchenko–Pastur noise band. Bars above
 * λ+ are directions of co-movement that pure noise of this size would not
 * produce; the first is usually the market itself.
 */
export default function SpectrumChart({ spectrum, n, adjusted }: { spectrum: Structure["spectrum"]; n: number; adjusted: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = spectrum.eigenvalues.slice(0, Math.min(30, n));
  const W = 520;
  const H = 230;
  const m = { top: 14, right: 12, bottom: 30, left: 36 };

  const { x, y, ticks } = useMemo(() => {
    const x = d3
      .scaleBand<number>()
      .domain(values.map((_, i) => i))
      .range([m.left, W - m.right])
      .paddingInner(0.25);
    const top = Math.max(values[0] ?? 1, spectrum.lambdaPlus) * 1.08;
    const y = d3.scaleLinear().domain([0, top]).nice().range([H - m.bottom, m.top]);
    return { x, y, ticks: y.ticks(4) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spectrum]);

  const signalColor = GROUP_COLORS[0];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-lq-text-2">
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: signalColor }} aria-hidden="true" /> Signal (above noise)
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: INK.line2 }} aria-hidden="true" /> Inside the noise band
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: INK.goldSoft }} aria-hidden="true" /> λ+ = {spectrum.lambdaPlus.toFixed(2)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Eigenvalue spectrum: ${spectrum.signal} eigenvalues above the noise edge of ${spectrum.lambdaPlus.toFixed(2)}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke={INK.line} strokeWidth={1} />
            <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={INK.muted} fontFamily="JetBrains Mono, monospace">
              {t}
            </text>
          </g>
        ))}
        <rect
          x={m.left}
          width={W - m.left - m.right}
          y={y(spectrum.lambdaPlus)}
          height={Math.max(0, y(spectrum.lambdaMinus) - y(spectrum.lambdaPlus))}
          fill="rgba(163,167,183,0.07)"
        />
        {values.map((v, i) => {
          const signal = v > spectrum.lambdaPlus;
          const bw = x.bandwidth();
          const top = y(v);
          const h = Math.max(1, y(0) - top);
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x(i)! - 2} width={bw + 4} y={m.top} height={H - m.top - m.bottom} fill="transparent" />
              <path
                d={`M${x(i)},${y(0)} V${top + r} Q${x(i)},${top} ${x(i)! + r},${top} H${x(i)! + bw - r} Q${x(i)! + bw},${top} ${x(i)! + bw},${top + r} V${y(0)} Z`}
                fill={signal ? signalColor : INK.line2}
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
            </g>
          );
        })}
        <line x1={m.left} x2={W - m.right} y1={y(spectrum.lambdaPlus)} y2={y(spectrum.lambdaPlus)} stroke={INK.goldSoft} strokeDasharray="5 4" strokeWidth={1.25} />
        <line x1={m.left} x2={W - m.right} y1={y(0)} y2={y(0)} stroke={INK.line2} />
        {values[0] !== undefined && values[0] > spectrum.lambdaPlus && (
          <text x={x(0)! + x.bandwidth() + 6} y={y(values[0]) + 10} fontSize={11} fill={INK.text2}>
            {adjusted ? "Largest factor" : "Market mode"} · {(spectrum.marketShare * 100).toFixed(0)}% of variance
          </text>
        )}
        <text x={(W + m.left) / 2} y={H - 6} textAnchor="middle" fontSize={10} fill={INK.muted}>
          Eigenvalue rank
        </text>
        {hover !== null && (
          <g transform={`translate(${Math.min(x(hover)! + x.bandwidth() / 2, W - 120)}, ${m.top + 4})`} pointerEvents="none">
            <rect x={-4} y={-2} width={118} height={36} rx={6} fill={INK.surface2} stroke={INK.line2} />
            <text x={4} y={12} fontSize={11} fill={INK.text} fontFamily="JetBrains Mono, monospace">
              λ{hover + 1} = {values[hover].toFixed(2)}
            </text>
            <text x={4} y={26} fontSize={10} fill={INK.muted}>
              {values[hover] > spectrum.lambdaPlus ? "Above noise" : "Noise band"}
            </text>
          </g>
        )}
      </svg>
      <p className="text-xs text-lq-muted leading-relaxed">
        Random data of this size ({n} stocks × {Math.round(n / spectrum.q)} days) would put every eigenvalue below λ+. Here{" "}
        <b className="text-lq-text-2">{spectrum.signal}</b> stand{spectrum.signal === 1 ? "s" : ""} above it. The rest is treated as
        noise when the random-matrix filter is on.
      </p>
    </div>
  );
}
