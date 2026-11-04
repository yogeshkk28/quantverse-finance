import type { ScreenerRow } from "../../types";

/** Numeric fields of a screener row that can be filtered, sorted, plotted or coloured by. */
export type MetricKey = {
  [K in keyof ScreenerRow]-?: ScreenerRow[K] extends number | null ? K : never;
}[keyof ScreenerRow];

export type MetricGroup = "Size & liquidity" | "Valuation" | "Performance" | "Technicals" | "Risk" | "Factor scores";

export interface Metric {
  key: MetricKey;
  label: string;
  short: string;
  group: MetricGroup;
  unit: "pct" | "x" | "ratio" | "usd" | "price" | "score" | "num";
  /** Shows price direction: coloured up/down and always signed. */
  direction?: boolean;
  /** Plain-language note shown as a tooltip. */
  hint: string;
  /** Values beyond these are clipped on histograms and plots. */
  clip?: [number, number];
}

export const METRICS: Metric[] = [
  // Size & liquidity
  { key: "mktCapUsd", label: "Market cap (USD)", short: "Mkt cap", group: "Size & liquidity", unit: "usd", hint: "Shares outstanding × price, converted to US dollars for NSE stocks." },
  { key: "turnoverUsd", label: "Avg daily value traded", short: "ADV $", group: "Size & liquidity", unit: "usd", hint: "Average daily volume (3 months) × price, in US dollars. A liquidity gauge." },
  { key: "relVolume", label: "Relative volume", short: "Rel vol", group: "Size & liquidity", unit: "x", hint: "Today's volume divided by the 3-month average. Above 2× is unusual.", clip: [0, 5] },
  { key: "price", label: "Price (local)", short: "Price", group: "Size & liquidity", unit: "price", hint: "Last price in the stock's own currency." },

  // Valuation
  { key: "pe", label: "P/E (trailing)", short: "P/E", group: "Valuation", unit: "ratio", hint: "Price over the last 12 months' earnings per share. Blank when earnings are negative.", clip: [0, 120] },
  { key: "fwdPe", label: "P/E (forward)", short: "Fwd P/E", group: "Valuation", unit: "ratio", hint: "Price over analysts' expected earnings for the next 12 months.", clip: [0, 100] },
  { key: "pb", label: "Price / book", short: "P/B", group: "Valuation", unit: "ratio", hint: "Price over book value (assets minus liabilities) per share.", clip: [0, 30] },
  { key: "divYield", label: "Dividend yield", short: "Yield", group: "Valuation", unit: "pct", hint: "Annual dividends as a share of price.", clip: [0, 10] },
  { key: "epsGrowth", label: "Forward EPS growth", short: "EPS gr.", group: "Valuation", unit: "pct", hint: "Expected change from trailing to forward earnings per share.", clip: [-60, 120] },
  { key: "analyst", label: "Analyst rating", short: "Rating", group: "Valuation", unit: "num", hint: "Average analyst view: 1 = strong buy, 3 = hold, 5 = sell." },

  // Performance
  { key: "chg", label: "Change today", short: "1D", group: "Performance", unit: "pct", direction: true, hint: "Percent change from the previous close.", clip: [-10, 10] },
  { key: "perfW1", label: "1 week", short: "1W", group: "Performance", unit: "pct", direction: true, hint: "Return over the last 5 sessions.", clip: [-20, 20] },
  { key: "perfM1", label: "1 month", short: "1M", group: "Performance", unit: "pct", direction: true, hint: "Return over the last 21 sessions.", clip: [-35, 35] },
  { key: "perfM3", label: "3 months", short: "3M", group: "Performance", unit: "pct", direction: true, hint: "Return over the last 63 sessions.", clip: [-50, 60] },
  { key: "perfM6", label: "6 months", short: "6M", group: "Performance", unit: "pct", direction: true, hint: "Return over the last 126 sessions.", clip: [-60, 100] },
  { key: "perfYtd", label: "Year to date", short: "YTD", group: "Performance", unit: "pct", direction: true, hint: "Return since the last close of the previous year.", clip: [-60, 150] },
  { key: "perfY1", label: "1 year", short: "1Y", group: "Performance", unit: "pct", direction: true, hint: "Return over the past year.", clip: [-70, 200] },

  // Technicals
  { key: "rsi", label: "RSI (14)", short: "RSI", group: "Technicals", unit: "num", hint: "Relative Strength Index. Under 30 is often read as oversold, over 70 as overbought." },
  { key: "sma50Dist", label: "vs 50-day average", short: "vs 50D", group: "Technicals", unit: "pct", direction: true, hint: "How far the price sits above or below its 50-day moving average.", clip: [-30, 30] },
  { key: "sma200Dist", label: "vs 200-day average", short: "vs 200D", group: "Technicals", unit: "pct", direction: true, hint: "How far the price sits above or below its 200-day moving average.", clip: [-50, 60] },
  { key: "fromHigh52", label: "From 52-week high", short: "From high", group: "Technicals", unit: "pct", direction: true, hint: "Distance below the 52-week high. 0% means at the high.", clip: [-70, 0] },
  { key: "fromLow52", label: "From 52-week low", short: "From low", group: "Technicals", unit: "pct", direction: true, hint: "Distance above the 52-week low.", clip: [0, 200] },

  // Risk
  { key: "beta", label: "Beta (1Y)", short: "Beta", group: "Risk", unit: "ratio", hint: "Sensitivity to the S&P 500 (US) or Nifty 50 (India). 1 moves with the market.", clip: [-0.5, 3] },
  { key: "volatility", label: "Volatility (3M, annual)", short: "Vol", group: "Risk", unit: "pct", hint: "Standard deviation of daily returns over 3 months, annualised.", clip: [0, 100] },
  { key: "maxDrawdown", label: "Max drawdown (1Y)", short: "Max DD", group: "Risk", unit: "pct", hint: "Largest peak-to-trough fall over the past year.", clip: [-80, 0] },
  { key: "sharpe", label: "Sharpe ratio (1Y)", short: "Sharpe", group: "Risk", unit: "ratio", hint: "Annualised return per unit of volatility, with a zero risk-free rate.", clip: [-3, 5] },

  // Factor scores
  { key: "scoreComposite", label: "Lumina composite", short: "Score", group: "Factor scores", unit: "score", hint: "Average of the four factor scores below. 0–100 percentile within the stock's market." },
  { key: "scoreValue", label: "Value score", short: "Value", group: "Factor scores", unit: "score", hint: "Percentile rank of earnings yield, book yield and dividend yield (cheaper ranks higher)." },
  { key: "scoreMomentum", label: "Momentum score", short: "Mom.", group: "Factor scores", unit: "score", hint: "Percentile rank of 6-month return, 1-year return and distance above the 200-day average." },
  { key: "scoreStability", label: "Stability score", short: "Stab.", group: "Factor scores", unit: "score", hint: "Percentile rank of low volatility, shallow drawdown and Sharpe ratio." },
  { key: "scoreGrowth", label: "Growth score", short: "Growth", group: "Factor scores", unit: "score", hint: "Percentile rank of expected forward EPS growth." },
];

