/**
 * Lumina Fear & Greed: a stock-market sentiment index computed from free data,
 * modelled on the approach behind CNN's index (which has no public API).
 *
 * Each input is turned into a daily series, scored as the percentile of today's
 * value within its own last 252 trading days (0 = most fearful, 100 = most greedy),
 * and the scores are averaged.
 */
import { config } from "./config";
import { UNIVERSE, BENCHMARK, Market } from "./universe";
import { cached, expire, getYahooChart, Chart, mapLimit, sma, percentileOfLast, round } from "./marketData";
import { fetchFredSeries } from "./apiClients";

export interface FearGreedComponent {
  key: string;
  label: string;
  score: number; // 0–100, already inverted where higher raw value means fear
  detail: string;
}

export interface FearGreedResult {
  market: Market;
  value: number | null;
  label: string;
  components: FearGreedComponent[];
  asOf: string;
  source: "lumina-computed";
}

const MIN_COMPONENTS = 3;

// Shorten the cache life of an incomplete result so missing inputs are fetched again soon.
function retryLater(key: string) {
  expire(key, 60_000);
}

type Dated = Map<string, number>;

const dayKey = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);

function closesByDate(chart: Chart): Dated {
  return new Map(chart.candles.map((c) => [dayKey(c.time), c.close]));
}

/** Rolling transform over a chart's closes, keyed by date. */
function rolling(chart: Chart, period: number, fn: (closes: number[], i: number) => number | null): Dated {
  const closes = chart.candles.map((c) => c.close);
  const out: Dated = new Map();
  for (let i = period; i < closes.length; i++) {
    const v = fn(closes, i);
    if (v !== null && isFinite(v)) out.set(dayKey(chart.candles[i].time), v);
  }
  return out;
}

const vsAverage = (period: number) => (closes: number[], i: number) => {
  const avg = sma(closes, period, i);
  return avg ? closes[i] / avg - 1 : null;
};

const trailingReturn = (period: number) => (closes: number[], i: number) => closes[i] / closes[i - period] - 1;

function score(series: number[], invert: boolean): number | null {
  const p = percentileOfLast(series);
  return p === null ? null : round(invert ? 100 - p : p, 0);
}

export function band(value: number): string {
  if (value < 25) return "Extreme Fear";
  if (value < 45) return "Fear";
  if (value <= 55) return "Neutral";
  if (value <= 75) return "Greed";
  return "Extreme Greed";
}

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

const INPUTS: Record<Market, { volatility: string; volLabel: string; risk: string; haven: string; havenLabel: string }> = {
  US: { volatility: "^VIX", volLabel: "VIX", risk: "SPY", haven: "TLT", havenLabel: "stocks (SPY) vs bonds (TLT)" },
  IN: { volatility: "^INDIAVIX", volLabel: "India VIX", risk: "NIFTYBEES.NS", haven: "GOLDBEES.NS", havenLabel: "Nifty ETF vs gold ETF" },
};

