/**
 * Raw OHLCV candles for the chart page: any interval from 1 minute to 1 month,
 * for any symbol Yahoo knows (stocks, indices, futures, FX, crypto, bond yields).
 *
 * Candles are passed through exactly as the exchange printed them: no smoothing,
 * no resampling except the 4-hour bars, which are built from real 1-hour bars.
 * When Yahoo cannot be reached the response says source: "sample" and the UI labels it.
 */
import { cached, fetchYahooJson, round } from "./marketData";
import { findEntry } from "./universe";
import { sampleTickers } from "./mockDb";

export type ChartInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D" | "1W" | "1M";
export type ChartRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "ytd" | "1y" | "2y" | "5y" | "10y" | "max";

interface IntervalSpec {
  yahoo: string;
  seconds: number;
  /** Longest range Yahoo serves for this interval. */
  maxRange: ChartRange;
  defaultRange: ChartRange;
  ttlMs: number;
}

export const INTERVALS: Record<ChartInterval, IntervalSpec> = {
  "1m": { yahoo: "1m", seconds: 60, maxRange: "5d", defaultRange: "5d", ttlMs: 15_000 },
  "5m": { yahoo: "5m", seconds: 300, maxRange: "1mo", defaultRange: "1mo", ttlMs: 30_000 },
  "15m": { yahoo: "15m", seconds: 900, maxRange: "1mo", defaultRange: "1mo", ttlMs: 60_000 },
  "30m": { yahoo: "30m", seconds: 1800, maxRange: "1mo", defaultRange: "1mo", ttlMs: 60_000 },
  "1h": { yahoo: "60m", seconds: 3600, maxRange: "2y", defaultRange: "6mo", ttlMs: 2 * 60_000 },
  "4h": { yahoo: "60m", seconds: 14_400, maxRange: "2y", defaultRange: "2y", ttlMs: 5 * 60_000 },
  "1D": { yahoo: "1d", seconds: 86_400, maxRange: "max", defaultRange: "5y", ttlMs: 5 * 60_000 },
  "1W": { yahoo: "1wk", seconds: 604_800, maxRange: "max", defaultRange: "10y", ttlMs: 30 * 60_000 },
  "1M": { yahoo: "1mo", seconds: 2_592_000, maxRange: "max", defaultRange: "max", ttlMs: 60 * 60_000 },
};

const RANGE_ORDER: ChartRange[] = ["1d", "5d", "1mo", "3mo", "6mo", "ytd", "1y", "2y", "5y", "10y", "max"];

export interface OhlcBar {
  /** Unix seconds, UTC. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleResponse {
  /** The id the page was opened with. */
  id: string;
  /** The Yahoo symbol actually used. */
  symbol: string;
  name: string;
  exchange: string;
  instrument: string;
  market: "US" | "IN" | "OTHER";
  currency: string;
  currencySymbol: string;
  interval: ChartInterval;
  range: ChartRange;
  source: "yahoo" | "sample";
  /** Seconds east of UTC for the exchange, so the axis can show exchange time. */
  gmtOffset: number;
  timezone: string;
  price: number;
  previousClose: number;
  dayHigh: number | null;
  dayLow: number | null;
  dayVolume: number | null;
  high52: number | null;
  low52: number | null;
  asOf: string;
  candles: OhlcBar[];
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", INR: "₹", EUR: "€", GBP: "£", JPY: "¥" };

function clampRange(interval: ChartInterval, range: ChartRange | undefined): ChartRange {
  const spec = INTERVALS[interval];
  const wanted = range && RANGE_ORDER.includes(range) ? range : spec.defaultRange;
  const max = RANGE_ORDER.indexOf(spec.maxRange);
  return RANGE_ORDER.indexOf(wanted) > max ? spec.maxRange : wanted;
}

/** Yahoo symbols to try for an id, best guess first. */
export function candidateSymbols(id: string): string[] {
  const raw = id.trim().toUpperCase();
  const entry = findEntry(raw);
  if (entry) return [entry.symbol];
  // Index (^), futures (=F), FX (=X), crypto (-USD) and suffixed listings (.NS) go straight through.
  if (/[\^=.\-]/.test(raw)) return [raw];
  return [raw, `${raw}.NS`, `${raw}.BO`];
}

function parseYahoo(data: any, interval: ChartInterval): { meta: any; bars: OhlcBar[] } | null {
  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result || !quote || !Array.isArray(result.timestamp)) return null;
  const bars: OhlcBar[] = [];
  const ts: number[] = result.timestamp;
  for (let i = 0; i < ts.length; i++) {
    const o = quote.open[i], h = quote.high[i], l = quote.low[i], c = quote.close[i];
    if (![o, h, l, c].every((v) => typeof v === "number" && isFinite(v) && v > 0)) continue;
    bars.push({ time: ts[i], open: o, high: h, low: l, close: c, volume: quote.volume?.[i] || 0 });
  }
  // Yahoo sometimes repeats the live bar with the same timestamp; keep the latest.
  const dedup: OhlcBar[] = [];
  for (const b of bars) {
    if (dedup.length && dedup[dedup.length - 1].time >= b.time) dedup[dedup.length - 1] = b;
    else dedup.push(b);
  }
  if (dedup.length === 0) return null;
  return { meta: result.meta || {}, bars: interval === "4h" ? aggregate(dedup, 4) : dedup };
}

