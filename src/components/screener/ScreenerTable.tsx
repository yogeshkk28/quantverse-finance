import React from "react";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import type { ScreenerRow } from "../../types";
import { METRIC, MetricKey, formatMetric, formatPrice } from "./metrics";

export type SortKey = MetricKey | "id" | "sector";
export type ColumnSet = "overview" | "performance" | "valuation" | "technicals" | "risk" | "factors";

export const COLUMN_SETS: Array<{ id: ColumnSet; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "valuation", label: "Valuation" },
  { id: "technicals", label: "Technicals" },
  { id: "risk", label: "Risk" },
  { id: "factors", label: "Factor scores" },
];

interface Column {
  id: string;
  label: string;
  title?: string;
  sort?: SortKey;
  align?: "left" | "right" | "center";
  render: (r: ScreenerRow) => React.ReactNode;
}

export function Sparkline({ values, width = 96, height = 26 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-lq-muted text-[11px]">—</span>;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - lo) / span) * (height - 4)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const up = values[values.length - 1] >= values[0];
  const stroke = up ? "var(--lq-up)" : "var(--lq-down)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`1-year trend ${up ? "up" : "down"}`}>
      <path d={`${d}L${width},${height}L0,${height}Z`} fill={stroke} opacity={0.08} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={1.8} fill={stroke} />
    </svg>
  );
}

function Direction({ v, text }: { v: number | null; text: string }) {
  if (v === null) return <span className="text-lq-muted">—</span>;
  const cls = v > 0 ? "text-lq-up" : v < 0 ? "text-lq-down" : "text-lq-text-2";
  return (
    <span className={`${cls} inline-flex items-center gap-0.5`}>
      <span aria-hidden="true" className="text-[8px]">{v > 0 ? "▲" : v < 0 ? "▼" : "•"}</span>
      {text}
    </span>
  );
}

function metricCell(key: MetricKey) {
  return (r: ScreenerRow) => {
    const m = METRIC[key];
    const text = formatMetric(key, r);
    if (m.direction) return <Direction v={r[key]} text={text.replace("+", "")} />;
    return <span className={r[key] === null ? "text-lq-muted" : "text-lq-text-2"}>{text}</span>;
  };
}

