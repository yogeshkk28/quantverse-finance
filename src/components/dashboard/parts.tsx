import React from "react";

/** Panel heading: section marker, serif title and an optional action on the right. */
export function PanelHead({
  id,
  title,
  marker = true,
  size = "h2",
  aside,
  children,
}: {
  id: string;
  title: string;
  marker?: boolean;
  size?: "h2" | "h3";
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
      {marker && <span className="lq-marker" aria-hidden="true" />}
      <h2 id={id} className={size === "h2" ? "lq-h2" : "lq-h3"}>
        {title}
      </h2>
      {children}
      {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
    </div>
  );
}

/** Chip row acting as a single-choice toggle. */
export function ChipGroup<const T extends string>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: readonly T[];
  value: NoInfer<T>;
  onChange: (v: NoInfer<T>) => void;
  render?: (v: T) => React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" className="lq-chip" aria-pressed={o === value} onClick={() => onChange(o)}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

/** Tiny line chart. Colour follows direction (first vs last point). */
export function Sparkline({
  values,
  width = 72,
  height = 22,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  label?: string;
}) {
  if (values.length < 2) return <span className="inline-block" style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polyline points={pts} fill="none" stroke={up ? "var(--lq-up)" : "var(--lq-down)"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** "▲ 1.23%" / "▼ 0.40%" in the up/down colours. */
export function Change({ pct, className = "" }: { pct: number | null | undefined; className?: string }) {
  if (pct == null || !Number.isFinite(pct)) return <span className={`text-lq-muted ${className}`}>—</span>;
  const up = pct >= 0;
  return (
    <span className={`lq-num ${up ? "lq-up" : "lq-down"} ${className}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-lq-muted m-0 py-6 text-center">{children}</p>;
}

export const fmtNum = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function fmtCompact(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}