/** Combine every `n` hourly bars of the same session day into one bar. */
function aggregate(bars: OhlcBar[], n: number): OhlcBar[] {
  const out: OhlcBar[] = [];
  let bucket: OhlcBar | null = null;
  let count = 0;
  let day = "";
  for (const b of bars) {
    const d = new Date(b.time * 1000).toISOString().slice(0, 10);
    if (!bucket || count >= n || d !== day) {
      if (bucket) out.push(bucket);
      bucket = { ...b };
      count = 1;
      day = d;
    } else {
      bucket.high = Math.max(bucket.high, b.high);
      bucket.low = Math.min(bucket.low, b.low);
      bucket.close = b.close;
      bucket.volume += b.volume;
      count++;
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

function marketOf(symbol: string, currency: string): CandleResponse["market"] {
  if (symbol.endsWith(".NS") || symbol.endsWith(".BO") || currency === "INR") return "IN";
  if (currency === "USD" && !/[=\-^]/.test(symbol)) return "US";
  return "OTHER";
}

function buildResponse(id: string, symbol: string, interval: ChartInterval, range: ChartRange, meta: any, bars: OhlcBar[]): CandleResponse {
  const entry = findEntry(id);
  const last = bars[bars.length - 1];
  const currency = meta.currency || (symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "INR" : "USD");
  const price = meta.regularMarketPrice || last.close;
  // Previous session close: the bar before today's session on intraday charts, the prior bar on daily.
  const gmt = typeof meta.gmtoffset === "number" ? meta.gmtoffset : 0;
  const dayOf = (t: number) => Math.floor((t + gmt) / 86_400);
  let previousClose: number;
  if (INTERVALS[interval].seconds < 86_400) {
    const lastDay = dayOf(last.time);
    const prior = [...bars].reverse().find((b) => dayOf(b.time) < lastDay);
    previousClose = prior?.close ?? meta.chartPreviousClose ?? last.open;
  } else if (interval === "1D") {
    previousClose = bars.length >= 2 ? bars[bars.length - 2].close : meta.chartPreviousClose ?? last.open;
  } else {
    previousClose = meta.previousClose ?? meta.chartPreviousClose ?? last.open;
  }
  return {
    id,
    symbol,
    name: meta.longName || meta.shortName || entry?.name || symbol,
    exchange: meta.fullExchangeName || meta.exchangeName || (symbol.endsWith(".NS") ? "NSE" : symbol.endsWith(".BO") ? "BSE" : ""),
    instrument: meta.instrumentType || "EQUITY",
    market: marketOf(symbol, currency),
    currency,
    currencySymbol: CURRENCY_SYMBOL[currency] ?? `${currency} `,
    interval,
    range,
    source: "yahoo",
    gmtOffset: typeof meta.gmtoffset === "number" ? meta.gmtoffset : 0,
    timezone: meta.exchangeTimezoneName || meta.timezone || "UTC",
    price,
    previousClose,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    dayVolume: meta.regularMarketVolume ?? null,
    high52: meta.fiftyTwoWeekHigh ?? null,
    low52: meta.fiftyTwoWeekLow ?? null,
    asOf: new Date((meta.regularMarketTime || last.time) * 1000).toISOString(),
    candles: bars,
  };
}

// Remember which Yahoo symbol answered for a bare id (e.g. MRF → MRF.NS).
const resolved = new Map<string, string>();

export async function getCandles(id: string, interval: ChartInterval, rangeIn?: ChartRange): Promise<CandleResponse> {
  const key = id.trim().toUpperCase();
  const range = clampRange(interval, rangeIn);
  const spec = INTERVALS[interval];

  return cached(`candles:${key}:${interval}:${range}`, spec.ttlMs, async () => {
    const tries = resolved.has(key) ? [resolved.get(key)!] : candidateSymbols(key);
    for (const symbol of tries) {
      const data = await fetchYahooJson(symbol, range, spec.yahoo);
      const parsed = data && parseYahoo(data, interval);
      if (parsed) {
        resolved.set(key, symbol);
        return buildResponse(key, symbol, interval, range, parsed.meta, parsed.bars);
      }
    }
    return sampleCandles(key, tries[0], interval, range);
  });
}

// -------------------------------------------------------------------------
// Sample candles: only when Yahoo is unreachable. Labelled "sample" in the UI.
// A seeded random walk with volatility clustering, gaps and intraday volume
// smiles, so the chart tools can still be exercised offline.
// -------------------------------------------------------------------------

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const RANGE_DAYS: Record<ChartRange, number> = {
  "1d": 1, "5d": 5, "1mo": 22, "3mo": 64, "6mo": 128, ytd: 210, "1y": 252, "2y": 504, "5y": 1260, "10y": 2520, max: 5000,
};

function sampleCandles(id: string, symbol: string, interval: ChartInterval, range: ChartRange): CandleResponse {
  const isIN = symbol.endsWith(".NS") || symbol.endsWith(".BO") || findEntry(id)?.market === "IN";
  const sample = sampleTickers.find((t) => t.id === id);
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const rnd = seeded(hash ^ 0x9e3779b9);
  const gauss = () => {
    const u = Math.max(rnd(), 1e-9), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const spec = INTERVALS[interval];
  const intraday = spec.seconds < 86_400;
  // Session: NSE 09:15–15:30 IST, US 09:30–16:00 ET (approximated as UTC-5).
  const gmtOffset = isIN ? 19_800 : -18_000;
  const openMin = isIN ? 9 * 60 + 15 : 9 * 60 + 30;
  const closeMin = isIN ? 15 * 60 + 30 : 16 * 60;
  const barMin = Math.max(1, spec.seconds / 60);

  // Walk backwards through trading days to collect bar open times.
  const days = Math.min(RANGE_DAYS[range], intraday ? 60 : 5000);
  const times: number[] = [];
  const now = new Date();
  const dayStarts: number[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const step = interval === "1W" ? 7 : interval === "1M" ? 30 : 1;
  while (dayStarts.length < Math.ceil(days / step) + 1) {
    const dow = cursor.getUTCDay();
    if (step > 1 || (dow !== 0 && dow !== 6)) dayStarts.unshift(cursor.getTime() / 1000);
    cursor.setUTCDate(cursor.getUTCDate() - step);
  }
  const nowSec = Date.now() / 1000;
  for (const d of dayStarts) {
    if (!intraday) {
      times.push(d);
      continue;
    }
    const barsPerBucket = interval === "4h" ? 4 : 1;
    const stepMin = interval === "4h" ? 60 * barsPerBucket : barMin;
    for (let m = openMin; m < closeMin; m += stepMin) {
      const t = d + m * 60 - gmtOffset;
      if (t <= nowSec) times.push(t);
    }
  }

  let price = sample?.price ?? (isIN ? 1500 : 150);
  // Start the walk lower/higher so it ends near the sample price.
  const dailyVol = 0.018;
  const barVol = dailyVol * Math.sqrt(intraday ? spec.seconds / 23_400 : spec.seconds / 86_400);
  let vol = barVol;
  const raw: OhlcBar[] = [];
  let prevDay = -1;
  for (const t of times) {
    const day = Math.floor((t + gmtOffset) / 86_400);
    let open = price;
    if (intraday && day !== prevDay && prevDay !== -1) open = price * (1 + gauss() * dailyVol * 0.35); // overnight gap
    prevDay = day;
    vol = Math.max(barVol * 0.4, Math.min(barVol * 3.5, vol * 0.94 + barVol * 0.06 + Math.abs(gauss()) * barVol * 0.08));
    const shock = rnd() < 0.01 ? gauss() * vol * 4 : 0;
    // Mild pull toward the starting level keeps multi-year samples in a plausible range.
    const drift = -0.01 * Math.log(open / (sample?.price ?? (isIN ? 1500 : 150))) * Math.min(30, Math.max(spec.seconds / 86_400, 0.05));
    const ret = Math.max(-0.4, Math.min(0.4, gauss() * vol + shock + drift));
    const close = open * (1 + ret);
    const wiggle = () => Math.abs(gauss()) * vol * 0.6;
    const high = Math.max(open, close) * (1 + wiggle());
    const low = Math.min(open, close) * (1 - wiggle());
    const minuteOfDay = ((t + gmtOffset) % 86_400) / 60;
    const smile = intraday ? 1 + 2.2 * Math.pow((minuteOfDay - (openMin + closeMin) / 2) / ((closeMin - openMin) / 2), 2) : 1;
    const baseVol = (isIN ? 4e6 : 25e6) * (spec.seconds / 86_400) * (intraday ? 1 : 1);
    const volume = Math.round(baseVol * smile * (0.6 + rnd() * 0.8) * (1 + Math.abs(ret) / vol * 0.4));
    raw.push({ time: Math.round(t), open, high, low, close, volume });
    price = close;
  }
  // Rescale so the last close equals the reference price.
  const ref = sample?.price ?? price;
  const k = raw.length ? ref / raw[raw.length - 1].close : 1;
  const digits = ref < 10 ? 4 : 2;
  const candles = raw.map((b) => ({
    time: b.time,
    open: round(b.open * k, digits),
    high: round(b.high * k, digits),
    low: round(b.low * k, digits),
    close: round(b.close * k, digits),
    volume: b.volume,
  }));
  const last = candles[candles.length - 1];
  const yearAgo = last.time - 365 * 86_400;
  const year = candles.filter((c) => c.time >= yearAgo);
  const highs = year.map((c) => c.high);
  const lows = year.map((c) => c.low);
  const currency = isIN ? "INR" : "USD";
  const lastDay = Math.floor((last.time + gmtOffset) / 86_400);
  const today = candles.filter((c) => Math.floor((c.time + gmtOffset) / 86_400) === lastDay);
  const prevClose = intraday ? candles[candles.length - today.length - 1]?.close ?? last.open : candles[candles.length - 2]?.close ?? last.open;
  return {
    id,
    symbol,
    name: findEntry(id)?.name || sample?.name || symbol,
    exchange: isIN ? "NSE" : "NASDAQ",
    instrument: "EQUITY",
    market: isIN ? "IN" : "US",
    currency,
    currencySymbol: CURRENCY_SYMBOL[currency],
    interval,
    range,
    source: "sample",
    gmtOffset,
    timezone: isIN ? "Asia/Kolkata" : "America/New_York",
    price: last.close,
    previousClose: prevClose,
    dayHigh: intraday ? Math.max(...today.map((c) => c.high)) : last.high,
    dayLow: intraday ? Math.min(...today.map((c) => c.low)) : last.low,
    dayVolume: intraday ? today.reduce((s, c) => s + c.volume, 0) : last.volume,
    high52: Math.max(...highs),
    low52: Math.min(...lows),
    asOf: new Date(last.time * 1000).toISOString(),
    candles,
  };
}