function ScoreBar({ v }: { v: number | null }) {
  if (v === null) return <span className="text-lq-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-2 justify-end w-full">
      <span className="relative h-1.5 w-14 rounded-full bg-lq-line overflow-hidden">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${v}%`, background: "var(--lq-gold-grad)", opacity: 0.35 + (v / 100) * 0.65 }}
        />
      </span>
      <span className={`w-6 text-right ${v >= 80 ? "text-lq-gold" : "text-lq-text-2"}`}>{Math.round(v)}</span>
    </span>
  );
}

function RsiGauge({ v }: { v: number | null }) {
  if (v === null) return <span className="text-lq-muted">—</span>;
  const tone = v >= 70 ? "text-lq-gold" : v <= 30 ? "text-lq-gold-soft" : "text-lq-text-2";
  return (
    <span className="inline-flex items-center gap-2 justify-end w-full" title={v >= 70 ? "Overbought zone" : v <= 30 ? "Oversold zone" : undefined}>
      <span className="relative h-1.5 w-12 rounded-full bg-lq-line">
        <span className="absolute inset-y-0 left-[30%] right-[30%] bg-lq-line-2" />
        <span className="absolute top-1/2 w-1.5 h-1.5 -mt-[3px] -ml-[3px] rounded-full bg-lq-gold" style={{ left: `${v}%` }} />
      </span>
      <span className={`w-8 text-right ${tone}`}>{v.toFixed(0)}</span>
    </span>
  );
}

function RangeBar({ r }: { r: ScreenerRow }) {
  if (r.high52 === null || r.low52 === null || r.price === null || r.high52 <= r.low52) return <span className="text-lq-muted">—</span>;
  const pos = Math.max(0, Math.min(1, (r.price - r.low52) / (r.high52 - r.low52)));
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] text-lq-muted" title={`52W low ${formatPrice(r.low52, r.currency)} · high ${formatPrice(r.high52, r.currency)}`}>
      <span className="relative h-1 w-20 rounded-full" style={{ background: "linear-gradient(90deg, rgba(248,113,113,.35), rgba(74,222,128,.35))" }}>
        <span className="absolute top-1/2 w-[3px] h-3 -mt-1.5 -ml-[1.5px] rounded-sm bg-lq-text" style={{ left: `${pos * 100}%` }} />
      </span>
      <span className="w-8 text-right text-lq-text-2">{Math.round(pos * 100)}%</span>
    </span>
  );
}

const Flag = ({ on, label }: { on: boolean | null; label: string }) =>
  on ? <span className="lq-tag !py-[3px] !px-1.5 !text-[9px]">{label}</span> : <span className="text-lq-muted">·</span>;

const SPARK: Column = { id: "spark", label: "1Y trend", align: "center", render: (r) => <Sparkline values={r.spark} /> };
const PRICE: Column = { id: "price", label: "Price", sort: "price", align: "right", render: (r) => <span className="text-lq-text">{formatPrice(r.price, r.currency)}</span> };
const m = (key: MetricKey, extra: Partial<Column> = {}): Column => ({
  id: key,
  label: METRIC[key].short,
  title: `${METRIC[key].label}. ${METRIC[key].hint}`,
  sort: key,
  align: "right",
  render: metricCell(key),
  ...extra,
});
const score = (key: MetricKey): Column => m(key, { render: (r) => <ScoreBar v={r[key]} /> });

const COLUMNS: Record<ColumnSet, Column[]> = {
  overview: [
    { id: "sector", label: "Sector", sort: "sector", render: (r) => <span className="text-lq-muted text-[11.5px] font-sans" title={r.industry}>{r.sector}</span> },
    PRICE,
    m("chg"),
    m("mktCapUsd"),
    m("relVolume"),
    m("pe"),
    m("rsi", { render: (r) => <RsiGauge v={r.rsi} /> }),
    m("perfY1"),
    SPARK,
    score("scoreComposite"),
  ],
  performance: [PRICE, m("chg"), m("perfW1"), m("perfM1"), m("perfM3"), m("perfM6"), m("perfYtd"), m("perfY1"), SPARK],
  valuation: [PRICE, m("mktCapUsd"), m("pe"), m("fwdPe"), m("pb"), m("divYield"), m("epsGrowth"), m("analyst"), score("scoreValue")],
  technicals: [
    PRICE,
    m("rsi", { render: (r) => <RsiGauge v={r.rsi} /> }),
    m("sma50Dist"),
    m("sma200Dist"),
    { id: "range", label: "52W range", sort: "fromLow52", title: "Where the price sits between its 52-week low and high", render: (r) => <RangeBar r={r} /> },
    m("fromHigh52"),
    m("relVolume"),
    { id: "macd", label: "MACD", align: "center", title: "MACD crossed above its signal line in the last 5 sessions", render: (r) => <Flag on={r.macdCross} label="Bull ×" /> },
    { id: "gc", label: "50/200", align: "center", title: "Golden cross: 50-day average above the 200-day", render: (r) => <Flag on={r.goldenCross} label="Golden" /> },
  ],
  risk: [PRICE, m("beta"), m("volatility"), m("maxDrawdown"), m("sharpe"), m("fromHigh52"), m("turnoverUsd"), score("scoreStability")],
  factors: [PRICE, score("scoreComposite"), score("scoreValue"), score("scoreMomentum"), score("scoreStability"), score("scoreGrowth"), SPARK],
};

interface TableProps {
  rows: ScreenerRow[];
  columnSet: ColumnSet;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (k: SortKey) => void;
  watchlist: Set<string>;
  onToggleWatch: (id: string) => void;
  onSelect: (r: ScreenerRow) => void;
  rankOffset: number;
}

export default function ScreenerTable({ rows, columnSet, sortKey, sortAsc, onSort, watchlist, onToggleWatch, onSelect, rankOffset }: TableProps) {
  const cols = COLUMNS[columnSet];
  const header = (label: string, key?: SortKey, align: Column["align"] = "left", title?: string) => {
    const active = key && sortKey === key;
    const Icon = sortAsc ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={active ? (sortAsc ? "ascending" : "descending") : undefined}
        className={`!py-2.5 !px-2.5 sticky top-0 z-10 bg-lq-surface ${align === "right" ? "!text-right" : align === "center" ? "!text-center" : ""}`}
        title={title}
      >
        {key ? (
          <button
            type="button"
            onClick={() => onSort(key)}
            className={`inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-lq-gold transition-colors ${active ? "text-lq-gold" : ""}`}
          >
            {label}
            {active && <Icon className="w-3 h-3" />}
          </button>
        ) : (
          label
        )}
      </th>
    );
  };

  return (
    <table className="lq-table min-w-[980px]">
      <thead>
        <tr>
          <th scope="col" className="!py-2.5 !px-2 sticky top-0 z-10 bg-lq-surface w-8">
            <span className="sr-only">Watchlist</span>
          </th>
          <th scope="col" className="!py-2.5 !px-1 sticky top-0 z-10 bg-lq-surface w-8 !text-right">#</th>
          {header("Symbol", "id")}
          {cols.map((c) => (
            <React.Fragment key={c.id}>{header(c.label, c.sort, c.align, c.title)}</React.Fragment>
          ))}
        </tr>
      </thead>
      <tbody className="lq-num text-[12.5px]">
        {rows.map((r, i) => {
          const watched = watchlist.has(r.id);
          return (
            <tr
              key={r.id}
              onClick={() => onSelect(r)}
              className="group cursor-pointer hover:bg-[rgba(245,230,202,0.035)] transition-colors"
            >
              <td className="!py-1.5 !px-2">
                <button
                  type="button"
                  aria-label={watched ? `Remove ${r.id} from watchlist` : `Add ${r.id} to watchlist`}
                  aria-pressed={watched}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWatch(r.id);
                  }}
                  className={`p-1 rounded ${watched ? "text-lq-gold" : "text-lq-line-2 group-hover:text-lq-muted hover:!text-lq-gold"}`}
                >
                  <Star className="w-3.5 h-3.5" fill={watched ? "currentColor" : "none"} />
                </button>
              </td>
              <td className="!py-1.5 !px-1 text-right text-[10.5px] text-lq-muted">{rankOffset + i + 1}</td>
              <td className="!py-1.5 !px-2.5">
                <div className="flex items-center gap-2 min-w-[180px] max-w-[240px]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lq-gold font-medium group-hover:underline underline-offset-2">{r.id}</span>
                      {r.market === "IN" && <span className="text-[8.5px] tracking-wider text-lq-muted border border-lq-line-2 rounded px-1 py-px">NSE</span>}
                      {r.source === "partial" && (
                        <span title="Some metrics missing: one data source didn't answer for this stock" className="text-[8.5px] text-lq-muted">◐</span>
                      )}
                    </div>
                    <div className="font-sans text-[11px] text-lq-muted truncate">{r.name}</div>
                  </div>
                </div>
              </td>
              {cols.map((c) => (
                <td key={c.id} className={`!py-1.5 !px-2.5 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
