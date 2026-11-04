/**
 * Technical indicators for the chart page. Every function is pure: bars in, aligned
 * series out (null where the window isn't full yet). Arrays may run past the last bar
 * (Ichimoku's leading span); those values are drawn on future time slots.
 */

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Num = number | null;
type Series = Num[];

// -------------------------------------------------------------------------
// Building blocks
// -------------------------------------------------------------------------

export function sma(v: Series, n: number): Series {
  const out: Series = new Array(v.length).fill(null);
  let sum = 0, count = 0;
  for (let i = 0; i < v.length; i++) {
    const x = v[i];
    if (x !== null) { sum += x; count++; }
    if (i >= n) {
      const old = v[i - n];
      if (old !== null) { sum -= old; count--; }
    }
    if (i >= n - 1 && count === n) out[i] = sum / n;
  }
  return out;
}

export function ema(v: Series, n: number): Series {
  const out: Series = new Array(v.length).fill(null);
  const k = 2 / (n + 1);
  let prev: number | null = null;
  let seed = 0, seen = 0;
  for (let i = 0; i < v.length; i++) {
    const x = v[i];
    if (x === null) continue;
    if (prev === null) {
      seed += x; seen++;
      if (seen === n) { prev = seed / n; out[i] = prev; }
      continue;
    }
    prev = x * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's smoothing (RMA), used by RSI, ATR and ADX. */
export function rma(v: Series, n: number): Series {
  const out: Series = new Array(v.length).fill(null);
  let prev: number | null = null;
  let seed = 0, seen = 0;
  for (let i = 0; i < v.length; i++) {
    const x = v[i];
    if (x === null) continue;
    if (prev === null) {
      seed += x; seen++;
      if (seen === n) { prev = seed / n; out[i] = prev; }
      continue;
    }
    prev = (prev * (n - 1) + x) / n;
    out[i] = prev;
  }
  return out;
}

export function wma(v: Series, n: number): Series {
  const out: Series = new Array(v.length).fill(null);
  const denom = (n * (n + 1)) / 2;
  for (let i = n - 1; i < v.length; i++) {
    let s = 0, ok = true;
    for (let j = 0; j < n; j++) {
      const x = v[i - j];
      if (x === null) { ok = false; break; }
      s += x * (n - j);
    }
    if (ok) out[i] = s / denom;
  }
  return out;
}

function stdev(v: Series, n: number): Series {
  const mean = sma(v, n);
  return v.map((_, i) => {
    const m = mean[i];
    if (m === null) return null;
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += ((v[j] as number) - m) ** 2;
    return Math.sqrt(s / n);
  });
}

function highest(v: number[], n: number): Series {
  return v.map((_, i) => (i < n - 1 ? null : Math.max(...v.slice(i - n + 1, i + 1))));
}
function lowest(v: number[], n: number): Series {
  return v.map((_, i) => (i < n - 1 ? null : Math.min(...v.slice(i - n + 1, i + 1))));
}

function trueRange(b: Bar[]): number[] {
  return b.map((x, i) => (i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close))));
}

const zip = (a: Series, b: Series, f: (x: number, y: number) => number): Series =>
  a.map((x, i) => (x === null || b[i] === null ? null : f(x, b[i] as number)));

const closes = (b: Bar[]) => b.map((x) => x.close);
const hl2 = (b: Bar[]) => b.map((x) => (x.high + x.low) / 2);
const hlc3 = (b: Bar[]) => b.map((x) => (x.high + x.low + x.close) / 3);

export function source(b: Bar[], src: number): number[] {
  switch (src) {
    case 1: return b.map((x) => x.open);
    case 2: return b.map((x) => x.high);
    case 3: return b.map((x) => x.low);
    case 4: return hl2(b);
    case 5: return hlc3(b);
    default: return closes(b);
  }
}

export function rsi(v: number[], n: number): Series {
  const up: Series = v.map((x, i) => (i === 0 ? null : Math.max(x - v[i - 1], 0)));
  const dn: Series = v.map((x, i) => (i === 0 ? null : Math.max(v[i - 1] - x, 0)));
  const au = rma(up, n), ad = rma(dn, n);
  return au.map((u, i) => (u === null || ad[i] === null ? null : ad[i] === 0 ? 100 : 100 - 100 / (1 + u / (ad[i] as number))));
}

export function atr(b: Bar[], n: number): Series {
  return rma(trueRange(b), n);
}

// -------------------------------------------------------------------------
// Indicator registry
// -------------------------------------------------------------------------

export type Category = "Moving averages" | "Trend" | "Momentum" | "Volatility" | "Volume";

export interface ParamDef {
  key: string;
  label: string;
  default: number;
  min?: number;
  max?: number;
  step?: number;
  /** Shown as a select (e.g. source) instead of a number field. */
  options?: Array<{ value: number; label: string }>;
}

export interface PlotDef {
  key: string;
  title: string;
  type: "line" | "histogram" | "dots" | "step";
  color: string;
  /** Histogram colour for negative values. */
  colorDown?: string;
  width?: number;
  dashed?: boolean;
  /** Colour each point by the sign of this output: `color` when ≥ 0, `colorDown` when < 0. */
  signKey?: string;
}

