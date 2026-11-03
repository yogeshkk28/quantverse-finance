import type { ScreenerRow } from "../../types";
import type { MetricKey } from "./metrics";

export type CapBand = "mega" | "large" | "mid" | "small";
export type SignalKey = "macd" | "golden" | "above50" | "above200" | "nearHigh" | "oversold" | "overbought" | "unusualVol";

export interface Range {
  min: string;
  max: string;
}

export interface Filters {
  search: string;
  markets: Array<"US" | "IN">;
  sectors: string[];
  caps: CapBand[];
  ranges: Partial<Record<MetricKey, Range>>;
  signals: SignalKey[];
  watchOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  search: "",
  markets: [],
  sectors: [],
  caps: [],
  ranges: {},
  signals: [],
  watchOnly: false,
};

export const CAP_BANDS: Array<{ id: CapBand; label: string; hint: string; test: (usd: number) => boolean }> = [
  { id: "mega", label: "Mega", hint: "Over $200B", test: (v) => v >= 200e9 },
  { id: "large", label: "Large", hint: "$10B to $200B", test: (v) => v >= 10e9 && v < 200e9 },
  { id: "mid", label: "Mid", hint: "$2B to $10B", test: (v) => v >= 2e9 && v < 10e9 },
  { id: "small", label: "Small", hint: "Under $2B", test: (v) => v < 2e9 },
];

export const SIGNALS: Array<{ id: SignalKey; label: string; hint: string; test: (r: ScreenerRow) => boolean }> = [
  { id: "above200", label: "Above 200D", hint: "Price above its 200-day moving average", test: (r) => (r.sma200Dist ?? -1) > 0 },
  { id: "above50", label: "Above 50D", hint: "Price above its 50-day moving average", test: (r) => (r.sma50Dist ?? -1) > 0 },
  { id: "golden", label: "Golden cross", hint: "50-day average above the 200-day average", test: (r) => r.goldenCross === true },
  { id: "macd", label: "MACD bull cross", hint: "MACD crossed above its signal line in the last 5 sessions", test: (r) => r.macdCross === true },
  { id: "nearHigh", label: "Near 52W high", hint: "Within 3% of the 52-week high", test: (r) => (r.fromHigh52 ?? -100) >= -3 },
  { id: "unusualVol", label: "Unusual volume", hint: "Volume at least 2× the 3-month average", test: (r) => (r.relVolume ?? 0) >= 2 },
  { id: "oversold", label: "RSI oversold", hint: "RSI(14) at or below 30", test: (r) => r.rsi !== null && r.rsi <= 30 },
  { id: "overbought", label: "RSI overbought", hint: "RSI(14) at or above 70", test: (r) => r.rsi !== null && r.rsi >= 70 },
];

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  filters: Partial<Filters>;
}

const r = (min = "", max = ""): Range => ({ min, max });

export const PRESETS: Preset[] = [
  { id: "momentum", label: "Momentum leaders", blurb: "Top-quintile momentum, above the 200-day, not yet overbought", filters: { ranges: { scoreMomentum: r("80"), rsi: r("", "75") }, signals: ["above200"] } },
  { id: "breakouts", label: "52-week breakouts", blurb: "Near the yearly high on above-average volume", filters: { ranges: { relVolume: r("1.3") }, signals: ["nearHigh"] } },
  { id: "composite", label: "Top composite", blurb: "Lumina composite score of 75 or more", filters: { ranges: { scoreComposite: r("75") } } },
  { id: "value", label: "Deep value", blurb: "P/E under 15 and price/book under 2.5", filters: { ranges: { pe: r("", "15"), pb: r("", "2.5") } } },
  { id: "garp", label: "Growth at a fair price", blurb: "Forward EPS growth over 12% for a P/E under 30", filters: { ranges: { pe: r("", "30"), epsGrowth: r("12") } } },
  { id: "dividend", label: "Dividend defensives", blurb: "Yield of 3%+ with beta under 0.9", filters: { ranges: { divYield: r("3"), beta: r("", "0.9") } } },
  { id: "lowvol", label: "Low volatility", blurb: "Annualised volatility under 22% and drawdown shallower than 15%", filters: { ranges: { volatility: r("", "22"), maxDrawdown: r("-15") } } },
  { id: "oversold", label: "Oversold bounce", blurb: "RSI under 35 in a stock still above its 200-day", filters: { ranges: { rsi: r("", "35") }, signals: ["above200"] } },
  { id: "trend", label: "Fresh trend", blurb: "Golden cross with a recent MACD bull cross", filters: { signals: ["golden", "macd"] } },
  { id: "volume", label: "Unusual volume", blurb: "Trading at least twice the usual volume today", filters: { signals: ["unusualVol"] } },
  { id: "knives", label: "Falling knives", blurb: "Down 20%+ over 3 months and below the 200-day. For study, not a buy list.", filters: { ranges: { perfM3: r("", "-20"), sma200Dist: r("", "0") } } },
];

export function presetFilters(p: Preset): Filters {
  return { ...EMPTY_FILTERS, ...p.filters, ranges: { ...(p.filters.ranges ?? {}) }, signals: [...(p.filters.signals ?? [])] };
}

const parse = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const v = Number(s);
  return isFinite(v) ? v : null;
};

export function activeRanges(f: Filters): Array<[MetricKey, number | null, number | null]> {
  return (Object.entries(f.ranges) as Array<[MetricKey, Range]>)
    .map(([k, rg]) => [k, parse(rg?.min), parse(rg?.max)] as [MetricKey, number | null, number | null])
    .filter(([, lo, hi]) => lo !== null || hi !== null);
}

export function countActive(f: Filters): number {
  return (
    (f.search ? 1 : 0) +
    f.markets.length +
    f.sectors.length +
    f.caps.length +
    activeRanges(f).length +
    f.signals.length +
    (f.watchOnly ? 1 : 0)
  );
}

export function applyFilters(rows: ScreenerRow[], f: Filters, watchlist: Set<string>): ScreenerRow[] {
  const q = f.search.trim().toLowerCase();
  const ranges = activeRanges(f);
  const signals = SIGNALS.filter((s) => f.signals.includes(s.id));
  const caps = CAP_BANDS.filter((c) => f.caps.includes(c.id));
  return rows.filter((row) => {
    if (q && !row.id.toLowerCase().includes(q) && !row.name.toLowerCase().includes(q) && !row.industry.toLowerCase().includes(q)) return false;
    if (f.markets.length && !f.markets.includes(row.market)) return false;
    if (f.sectors.length && !f.sectors.includes(row.sector)) return false;
    if (caps.length && (row.mktCapUsd === null || !caps.some((c) => c.test(row.mktCapUsd!)))) return false;
    if (f.watchOnly && !watchlist.has(row.id)) return false;
    for (const [key, lo, hi] of ranges) {
      const v = row[key];
      if (v === null || v === undefined) return false;
      if (lo !== null && v < lo) return false;
      if (hi !== null && v > hi) return false;
    }
    for (const s of signals) if (!s.test(row)) return false;
    return true;
  });
}