export const METRIC: Record<MetricKey, Metric> = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, Metric>;

export const GROUPS: MetricGroup[] = ["Performance", "Valuation", "Technicals", "Risk", "Factor scores", "Size & liquidity"];

export function compactUsd(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(a >= 1e11 ? 0 : 1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${Math.round(v).toLocaleString()}`;
}

export function compactNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

export function formatPrice(v: number | null, currency: string): string {
  if (v === null) return "—";
  return `${currency}${v.toLocaleString(currency === "₹" ? "en-IN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMetric(key: MetricKey, row: ScreenerRow): string {
  const v = row[key];
  if (v === null || v === undefined) return "—";
  const m = METRIC[key];
  switch (m.unit) {
    case "pct":
      return `${m.direction && v > 0 ? "+" : ""}${v.toFixed(Math.abs(v) >= 100 ? 0 : 1)}%`;
    case "x":
      return `${v.toFixed(2)}×`;
    case "ratio":
      return v.toFixed(Math.abs(v) >= 100 ? 0 : key === "beta" || key === "sharpe" ? 2 : 1);
    case "usd":
      return compactUsd(v);
    case "price":
      return formatPrice(v, row.currency);
    case "score":
      return String(Math.round(v));
    default:
      return v.toFixed(1);
  }
}

/** Value formatted without a row, for axis ticks and histograms. */
export function formatValue(key: MetricKey, v: number): string {
  const m = METRIC[key];
  if (m.unit === "usd") return compactUsd(v);
  if (m.unit === "pct") return `${v.toFixed(Math.abs(v) >= 10 ? 0 : 1)}%`;
  if (m.unit === "x") return `${v.toFixed(1)}×`;
  if (m.unit === "score") return String(Math.round(v));
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1);
}

export function directionClass(v: number | null): string {
  if (v === null || v === 0) return "text-lq-text-2";
  return v > 0 ? "text-lq-up" : "text-lq-down";
}

/** p-th percentile (0–1) of the non-null values. */
export function quantile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

export function valuesOf(rows: ScreenerRow[], key: MetricKey): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const v = r[key];
    if (v !== null && v !== undefined && isFinite(v)) out.push(v);
  }
  return out;
}

/**
 * Colour for a value on the heatmap and scatter. Price-direction metrics use the up/down
 * tokens (diverging around zero); everything else ramps from surface to gold.
 */
export function colorScale(key: MetricKey, rows: ScreenerRow[]): (v: number | null) => string {
  const m = METRIC[key];
  const vals = valuesOf(rows, key);
  const surface = [22, 25, 36];
  const up = [74, 222, 128];
  const down = [248, 113, 113];
  const gold = [212, 175, 55];
  const mix = (a: number[], b: number[], t: number) =>
    `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`;
  if (m.direction) {
    const span = Math.max(0.5, quantile(vals.map(Math.abs), 0.9));
    return (v) => {
      if (v === null) return "rgb(38,42,56)";
      const t = Math.min(1, Math.abs(v) / span);
      return mix(surface, v >= 0 ? up : down, 0.15 + 0.7 * t);
    };
  }
  const lo = quantile(vals, 0.05);
  const hi = quantile(vals, 0.95);
  const lowerIsBetter = key === "pe" || key === "fwdPe" || key === "pb" || key === "volatility" || key === "analyst";
  return (v) => {
    if (v === null) return "rgb(38,42,56)";
    let t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
    t = Math.max(0, Math.min(1, t));
    if (lowerIsBetter) t = 1 - t;
    return mix(surface, gold, 0.1 + 0.8 * t);
  };
}
