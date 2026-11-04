import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GROUP_COLORS, INK } from "./palette";
import type { Market, PairAnalysis } from "./types";

const tooltipStyle = {
  contentStyle: { background: INK.surface2, border: `1px solid ${INK.line2}`, borderRadius: 8, fontSize: 12 },
  labelStyle: { color: INK.text },
  itemStyle: { color: INK.text2 },
};

/** Rolling correlation and lead-lag profile for one pair. */
export default function PairExplorer({ market, a, b, days }: { market: Market; a: string; b: string; days: number }) {
  const [data, setData] = useState<PairAnalysis | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`/api/correlation-web/pair?market=${market}&a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: PairAnalysis) => {
        if (cancelled) return;
        setData(d);
        setState("ok");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [market, a, b, days]);

  if (state === "loading") return <p className="text-xs text-lq-muted">Loading {a} × {b}…</p>;
  if (state === "error" || !data) return <p className="text-xs text-lq-muted">Couldn't load this pair.</p>;

  const last = data.series[data.series.length - 1];
  const peak = data.ccf.filter((c) => c.lag !== 0).reduce((x, y) => (Math.abs(y.r) > Math.abs(x.r) ? y : x), data.ccf[0]);
  const lagNote =
    Math.abs(peak.r) > data.ccfBand
      ? peak.lag > 0
        ? `${a} has tended to move ${peak.lag} session${peak.lag > 1 ? "s" : ""} before ${b}.`
        : `${b} has tended to move ${-peak.lag} session${peak.lag < -1 ? "s" : ""} before ${a}.`
      : "No lag clears the 95% band, so neither stock reliably moves first.";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-lq-text">
          Rolling {data.window}-day correlation
        </span>
        <span className="flex gap-3 text-[11px] text-lq-text-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: GROUP_COLORS[0] }} aria-hidden="true" /> Raw{" "}
            <span className="lq-num">{last?.raw.toFixed(2)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: GROUP_COLORS[1] }} aria-hidden="true" /> Market-adjusted{" "}
            <span className="lq-num">{last?.residual.toFixed(2)}</span>
          </span>
        </span>
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.series} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={INK.line} vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={{ fill: INK.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
            <ReferenceLine y={0} stroke={INK.line2} />
            <Tooltip
              {...tooltipStyle}
              cursor={{ stroke: INK.goldSoft, strokeDasharray: "3 3" }}
              formatter={(v, name) => [Number(v).toFixed(2), name]}
            />
            <Line dataKey="raw" name="Raw" stroke={GROUP_COLORS[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="residual" name="Market-adjusted" stroke={GROUP_COLORS[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <span className="text-sm font-medium text-lq-text mt-1">Who moves first (cross-correlation)</span>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.ccf} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={INK.line} vertical={false} />
            <XAxis
              dataKey="lag"
              tick={{ fill: INK.muted, fontSize: 10 }}
              tickFormatter={(l) => (l > 0 ? `+${l}` : String(l))}
              axisLine={{ stroke: INK.line2 }}
              tickLine={false}
            />
            <YAxis tick={{ fill: INK.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
            <ReferenceLine y={data.ccfBand} stroke={INK.goldSoft} strokeDasharray="4 3" />
            <ReferenceLine y={-data.ccfBand} stroke={INK.goldSoft} strokeDasharray="4 3" />
            <ReferenceLine y={0} stroke={INK.line2} />
            <Tooltip
              {...tooltipStyle}
              cursor={{ fill: "rgba(245,230,202,0.06)" }}
              labelFormatter={(l) => (Number(l) > 0 ? `${a} leads by ${l}` : Number(l) < 0 ? `${b} leads by ${-Number(l)}` : "Same day")}
              formatter={(v) => [Number(v).toFixed(2), "r"]}
            />
            <Bar dataKey="r" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.ccf.map((c) => (
                <Cell key={c.lag} fill={c.lag === 0 ? INK.line2 : Math.abs(c.r) > data.ccfBand ? GROUP_COLORS[0] : "#3a4058"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-lq-muted leading-relaxed">
        Market-adjusted returns over the last {data.days} sessions. A bar at +k compares {a} today with {b} k sessions later; dashed
        lines mark the 95% band for pure noise. {lagNote}
      </p>
    </div>
  );
}