export interface BandDef {
  upper: string;
  lower: string;
  color: string;
  /** When set, the fill uses this colour wherever lower is above upper (Ichimoku cloud). */
  colorAlt?: string;
}

export interface IndicatorDef {
  id: string;
  name: string;
  short: string;
  category: Category;
  overlay: boolean;
  description: string;
  params: ParamDef[];
  plots: PlotDef[];
  bands?: BandDef[];
  levels?: number[];
  /** Fixed value range for the pane (RSI 0–100). */
  bounds?: [number, number];
  compute: (b: Bar[], p: Record<string, number>) => Record<string, Series>;
}

const SRC: ParamDef = {
  key: "src",
  label: "Source",
  default: 0,
  options: [
    { value: 0, label: "Close" },
    { value: 1, label: "Open" },
    { value: 2, label: "High" },
    { value: 3, label: "Low" },
    { value: 4, label: "HL/2" },
    { value: 5, label: "HLC/3" },
  ],
};

// Palette for indicator lines: distinct from gold (actions) and green/red (direction).
export const C = {
  sky: "#5ab0ff",
  amber: "#ffb547",
  orchid: "#d27cff",
  teal: "#2ed3c6",
  rose: "#ff7aa8",
  lime: "#b6e35a",
  sand: "#e8d8a8",
  slate: "#9aa3b8",
  up: "#4ade80",
  down: "#f87171",
};

const hist = (key: string, title: string): PlotDef => ({ key, title, type: "histogram", color: "rgba(74,222,128,0.55)", colorDown: "rgba(248,113,113,0.55)" });