async function compute(market: Market): Promise<FearGreedResult> {
  const cfg = INPUTS[market];
  const members = UNIVERSE.filter((u) => u.market === market);
  const [bench, vol, risk, haven] = await Promise.all(
    [BENCHMARK[market], cfg.volatility, cfg.risk, cfg.haven].map((s) => getYahooChart(s, "2y"))
  );
  const memberCharts = (await mapLimit(members, 4, (m) => getYahooChart(m.symbol, "2y"))).filter(
    (c): c is Chart => c !== null && c.candles.length > 260
  );

  const components: FearGreedComponent[] = [];
  const add = (key: string, label: string, series: Dated, invert: boolean, detail: (last: number) => string) => {
    const values = [...series.values()];
    const s = score(values, invert);
    if (s !== null) components.push({ key, label, score: s, detail: detail(values[values.length - 1]) });
  };

  // 1. Momentum: index vs its 125-day average
  if (bench) {
    add("momentum", "Market momentum", rolling(bench, 125, vsAverage(125)), false,
      (v) => `${market === "US" ? "S&P 500" : "Nifty 50"} is ${fmtPct(v)} vs its 125-day average`);
  }

  // 2. Volatility: VIX vs its 50-day average (higher = fear)
  if (vol) {
    add("volatility", "Volatility", rolling(vol, 50, vsAverage(50)), true,
      (v) => `${cfg.volLabel} is ${fmtPct(v)} vs its 50-day average`);
  }

  // 3. Safe-haven demand: 20-day return of stocks minus a safe asset
  if (risk && haven) {
    const r = rolling(risk, 20, trailingReturn(20));
    const h = rolling(haven, 20, trailingReturn(20));
    const diff: Dated = new Map();
    for (const [d, v] of r) if (h.has(d)) diff.set(d, v - h.get(d)!);
    add("safeHaven", "Safe-haven demand", diff, false, (v) => `20-day return gap, ${cfg.havenLabel}: ${fmtPct(v)}`);
  }

  // 4 & 5. Breadth and strength across the Lumina universe, on the benchmark's calendar
  if (bench && memberCharts.length >= 5) {
    const perMember = memberCharts.map((c) => ({
      close: closesByDate(c),
      above50: rolling(c, 50, (cl, i) => (cl[i] > (sma(cl, 50, i) ?? Infinity) ? 1 : 0)),
      highLow: rolling(c, 252, (cl, i) => {
        const win = cl.slice(i - 251, i + 1);
        if (cl[i] >= Math.max(...win) * 0.97) return 1;
        if (cl[i] <= Math.min(...win) * 1.03) return -1;
        return 0;
      }),
    }));
    const breadth: Dated = new Map();
    const strength: Dated = new Map();
    for (const c of bench.candles) {
      const d = dayKey(c.time);
      const a = perMember.map((m) => m.above50.get(d)).filter((v): v is number => v !== undefined);
      const s = perMember.map((m) => m.highLow.get(d)).filter((v): v is number => v !== undefined);
      if (a.length >= 5) breadth.set(d, a.reduce((x, y) => x + y, 0) / a.length);
      if (s.length >= 5) strength.set(d, s.reduce((x, y) => x + y, 0) / s.length);
    }
    add("breadth", "Market breadth", breadth, false, (v) => `${Math.round(v * 100)}% of tracked stocks are above their 50-day average`);
    add("strength", "Price strength", strength, false, (v) => `Net ${Math.round(v * 100)}% of tracked stocks near 52-week highs vs lows`);
  }

  // 6. Junk-bond demand (US only): high-yield spread, higher = fear
  if (market === "US" && config.fred.apiKey) {
    const obs = await fetchFredSeries("BAMLH0A0HYM2", config.fred.apiKey, "lin", 400);
    if (obs && obs.length > 30) {
      const spread: Dated = new Map(obs.reverse().map((o: any) => [o.date, parseFloat(o.value)]));
      add("junkBond", "Junk-bond demand", spread, true, (v) => `High-yield spread is ${v.toFixed(2)} percentage points`);
    }
  }

  const missing = [
    !bench && BENCHMARK[market], !vol && cfg.volatility, !risk && cfg.risk, !haven && cfg.haven,
  ].filter(Boolean);
  if (missing.length || memberCharts.length < members.length) {
    console.warn(
      `[Fear & Greed ${market}] Missing inputs: ${missing.join(", ") || "none"}; ` +
        `member histories ${memberCharts.length}/${members.length}`
    );
  }

  const value =
    components.length >= MIN_COMPONENTS
      ? Math.round(components.reduce((sum, c) => sum + c.score, 0) / components.length)
      : null;

  return {
    market,
    value,
    label: value === null ? "Unavailable" : band(value),
    components,
    asOf: new Date().toISOString(),
    source: "lumina-computed",
  };
}

/** Cached for 15 minutes per market; an incomplete result is retried after a minute. */
export async function getFearGreed(market: Market): Promise<FearGreedResult> {
  const result = await cached(`fng:${market}`, 15 * 60_000, () => compute(market));
  if (result.value === null || result.components.length < 6 - (market === "IN" ? 1 : 0)) {
    retryLater(`fng:${market}`);
  }
  return result;
}
