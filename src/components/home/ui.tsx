import React, { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";

/** Fetch JSON once per `url`. `data` is undefined while loading and null on failure. */
export function useJson<T>(url: string | null, refreshMs = 0): T | null | undefined {
  const [data, setData] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setData(undefined);
    const load = () =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !cancelled && setData(d))
        .catch(() => !cancelled && setData(null));
    load();
    const t = refreshMs ? window.setInterval(load, refreshMs) : 0;
    return () => {
      cancelled = true;
      if (t) window.clearInterval(t);
    };
  }, [url, refreshMs]);
  return data;
}

/** Shared quote shape from /api/index-cards, /api/futures and /api/forex. */
export interface Quote {
  symbol: string;
  short: string;
  name: string;
  kind: "index" | "future" | "fx" | "crypto" | "stock";
  region: "US" | "IN" | "GLOBAL";
  currency: string;
  unit?: string;
  exchange?: string;
  linked?: string[];
  available: boolean;
  asOf?: string;
  price?: number;
  change?: number;
  changePct?: number;
  dayLow?: number;
  dayHigh?: number;
  low52?: number;
  high52?: number;
  volume?: number | null;
  spark?: number[];
  sparkTimes?: number[];
}

export function digitsFor(p: number) {
  return p < 2 ? 4 : p < 20 ? 3 : 2;
}

export function fmtPrice(p: number | undefined | null, digits?: number) {
  if (p == null || !Number.isFinite(p)) return "—";
  const d = digits ?? digitsFor(Math.abs(p));
  return p.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtSigned(v: number | undefined | null, digits = 2, suffix = "") {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function asOfLabel(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Area sparkline with a direction-coloured stroke and a fading fill. */
export function AreaSpark({
  values,
  height = 56,
  label,
  baseline,
  className = "",
  strokeWidth = 1.6,
}: {
  values: number[];
  height?: number;
  label?: string;
  baseline?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const id = useId().replace(/:/g, "");
  const W = 300;
  if (values.length < 2) return <div className={className} style={{ height }} />;
  const min = Math.min(...values, baseline ?? Infinity);
  const max = Math.max(...values, baseline ?? -Infinity);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => 3 + (1 - (v - min) / span) * (height - 6);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const up = values[values.length - 1] >= (baseline ?? values[0]);
  const c = up ? "var(--lq-up)" : "var(--lq-down)";
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className={`block w-full ${className}`}
      style={{ height }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.28" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      {baseline != null && (
        <line x1="0" x2={W} y1={y(baseline)} y2={y(baseline)} stroke="var(--lq-line-2)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      )}
      <path d={`${line}L${W},${height}L0,${height}Z`} fill={`url(#g${id})`} />
      <path d={line} fill="none" stroke={c} strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.6" fill={c} />
    </svg>
  );
}

/** A low–high track with a gold marker at the current value. */
export function RangeBar({ low, high, value, label, digits }: { low?: number; high?: number; value?: number; label: string; digits?: number }) {
  const ok = low != null && high != null && value != null && high > low;
  const pos = ok ? Math.min(100, Math.max(0, ((value! - low!) / (high! - low!)) * 100)) : 50;
  return (
    <span className="flex flex-col gap-1.5 min-w-0">
      <span className="flex justify-between items-baseline">
        <span className="lq-lbl text-[10px]">{label}</span>
        {ok && <span className="lq-num text-[10px] text-lq-muted">{pos.toFixed(0)}%</span>}
      </span>
      <span className="relative block h-1 rounded-full bg-lq-line" role="img" aria-label={ok ? `${label}: ${fmtPrice(low)} to ${fmtPrice(high)}, now ${fmtPrice(value)}` : `${label} unavailable`}>
        {ok && (
          <>
            <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-lq-gold-deep/60 to-lq-gold/70" style={{ width: `${pos}%` }} />
            <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-lq-gold-soft ring-2 ring-lq-bg" style={{ left: `${pos}%` }} />
          </>
        )}
      </span>
      <span className="flex justify-between lq-num text-[10px] text-lq-muted">
        <span>{fmtPrice(low, digits)}</span>
        <span>{fmtPrice(high, digits)}</span>
      </span>
    </span>
  );
}

export function SeeAll({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link to={href} className="text-[13px] text-lq-gold hover:text-lq-gold-soft inline-flex items-center gap-1 whitespace-nowrap">
      {children} <span aria-hidden="true">›</span>
    </Link>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-md bg-lq-ph/60 animate-pulse ${className}`} />;
}