export const INDICATORS: IndicatorDef[] = [
  // ---------------- Moving averages ----------------
  {
    id: "sma", name: "Simple Moving Average", short: "SMA", category: "Moving averages", overlay: true,
    description: "Average close over the last N bars.",
    params: [{ key: "length", label: "Length", default: 50, min: 1, max: 500 }, SRC],
    plots: [{ key: "ma", title: "SMA", type: "line", color: C.sky }],
    compute: (b, p) => ({ ma: sma(source(b, p.src), p.length) }),
  },
  {
    id: "ema", name: "Exponential Moving Average", short: "EMA", category: "Moving averages", overlay: true,
    description: "Moving average that weights recent bars more.",
    params: [{ key: "length", label: "Length", default: 21, min: 1, max: 500 }, SRC],
    plots: [{ key: "ma", title: "EMA", type: "line", color: C.amber }],
    compute: (b, p) => ({ ma: ema(source(b, p.src), p.length) }),
  },
  {
    id: "wma", name: "Weighted Moving Average", short: "WMA", category: "Moving averages", overlay: true,
    description: "Linearly weighted average of the last N bars.",
    params: [{ key: "length", label: "Length", default: 20, min: 1, max: 500 }, SRC],
    plots: [{ key: "ma", title: "WMA", type: "line", color: C.orchid }],
    compute: (b, p) => ({ ma: wma(source(b, p.src), p.length) }),
  },
  {
    id: "hma", name: "Hull Moving Average", short: "HMA", category: "Moving averages", overlay: true,
    description: "Fast, low-lag average built from weighted averages.",
    params: [{ key: "length", label: "Length", default: 21, min: 2, max: 500 }, SRC],
    plots: [{ key: "ma", title: "HMA", type: "line", color: C.teal }],
    compute: (b, p) => {
      const s = source(b, p.src);
      const half = wma(s, Math.max(1, Math.round(p.length / 2)));
      const full = wma(s, p.length);
      return { ma: wma(zip(half, full, (h, f) => 2 * h - f), Math.max(1, Math.round(Math.sqrt(p.length)))) };
    },
  },
  {
    id: "vwma", name: "Volume Weighted Moving Average", short: "VWMA", category: "Moving averages", overlay: true,
    description: "Average close weighted by each bar's volume.",
    params: [{ key: "length", label: "Length", default: 20, min: 1, max: 500 }],
    plots: [{ key: "ma", title: "VWMA", type: "line", color: C.rose }],
    compute: (b, p) => {
      const pv = sma(b.map((x) => x.close * x.volume), p.length);
      const v = sma(b.map((x) => x.volume), p.length);
      return { ma: zip(pv, v, (a, c) => (c ? a / c : NaN)).map((x) => (x !== null && isFinite(x) ? x : null)) };
    },
  },
  {
    id: "ma_ribbon", name: "Moving Average Ribbon", short: "MA Ribbon", category: "Moving averages", overlay: true,
    description: "EMAs 20, 50, 100 and 200 together to read trend alignment.",
    params: [],
    plots: [
      { key: "e20", title: "EMA 20", type: "line", color: C.lime, width: 1 },
      { key: "e50", title: "EMA 50", type: "line", color: C.sky, width: 1 },
      { key: "e100", title: "EMA 100", type: "line", color: C.orchid, width: 1 },
      { key: "e200", title: "EMA 200", type: "line", color: C.amber, width: 2 },
    ],
    compute: (b) => {
      const c = closes(b);
      return { e20: ema(c, 20), e50: ema(c, 50), e100: ema(c, 100), e200: ema(c, 200) };
    },
  },

  // ---------------- Trend ----------------
  {
    id: "vwap", name: "VWAP (session)", short: "VWAP", category: "Trend", overlay: true,
    description: "Volume-weighted average price, reset each trading day on intraday charts.",
    params: [{ key: "bands", label: "Band std devs (0 = off)", default: 0, min: 0, max: 4, step: 0.5 }],
    plots: [
      { key: "vwap", title: "VWAP", type: "line", color: C.sand, width: 2 },
      { key: "up", title: "Upper", type: "line", color: "rgba(232,216,168,0.45)", width: 1 },
      { key: "dn", title: "Lower", type: "line", color: "rgba(232,216,168,0.45)", width: 1 },
    ],
    compute: (b, p) => {
      const vwap: Series = [], up: Series = [], dn: Series = [];
      const intraday = b.length > 1 && b[1].time - b[0].time < 86_400;
      let pv = 0, vol = 0, pv2 = 0, day = -1;
      for (const x of b) {
        const d = Math.floor(x.time / 86_400);
        if (intraday && d !== day) { pv = 0; vol = 0; pv2 = 0; day = d; }
        const tp = (x.high + x.low + x.close) / 3;
        const v = x.volume || 1;
        pv += tp * v; vol += v; pv2 += tp * tp * v;
        const m = pv / vol;
        vwap.push(m);
        const sd = Math.sqrt(Math.max(0, pv2 / vol - m * m));
        up.push(p.bands ? m + sd * p.bands : null);
        dn.push(p.bands ? m - sd * p.bands : null);
      }
      return { vwap, up, dn };
    },
  },
  {
    id: "ichimoku", name: "Ichimoku Cloud", short: "Ichimoku", category: "Trend", overlay: true,
    description: "Conversion, base and lagging lines plus the leading cloud plotted ahead of price.",
    params: [
      { key: "conv", label: "Conversion", default: 9, min: 1 },
      { key: "base", label: "Base", default: 26, min: 1 },
      { key: "spanB", label: "Leading span B", default: 52, min: 1 },
      { key: "disp", label: "Displacement", default: 26, min: 1 },
    ],
    plots: [
      { key: "tenkan", title: "Conversion", type: "line", color: C.sky, width: 1 },
      { key: "kijun", title: "Base", type: "line", color: C.rose, width: 1 },
      { key: "chikou", title: "Lagging", type: "line", color: "rgba(182,227,90,0.7)", width: 1 },
      { key: "spanA", title: "Lead A", type: "line", color: "rgba(74,222,128,0.6)", width: 1 },
      { key: "spanB", title: "Lead B", type: "line", color: "rgba(248,113,113,0.6)", width: 1 },
    ],
    bands: [{ upper: "spanA", lower: "spanB", color: "rgba(74,222,128,0.10)", colorAlt: "rgba(248,113,113,0.10)" }],
    compute: (b, p) => {
      const h = b.map((x) => x.high), l = b.map((x) => x.low);
      const mid = (n: number) => zip(highest(h, n), lowest(l, n), (a, c) => (a + c) / 2);
      const tenkan = mid(p.conv), kijun = mid(p.base);
      const a = zip(tenkan, kijun, (x, y) => (x + y) / 2);
      const bb = mid(p.spanB);
      const pad = (s: Series) => [...new Array(p.disp).fill(null), ...s];
      const chikou: Series = b.map((_, i) => b[i + p.disp]?.close ?? null);
      return { tenkan, kijun, chikou, spanA: pad(a), spanB: pad(bb) };
    },
  },
  {
    id: "psar", name: "Parabolic SAR", short: "PSAR", category: "Trend", overlay: true,
    description: "Stop-and-reverse dots that trail price and flip when the trend turns.",
    params: [
      { key: "start", label: "Start", default: 0.02, step: 0.01, min: 0.001 },
      { key: "inc", label: "Increment", default: 0.02, step: 0.01, min: 0.001 },
      { key: "max", label: "Max", default: 0.2, step: 0.05, min: 0.01 },
    ],
    plots: [{ key: "sar", title: "SAR", type: "dots", color: C.sand }],
    compute: (b, p) => {
      const out: Series = new Array(b.length).fill(null);
      if (b.length < 3) return { sar: out };
      let long = b[1].close >= b[0].close;
      let af = p.start;
      let ep = long ? b[0].high : b[0].low;
      let sar = long ? b[0].low : b[0].high;
      for (let i = 1; i < b.length; i++) {
        sar = sar + af * (ep - sar);
        if (long) {
          sar = Math.min(sar, b[i - 1].low, b[Math.max(0, i - 2)].low);
          if (b[i].low < sar) { long = false; sar = ep; ep = b[i].low; af = p.start; }
          else if (b[i].high > ep) { ep = b[i].high; af = Math.min(af + p.inc, p.max); }
        } else {
          sar = Math.max(sar, b[i - 1].high, b[Math.max(0, i - 2)].high);
          if (b[i].high > sar) { long = true; sar = ep; ep = b[i].high; af = p.start; }
          else if (b[i].low < ep) { ep = b[i].low; af = Math.min(af + p.inc, p.max); }
        }
        out[i] = sar;
      }
      return { sar: out };
    },
  },
  {
    id: "supertrend", name: "Supertrend", short: "Supertrend", category: "Trend", overlay: true,
    description: "ATR-based trailing line: green below price in uptrends, red above in downtrends.",
    params: [{ key: "length", label: "ATR length", default: 10, min: 1 }, { key: "mult", label: "Multiplier", default: 3, step: 0.5, min: 0.5 }],
    plots: [{ key: "st", title: "Supertrend", type: "step", color: C.up, colorDown: C.down, width: 2, signKey: "dir" }],
    compute: (b, p) => {
      const a = atr(b, p.length);
      const st: Series = [], dir: Series = [];
      let fu = 0, fl = 0, trend = 1;
      b.forEach((x, i) => {
        const at = a[i];
        if (at === null) { st.push(null); dir.push(null); return; }
        const m = (x.high + x.low) / 2;
        const bu = m + p.mult * at, bl = m - p.mult * at;
        const pc = b[i - 1]?.close ?? x.close;
        fu = fu === 0 || bu < fu || pc > fu ? bu : fu;
        fl = fl === 0 || bl > fl || pc < fl ? bl : fl;
        if (trend === 1 && x.close < fl) trend = -1;
        else if (trend === -1 && x.close > fu) trend = 1;
        st.push(trend === 1 ? fl : fu);
        dir.push(trend);
      });
      return { st, dir };
    },
  },
  {
    id: "adx", name: "ADX / DMI", short: "ADX", category: "Trend", overlay: false,
    description: "Trend strength (ADX) with +DI and −DI direction lines.",
    params: [{ key: "length", label: "Length", default: 14, min: 1 }],
    plots: [
      { key: "adx", title: "ADX", type: "line", color: C.sand, width: 2 },
      { key: "pdi", title: "+DI", type: "line", color: C.up, width: 1 },
      { key: "mdi", title: "−DI", type: "line", color: C.down, width: 1 },
    ],
    levels: [25],
    compute: (b, p) => {
      const pdm: Series = b.map((x, i) => {
        if (i === 0) return null;
        const u = x.high - b[i - 1].high, d = b[i - 1].low - x.low;
        return u > d && u > 0 ? u : 0;
      });
      const mdm: Series = b.map((x, i) => {
        if (i === 0) return null;
        const u = x.high - b[i - 1].high, d = b[i - 1].low - x.low;
        return d > u && d > 0 ? d : 0;
      });
      const tr = rma(trueRange(b).map((v, i) => (i === 0 ? null : v)), p.length);
      const pdi = zip(rma(pdm, p.length), tr, (a, t) => (t ? (100 * a) / t : 0));
      const mdi = zip(rma(mdm, p.length), tr, (a, t) => (t ? (100 * a) / t : 0));
      const dx = zip(pdi, mdi, (a, c) => (a + c ? (100 * Math.abs(a - c)) / (a + c) : 0));
      return { adx: rma(dx, p.length), pdi, mdi };
    },
  },
  {
    id: "aroon", name: "Aroon", short: "Aroon", category: "Trend", overlay: false,
    description: "How many bars since the highest high and lowest low, scaled 0–100.",
    params: [{ key: "length", label: "Length", default: 14, min: 1 }],
    plots: [
      { key: "up", title: "Up", type: "line", color: C.up },
      { key: "dn", title: "Down", type: "line", color: C.down },
    ],
    bounds: [0, 100],
    compute: (b, p) => {
      const up: Series = [], dn: Series = [];
      b.forEach((_, i) => {
        if (i < p.length) { up.push(null); dn.push(null); return; }
        let hi = i, lo = i;
        for (let j = i - p.length; j <= i; j++) {
          if (b[j].high >= b[hi].high) hi = j;
          if (b[j].low <= b[lo].low) lo = j;
        }
        up.push((100 * (p.length - (i - hi))) / p.length);
        dn.push((100 * (p.length - (i - lo))) / p.length);
      });
      return { up, dn };
    },
  },

  // ---------------- Volatility ----------------
  {
    id: "bb", name: "Bollinger Bands", short: "BB", category: "Volatility", overlay: true,
    description: "SMA with bands N standard deviations above and below.",
    params: [{ key: "length", label: "Length", default: 20, min: 1 }, { key: "mult", label: "Std dev", default: 2, step: 0.5, min: 0.5 }, SRC],
    plots: [
      { key: "basis", title: "Basis", type: "line", color: C.amber, width: 1 },
      { key: "upper", title: "Upper", type: "line", color: C.sky, width: 1 },
      { key: "lower", title: "Lower", type: "line", color: C.sky, width: 1 },
    ],
    bands: [{ upper: "upper", lower: "lower", color: "rgba(90,176,255,0.07)" }],
    compute: (b, p) => {
      const s = source(b, p.src);
      const basis = sma(s, p.length), sd = stdev(s, p.length);
      return { basis, upper: zip(basis, sd, (m, d) => m + p.mult * d), lower: zip(basis, sd, (m, d) => m - p.mult * d) };
    },
  },
  {
    id: "keltner", name: "Keltner Channels", short: "KC", category: "Volatility", overlay: true,
    description: "EMA with bands a multiple of ATR away.",
    params: [{ key: "length", label: "Length", default: 20, min: 1 }, { key: "mult", label: "ATR multiplier", default: 2, step: 0.5, min: 0.5 }],
    plots: [
      { key: "basis", title: "Basis", type: "line", color: C.teal, width: 1 },
      { key: "upper", title: "Upper", type: "line", color: C.teal, width: 1, dashed: true },
      { key: "lower", title: "Lower", type: "line", color: C.teal, width: 1, dashed: true },
    ],
    bands: [{ upper: "upper", lower: "lower", color: "rgba(46,211,198,0.06)" }],
    compute: (b, p) => {
      const basis = ema(closes(b), p.length), a = atr(b, p.length);
      return { basis, upper: zip(basis, a, (m, d) => m + p.mult * d), lower: zip(basis, a, (m, d) => m - p.mult * d) };
    },
  },
  {
    id: "donchian", name: "Donchian Channels", short: "DC", category: "Volatility", overlay: true,
    description: "Highest high and lowest low over N bars, with the midline.",
    params: [{ key: "length", label: "Length", default: 20, min: 1 }],
    plots: [
      { key: "upper", title: "Upper", type: "line", color: C.orchid, width: 1 },
      { key: "mid", title: "Basis", type: "line", color: "rgba(210,124,255,0.6)", width: 1, dashed: true },
      { key: "lower", title: "Lower", type: "line", color: C.orchid, width: 1 },
    ],
    bands: [{ upper: "upper", lower: "lower", color: "rgba(210,124,255,0.06)" }],
    compute: (b, p) => {
      const upper = highest(b.map((x) => x.high), p.length), lower = lowest(b.map((x) => x.low), p.length);
      return { upper, lower, mid: zip(upper, lower, (a, c) => (a + c) / 2) };
    },
  },
  {
    id: "envelope", name: "Envelope", short: "ENV", category: "Volatility", overlay: true,
    description: "SMA with bands a fixed percent above and below.",
    params: [{ key: "length", label: "Length", default: 20, min: 1 }, { key: "pct", label: "Percent", default: 2.5, step: 0.5, min: 0.1 }],
    plots: [
      { key: "basis", title: "Basis", type: "line", color: C.lime, width: 1 },
      { key: "upper", title: "Upper", type: "line", color: C.lime, width: 1, dashed: true },
      { key: "lower", title: "Lower", type: "line", color: C.lime, width: 1, dashed: true },
    ],
    compute: (b, p) => {
      const basis = sma(closes(b), p.length);
      return { basis, upper: basis.map((m) => (m === null ? null : m * (1 + p.pct / 100))), lower: basis.map((m) => (m === null ? null : m * (1 - p.pct / 100))) };
    },
  },
  {
    id: "atr", name: "Average True Range", short: "ATR", category: "Volatility", overlay: false,
    description: "Average size of each bar's full range, gaps included.",
    params: [{ key: "length", label: "Length", default: 14, min: 1 }],
    plots: [{ key: "atr", title: "ATR", type: "line", color: C.rose }],
    compute: (b, p) => ({ atr: atr(b, p.length) }),
  },
  {
    id: "bbw", name: "Bollinger Band Width", short: "BBW", category: "Volatility", overlay: false,
    description: "Band width as a share of the basis. Low values mark squeezes.",
    params: [{ key: "length", label: "Length", default: 20, min: 1 }, { key: "mult", label: "Std dev", default: 2, step: 0.5 }],
    plots: [{ key: "w", title: "Width", type: "line", color: C.sky }],
    compute: (b, p) => {
      const c = closes(b), basis = sma(c, p.length), sd = stdev(c, p.length);
      return { w: zip(basis, sd, (m, d) => (m ? (2 * p.mult * d) / m : 0)) };
    },
  },
  {
    id: "hv", name: "Historical Volatility", short: "HV", category: "Volatility", overlay: false,
    description: "Annualised standard deviation of log returns, in percent.",
    params: [{ key: "length", label: "Length", default: 20, min: 2 }, { key: "periods", label: "Bars per year", default: 252, min: 1 }],
    plots: [{ key: "hv", title: "HV %", type: "line", color: C.orchid }],
    compute: (b, p) => {
      const r: Series = b.map((x, i) => (i === 0 ? null : Math.log(x.close / b[i - 1].close)));
      return { hv: stdev(r, p.length).map((s) => (s === null ? null : s * Math.sqrt(p.periods) * 100)) };
    },
  },

  // ---------------- Momentum ----------------
  {
    id: "rsi", name: "Relative Strength Index", short: "RSI", category: "Momentum", overlay: false,
    description: "Wilder's RSI with 70/30 bands and a signal average.",
    params: [{ key: "length", label: "Length", default: 14, min: 1 }, { key: "ma", label: "Signal SMA", default: 14, min: 1 }, SRC],
    plots: [
      { key: "rsi", title: "RSI", type: "line", color: C.orchid, width: 2 },
      { key: "ma", title: "MA", type: "line", color: C.amber, width: 1 },
    ],
    levels: [70, 50, 30],
    bounds: [0, 100],
    compute: (b, p) => {
      const r = rsi(source(b, p.src), p.length);
      return { rsi: r, ma: sma(r, p.ma) };
    },
  },
  {
    id: "macd", name: "MACD", short: "MACD", category: "Momentum", overlay: false,
    description: "Difference of two EMAs, its signal line and histogram.",
    params: [{ key: "fast", label: "Fast", default: 12, min: 1 }, { key: "slow", label: "Slow", default: 26, min: 1 }, { key: "signal", label: "Signal", default: 9, min: 1 }, SRC],
    plots: [
      hist("hist", "Histogram"),
      { key: "macd", title: "MACD", type: "line", color: C.sky, width: 2 },
      { key: "signal", title: "Signal", type: "line", color: C.amber, width: 1 },
    ],
    levels: [0],
    compute: (b, p) => {
      const s = source(b, p.src);
      const m = zip(ema(s, p.fast), ema(s, p.slow), (a, c) => a - c);
      const sig = ema(m, p.signal);
      return { macd: m, signal: sig, hist: zip(m, sig, (a, c) => a - c) };
    },
  },
  {
    id: "stoch", name: "Stochastic", short: "Stoch", category: "Momentum", overlay: false,
    description: "Where the close sits in the recent high–low range (%K) and its average (%D).",
    params: [{ key: "k", label: "%K length", default: 14, min: 1 }, { key: "smooth", label: "%K smoothing", default: 3, min: 1 }, { key: "d", label: "%D", default: 3, min: 1 }],
    plots: [
      { key: "k", title: "%K", type: "line", color: C.sky, width: 2 },
      { key: "d", title: "%D", type: "line", color: C.amber, width: 1 },
    ],
    levels: [80, 20],
    bounds: [0, 100],
    compute: (b, p) => {
      const hh = highest(b.map((x) => x.high), p.k), ll = lowest(b.map((x) => x.low), p.k);
      const raw: Series = b.map((x, i) => (hh[i] === null ? null : hh[i] === ll[i] ? 50 : (100 * (x.close - (ll[i] as number))) / ((hh[i] as number) - (ll[i] as number))));
      const k = sma(raw, p.smooth);
      return { k, d: sma(k, p.d) };
    },
  },
  {
    id: "stochrsi", name: "Stochastic RSI", short: "Stoch RSI", category: "Momentum", overlay: false,
    description: "Stochastic applied to RSI values: a faster overbought/oversold read.",
    params: [{ key: "rsi", label: "RSI length", default: 14, min: 1 }, { key: "stoch", label: "Stoch length", default: 14, min: 1 }, { key: "k", label: "K", default: 3, min: 1 }, { key: "d", label: "D", default: 3, min: 1 }],
    plots: [
      { key: "k", title: "K", type: "line", color: C.sky, width: 2 },
      { key: "d", title: "D", type: "line", color: C.amber, width: 1 },
    ],
    levels: [80, 20],
    bounds: [0, 100],
    compute: (b, p) => {
      const r = rsi(closes(b), p.rsi);
      const raw: Series = r.map((x, i) => {
        if (x === null || i < p.stoch - 1) return null;
        const w = r.slice(i - p.stoch + 1, i + 1);
        if (w.some((v) => v === null)) return null;
        const hi = Math.max(...(w as number[])), lo = Math.min(...(w as number[]));
        return hi === lo ? 50 : (100 * (x - lo)) / (hi - lo);
      });
      const k = sma(raw, p.k);
      return { k, d: sma(k, p.d) };
    },
  },
  {
    id: "cci", name: "Commodity Channel Index", short: "CCI", category: "Momentum", overlay: false,
    description: "Typical price's distance from its average, in mean deviations.",
    params: [{ key: "length", label: "Length", default: 20, min: 1 }],
    plots: [{ key: "cci", title: "CCI", type: "line", color: C.teal }],
    levels: [100, 0, -100],
    compute: (b, p) => {
      const tp = hlc3(b), m = sma(tp, p.length);
      return {
        cci: tp.map((x, i) => {
          const mean = m[i];
          if (mean === null) return null;
          let md = 0;
          for (let j = i - p.length + 1; j <= i; j++) md += Math.abs(tp[j] - mean);
          md /= p.length;
          return md ? (x - mean) / (0.015 * md) : 0;
        }),
      };
    },
  },
  {
    id: "willr", name: "Williams %R", short: "%R", category: "Momentum", overlay: false,
    description: "Close relative to the N-bar high, from 0 (at the high) to −100.",
    params: [{ key: "length", label: "Length", default: 14, min: 1 }],
    plots: [{ key: "r", title: "%R", type: "line", color: C.rose }],
    levels: [-20, -80],
    bounds: [-100, 0],
    compute: (b, p) => {
      const hh = highest(b.map((x) => x.high), p.length), ll = lowest(b.map((x) => x.low), p.length);
      return { r: b.map((x, i) => (hh[i] === null ? null : hh[i] === ll[i] ? -50 : (-100 * ((hh[i] as number) - x.close)) / ((hh[i] as number) - (ll[i] as number)))) };
    },
  },
  {
    id: "roc", name: "Rate of Change", short: "ROC", category: "Momentum", overlay: false,
    description: "Percent change from N bars ago.",
    params: [{ key: "length", label: "Length", default: 12, min: 1 }],
    plots: [{ key: "roc", title: "ROC", type: "line", color: C.lime }],
    levels: [0],
    compute: (b, p) => ({ roc: b.map((x, i) => (i < p.length ? null : (100 * (x.close - b[i - p.length].close)) / b[i - p.length].close)) }),
  },
  {
    id: "mom", name: "Momentum", short: "MOM", category: "Momentum", overlay: false,
    description: "Close minus the close N bars ago.",
    params: [{ key: "length", label: "Length", default: 10, min: 1 }],
    plots: [{ key: "mom", title: "MOM", type: "line", color: C.sky }],
    levels: [0],
    compute: (b, p) => ({ mom: b.map((x, i) => (i < p.length ? null : x.close - b[i - p.length].close)) }),
  },
  {
    id: "ao", name: "Awesome Oscillator", short: "AO", category: "Momentum", overlay: false,
    description: "5-bar minus 34-bar SMA of the bar midpoint.",
    params: [],
    plots: [hist("ao", "AO")],
    levels: [0],
    compute: (b) => {
      const m = hl2(b);
      return { ao: zip(sma(m, 5), sma(m, 34), (a, c) => a - c) };
    },
  },
  {
    id: "trix", name: "TRIX", short: "TRIX", category: "Momentum", overlay: false,
    description: "Rate of change of a triple-smoothed EMA, in basis points.",
    params: [{ key: "length", label: "Length", default: 18, min: 1 }],
    plots: [{ key: "trix", title: "TRIX", type: "line", color: C.orchid }],
    levels: [0],
    compute: (b, p) => {
      const e3 = ema(ema(ema(closes(b), p.length), p.length), p.length);
      return { trix: e3.map((x, i) => (x === null || !e3[i - 1] ? null : 10000 * (x / (e3[i - 1] as number) - 1))) };
    },
  },
  {
    id: "uo", name: "Ultimate Oscillator", short: "UO", category: "Momentum", overlay: false,
    description: "Buying pressure averaged over three windows (7, 14, 28).",
    params: [{ key: "a", label: "Fast", default: 7, min: 1 }, { key: "b", label: "Middle", default: 14, min: 1 }, { key: "c", label: "Slow", default: 28, min: 1 }],
    plots: [{ key: "uo", title: "UO", type: "line", color: C.amber }],
    levels: [70, 30],
    bounds: [0, 100],
    compute: (b, p) => {
      const bp: Series = b.map((x, i) => (i === 0 ? null : x.close - Math.min(x.low, b[i - 1].close)));
      const tr: Series = trueRange(b).map((v, i) => (i === 0 ? null : v));
      const avg = (n: number) => zip(sma(bp, n), sma(tr, n), (a, c) => (c ? a / c : 0));
      const a1 = avg(p.a), a2 = avg(p.b), a3 = avg(p.c);
      return { uo: a1.map((x, i) => (x === null || a2[i] === null || a3[i] === null ? null : (100 * (4 * x + 2 * (a2[i] as number) + (a3[i] as number))) / 7)) };
    },
  },

  // ---------------- Volume ----------------
  {
    id: "obv", name: "On-Balance Volume", short: "OBV", category: "Volume", overlay: false,
    description: "Running total of volume, added on up bars and subtracted on down bars.",
    params: [],
    plots: [{ key: "obv", title: "OBV", type: "line", color: C.sky }],
    compute: (b) => {
      let t = 0;
      return { obv: b.map((x, i) => (i === 0 ? t : (t += x.close > b[i - 1].close ? x.volume : x.close < b[i - 1].close ? -x.volume : 0))) };
    },
  },
  {
    id: "mfi", name: "Money Flow Index", short: "MFI", category: "Volume", overlay: false,
    description: "Volume-weighted RSI of the typical price.",
    params: [{ key: "length", label: "Length", default: 14, min: 1 }],
    plots: [{ key: "mfi", title: "MFI", type: "line", color: C.teal }],
    levels: [80, 20],
    bounds: [0, 100],
    compute: (b, p) => {
      const tp = hlc3(b);
      return {
        mfi: b.map((_, i) => {
          if (i < p.length) return null;
          let pos = 0, neg = 0;
          for (let j = i - p.length + 1; j <= i; j++) {
            const f = tp[j] * b[j].volume;
            if (tp[j] > tp[j - 1]) pos += f;
            else if (tp[j] < tp[j - 1]) neg += f;
          }
          return neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);
        }),
      };
    },
  },
  {
    id: "cmf", name: "Chaikin Money Flow", short: "CMF", category: "Volume", overlay: false,
    description: "Accumulation vs distribution over N bars, from −1 to 1.",
    params: [{ key: "length", label: "Length", default: 20, min: 1 }],
    plots: [hist("cmf", "CMF")],
    levels: [0],
    compute: (b, p) => {
      const mfv = b.map((x) => (x.high === x.low ? 0 : ((x.close - x.low - (x.high - x.close)) / (x.high - x.low)) * x.volume));
      const s1 = sma(mfv, p.length), s2 = sma(b.map((x) => x.volume), p.length);
      return { cmf: zip(s1, s2, (a, c) => (c ? a / c : 0)) };
    },
  },
  {
    id: "ad", name: "Accumulation / Distribution", short: "A/D", category: "Volume", overlay: false,
    description: "Running total of volume weighted by where each bar closes in its range.",
    params: [],
    plots: [{ key: "ad", title: "A/D", type: "line", color: C.lime }],
    compute: (b) => {
      let t = 0;
      return { ad: b.map((x) => (t += x.high === x.low ? 0 : ((x.close - x.low - (x.high - x.close)) / (x.high - x.low)) * x.volume)) };
    },
  },
  {
    id: "volosc", name: "Volume Oscillator", short: "Vol Osc", category: "Volume", overlay: false,
    description: "Percent gap between a fast and slow volume EMA.",
    params: [{ key: "fast", label: "Fast", default: 5, min: 1 }, { key: "slow", label: "Slow", default: 10, min: 1 }],
    plots: [{ key: "vo", title: "VO %", type: "line", color: C.amber }],
    levels: [0],
    compute: (b, p) => {
      const v = b.map((x) => x.volume);
      return { vo: zip(ema(v, p.fast), ema(v, p.slow), (a, c) => (c ? (100 * (a - c)) / c : 0)) };
    },
  },
];

