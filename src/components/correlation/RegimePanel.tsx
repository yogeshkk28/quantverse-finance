import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GROUP_COLORS, INK } from "./palette";
import type { Dynamics } from "./types";

const STATE_COPY: Record<Dynamics["state"], { title: string; body: string }> = {
  coupled: {
    title: "Tightly coupled",
    body: "Risk is bunched into a few common drivers. Diversification works less well than usual, and sharp market-wide moves have tended to follow readings like this.",
  },
  normal: {
    title: "Normal coupling",
    body: "Co-movement is within its usual range for the last two years.",
  },
  dispersed: {
    title: "Dispersed",
    body: "Stocks are moving on their own stories more than usual. Diversification and stock picking get more room.",
  },
};

interface ChartSpec {
  title: string;
  note: string;
  series: Array<{ key: "avgCorr" | "avgResidualCorr" | "absorption" | "treeLength" | "survival"; label: string }>;
  format: (v: number) => string;
  domain?: [number, number];
}

const CHARTS: ChartSpec[] = [
  {
    title: "Average correlation",
    note: "Mean pairwise correlation, raw and with the index removed.",
    series: [
      { key: "avgCorr", label: "Raw" },
      { key: "avgResidualCorr", label: "Market-adjusted" },
    ],
    format: (v) => v.toFixed(2),
  },
  {
    title: "Absorption ratio",
    note: "Share of total risk explained by the top fifth of eigenvectors.",
    series: [{ key: "absorption", label: "Absorption" }],
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    title: "Spanning-tree length",
    note: "Average backbone distance. It shrinks when the market moves as one.",
    series: [{ key: "treeLength", label: "Tree length" }],
    format: (v) => v.toFixed(2),
  },
  {
    title: "Backbone survival",
    note: "Share of tree links that carry over from one window to the next.",
    series: [{ key: "survival", label: "Survival" }],
    format: (v) => `${(v * 100).toFixed(0)}%`,
    domain: [0, 1],
  },
];

const shortDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", year: "2-digit" });

export default function RegimePanel({ data }: { data: Dynamics }) {
  const last = data.points[data.points.length - 1];
  const copy = STATE_COPY[data.state];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        <div className="flex flex-col gap-1 max-w-xl">
          <span className="lq-lbl">Current regime</span>
          <span className="lq-h3">{copy.title}</span>
          <p className="text-xs text-lq-text-2 leading-relaxed">{copy.body}</p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
          <dt className="lq-lbl">Absorption</dt>
          <dt className="lq-lbl">Percentile</dt>
          <dt className="lq-lbl">15-day shift</dt>
          <dd className="lq-num text-lq-text text-base">{last ? `${(last.absorption * 100).toFixed(0)}%` : "–"}</dd>
          <dd className="lq-num text-lq-text text-base">{data.absorptionPercentile}th</dd>
          <dd className="lq-num text-lq-text text-base">
            {data.absorptionShift > 0 ? "+" : ""}
            {data.absorptionShift.toFixed(1)}σ
          </dd>
        </dl>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CHARTS.map((c) => (
          <figure key={c.title} className="lq-card p-4 m-0 flex flex-col gap-2">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-lq-text">{c.title}</span>
              {c.series.length > 1 && (
                <span className="flex gap-3 text-[11px] text-lq-text-2">
                  {c.series.map((s, i) => (
                    <span key={s.key} className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-0.5 rounded" style={{ background: GROUP_COLORS[i] }} aria-hidden="true" />
                      {s.label}
                    </span>
                  ))}
                </span>
              )}
            </figcaption>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={INK.line} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: INK.muted, fontSize: 10 }}
                    axisLine={{ stroke: INK.line2 }}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    tickFormatter={(v) => c.format(Number(v))}
                    tick={{ fill: INK.muted, fontSize: 10, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    domain={c.domain ?? ["auto", "auto"]}
                  />
                  <Tooltip
                    cursor={{ stroke: INK.goldSoft, strokeWidth: 1, strokeDasharray: "3 3" }}
                    contentStyle={{ background: INK.surface2, border: `1px solid ${INK.line2}`, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: INK.text }}
                    itemStyle={{ color: INK.text2 }}
                    labelFormatter={(d) => new Date(String(d)).toLocaleDateString()}
                    formatter={(v, name) => [c.format(Number(v)), name]}
                  />
                  {c.series.map((s, i) => (
                    <Line
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      type="monotone"
                      stroke={GROUP_COLORS[i]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, stroke: INK.surface, strokeWidth: 2 }}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-lq-muted leading-relaxed">{c.note}</p>
          </figure>
        ))}
      </div>
      <p className="text-xs text-lq-muted">
        Rolling {data.window}-session windows, every {data.step} sessions, over about two years. Regime readings describe the past
        and are not a forecast.
      </p>
    </div>
  );
}
