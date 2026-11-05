import React, { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Change, fmtNum } from "./parts";
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

  const tab = (on: boolean) =>
    `px-2.5 py-1 rounded-md text-[12px] whitespace-nowrap border transition-colors ${
      on ? "bg-lq-surface-2 text-lq-text border-lq-line-2" : "text-lq-muted hover:text-lq-text border-transparent"
    }`;

  return (
    <section className="lq-panel lq-rise p-5 flex flex-col gap-3 min-w-0" aria-labelledby="idx-h" style={{ "--lq-i": 1 } as React.CSSProperties}>
      <div className="flex items-center gap-3 flex-wrap">
        <h2 id="idx-h" className="m-0 text-[17px] font-semibold text-lq-text">
          Markets today
        </h2>
        <div role="group" aria-label="Index" className="flex gap-1 overflow-x-auto min-w-0">
          {INDICES.map((i) => (
            <button key={i.symbol} type="button" className={tab(symbol === i.symbol)} aria-pressed={symbol === i.symbol} onClick={() => setSymbol(i.symbol)}>
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <span className="lq-num text-[26px] leading-none text-lq-text">
          {data?.available && data.price != null ? `${cur}${fmtNum(data.price)}` : loading ? "…" : "—"}
        </span>
        {data?.available && (
          <span className="flex items-center gap-2 pb-0.5">
            <Change pct={data.changePct} className="text-[13px]" />
            <span className="lq-num text-[12px] text-lq-muted">
              {data.change != null && `${data.change >= 0 ? "+" : "−"}${fmtNum(Math.abs(data.change))}`} today · {label}
            </span>
          </span>
        )}
        <div role="group" aria-label="Range" className="ml-auto flex gap-1">
          {RANGES.map((r) => (
            <button key={r} type="button" className={tab(range === r)} aria-pressed={range === r} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[260px] -mx-2">
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

      <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1 text-[12px] pt-2 border-t border-lq-line-soft">
        {(
          [
            ["Open", s?.open],
            ["High", s?.high],
            ["Low", s?.low],
            ["Prev close", s?.prevClose],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex gap-1.5">
            <dt className="text-lq-muted">{k}</dt>
            <dd className="lq-num m-0 text-lq-text-2">{typeof v === "number" ? fmtNum(v) : "—"}</dd>
          </div>
        ))}
        <div className="flex gap-1.5">
          <dt className="text-lq-muted">52W</dt>
          <dd className="lq-num m-0 text-lq-text-2">{s ? `${fmtNum(s.low52, 0)} – ${fmtNum(s.high52, 0)}` : "—"}</dd>
        </div>
        <div className="ml-auto">
          <SeeAll href={`/app/chart/${encodeURIComponent(symbol)}`}>Full chart</SeeAll>
        </div>
      </dl>
    </section>
  );
}