export const INDICATOR_BY_ID = Object.fromEntries(INDICATORS.map((d) => [d.id, d])) as Record<string, IndicatorDef>;

export function defaultParams(def: IndicatorDef): Record<string, number> {
  return Object.fromEntries(def.params.map((p) => [p.key, p.default]));
}

/** Heikin Ashi bars from regular OHLC. */
export function heikinAshi(b: Bar[]): Bar[] {
  const out: Bar[] = [];
  b.forEach((x, i) => {
    const close = (x.open + x.high + x.low + x.close) / 4;
    const open = i === 0 ? (x.open + x.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    out.push({ time: x.time, open, close, high: Math.max(x.high, open, close), low: Math.min(x.low, open, close), volume: x.volume });
  });
  return out;
}

// -------------------------------------------------------------------------
// Technical summary: a quick read of common signals on the current bars
// -------------------------------------------------------------------------

export interface Signal {
  name: string;
  value: string;
  vote: 1 | 0 | -1;
}

export function technicalSummary(b: Bar[]): { signals: Signal[]; score: number } {
  if (b.length < 30) return { signals: [], score: 0 };
  const c = closes(b);
  const last = c[c.length - 1];
  const at = <T,>(s: T[]) => s[s.length - 1];
  const signals: Signal[] = [];
  for (const n of [10, 20, 50, 100, 200]) {
    const v = at(sma(c, n));
    if (v !== null) signals.push({ name: `SMA ${n}`, value: v.toFixed(2), vote: last > v ? 1 : last < v ? -1 : 0 });
  }
  for (const n of [20, 50]) {
    const v = at(ema(c, n));
    if (v !== null) signals.push({ name: `EMA ${n}`, value: v.toFixed(2), vote: last > v ? 1 : -1 });
  }
  const r = at(rsi(c, 14));
  if (r !== null) signals.push({ name: "RSI 14", value: r.toFixed(1), vote: r < 30 ? 1 : r > 70 ? -1 : 0 });
  const m = INDICATOR_BY_ID.macd.compute(b, defaultParams(INDICATOR_BY_ID.macd));
  const mh = at(m.hist);
  if (mh !== null) signals.push({ name: "MACD 12/26", value: (at(m.macd) as number).toFixed(2), vote: mh > 0 ? 1 : -1 });
  const st = INDICATOR_BY_ID.stoch.compute(b, defaultParams(INDICATOR_BY_ID.stoch));
  const k = at(st.k);
  if (k !== null) signals.push({ name: "Stoch %K", value: k.toFixed(1), vote: k < 20 ? 1 : k > 80 ? -1 : 0 });
  const cci = at(INDICATOR_BY_ID.cci.compute(b, { length: 20 }).cci);
  if (cci !== null) signals.push({ name: "CCI 20", value: cci.toFixed(0), vote: cci < -100 ? 1 : cci > 100 ? -1 : 0 });
  const adx = INDICATOR_BY_ID.adx.compute(b, { length: 14 });
  const a = at(adx.adx);
  if (a !== null) signals.push({ name: "ADX 14", value: a.toFixed(1), vote: a > 20 ? ((at(adx.pdi) as number) > (at(adx.mdi) as number) ? 1 : -1) : 0 });
  const wr = at(INDICATOR_BY_ID.willr.compute(b, { length: 14 }).r);
  if (wr !== null) signals.push({ name: "Williams %R", value: wr.toFixed(1), vote: wr < -80 ? 1 : wr > -20 ? -1 : 0 });
  const total = signals.reduce((s, x) => s + x.vote, 0);
  return { signals, score: signals.length ? total / signals.length : 0 };
}
