import React, { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PanelHead, ChipGroup, Change, fmtNum } from "./parts";
import { SeeAll } from "../home/ui";

const INDICES = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^NDX", label: "Nasdaq 100" },
  { symbol: "^DJI", label: "Dow Jones" },
  { symbol: "^NSEI", label: "Nifty 50" },
  { symbol: "^BSESN", label: "Sensex" },
  { symbol: "^NSEBANK", label: "Nifty Bank" },
  { symbol: "^N225", label: "Nikkei 225" },
  { symbol: "^FTSE", label: "FTSE 100" },
  { symbol: "^GDAXI", label: "DAX" },
  { symbol: "^HSI", label: "Hang Seng" },
] as const;
const RANGES = ["5D", "1M", "3M", "6M", "YTD", "1Y", "2Y"] as const;
type Range = (typeof RANGES)[number];

interface IndexChart {
  label: string;
  currency: string;
  available: boolean;
  asOf?: string;
  price?: number;
  change?: number;
  changePct?: number;
  stats?: { open: number; high: number; low: number; prevClose: number; low52: number; high52: number };
  points?: { t: number; c: number }[];
}

export default function IndicesPanel({ symbol, onSymbol: setSymbol }: { symbol: string; onSymbol: (symbol: string) => void }) {
  const [range, setRange] = useState<Range>("3M");
  const [data, setData] = useState<IndexChart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/index-chart?symbol=${encodeURIComponent(symbol)}&range=${range}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const label = INDICES.find((i) => i.symbol === symbol)?.label ?? "";
  const points = data?.available ? data.points ?? [] : [];
  const up = points.length > 1 ? points[points.length - 1].c >= points[0].c : true;
  const stroke = up ? "var(--lq-up)" : "var(--lq-down)";
  const cur = data?.currency ?? "";
  const s = data?.stats;

  return (
    <section className="lq-panel lq-rise p-6 md:p-7 flex flex-col gap-5 min-w-0" aria-labelledby="idx-h" style={{ "--lq-i": 1 } as React.CSSProperties}>
      <PanelHead
        id="idx-h"
        title="Index chart"
        aside={<SeeAll href="/app/markets/indices">All indices</SeeAll>}
      />
      <div role="group" aria-label="Index" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {INDICES.map((i) => (
          <button key={i.symbol} type="button" className="lq-chip" aria-pressed={symbol === i.symbol} onClick={() => setSymbol(i.symbol)}>
            {i.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <div className="flex flex-col gap-1">
          <span className="lq-lbl">{label}</span>
          <span className="lq-num text-[28px] leading-none text-lq-text">
            {data?.available && data.price != null ? `${cur}${fmtNum(data.price)}` : loading ? "…" : "—"}
          </span>
        </div>
        {data?.available && (
          <span className="flex items-center gap-2 pb-0.5">
            <Change pct={data.changePct} className="text-[14px]" />
            <span className="lq-num text-[13px] text-lq-muted">
              {data.change != null && `${data.change >= 0 ? "+" : "−"}${fmtNum(Math.abs(data.change))}`} today
            </span>
          </span>
        )}
        <div className="ml-auto">
          <ChipGroup label="Range" options={RANGES} value={range} onChange={setRange} />
        </div>
      </div>

      <div className="h-[340px] -mx-2">
        {points.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="idxFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                tickFormatter={(t) => new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                tick={{ fill: "var(--lq-muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--lq-line)" }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                orientation="right"
                tick={{ fill: "var(--lq-muted)", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(v) => fmtNum(v, 0)}
              />
              <Tooltip
                contentStyle={{ background: "var(--lq-surface-2)", border: "1px solid var(--lq-line-2)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "var(--lq-muted)" }}
                itemStyle={{ color: "var(--lq-text)" }}
                labelFormatter={(t) => new Date(Number(t) * 1000).toLocaleDateString()}
                formatter={(v: number) => [`${cur}${fmtNum(v)}`, "Close"]}
              />
              <Area type="linear" dataKey="c" stroke={stroke} strokeWidth={1.5} fill="url(#idxFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[13px] text-lq-muted">
            {loading ? "Loading chart…" : "Index data is unavailable right now."}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 m-0">
        {[
          ["Open", s?.open],
          ["Day high", s?.high],
          ["Day low", s?.low],
          ["Prev close", s?.prevClose],
        ].map(([k, v]) => (
          <div key={k as string} className="lq-card px-3 py-2.5 flex flex-col gap-1">
            <dt className="lq-lbl">{k}</dt>
            <dd className="lq-num text-[14px] m-0">{typeof v === "number" ? fmtNum(v) : "—"}</dd>
          </div>
        ))}
        <div className="lq-card px-3 py-2.5 flex flex-col gap-1 col-span-2 sm:col-span-1">
          <dt className="lq-lbl">52W range</dt>
          <dd className="lq-num text-[13px] m-0">{s ? `${fmtNum(s.low52, 0)} – ${fmtNum(s.high52, 0)}` : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
