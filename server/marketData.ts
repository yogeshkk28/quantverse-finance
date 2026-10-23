/**
 * Shared market-data helpers: a small TTL cache, the Yahoo Finance chart
 * endpoint (unofficial, no key, works for US and NSE symbols) and indicator math.
 */

// -------------------------------------------------------------------------
// TTL cache with in-flight de-duplication
// -------------------------------------------------------------------------

const cacheStore = new Map<string, { expires: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheStore.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = load().catch((err) => {
    cacheStore.delete(key); // never cache failures
    throw err;
  });
  cacheStore.set(key, { expires: Date.now() + ttlMs, value });
  return value;
}

// -------------------------------------------------------------------------
// Yahoo Finance v8 chart endpoint
// -------------------------------------------------------------------------

export const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Chart {
  symbol: string;
  candles: Candle[];
  price: number;
  previousClose: number;
  currency: string;
  asOf: string;
}

/** Daily candles plus the latest price. Cached for 5 minutes per symbol and range. */
export function getYahooChart(symbol: string, range: "5d" | "3mo" | "1y" | "2y" = "1y"): Promise<Chart | null> {
  return cached(`yahoo:${symbol}:${range}`, 5 * 60_000, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const response = await fetch(url, { headers: YF_HEADERS });
    if (!response.ok) {
      console.warn(`[Yahoo] ${response.status} for ${symbol}`);
      return null;
    }
    const data: any = await response.json();
    const result = data.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    if (!result || !quote) return null;

    const timestamps: number[] = result.timestamp || [];
    const candles = timestamps
      .map((time, i) => ({
        time,
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i] || 0,
      }))
      .filter((c) => c.open > 0 && c.close > 0);
    if (candles.length === 0) return null;

    const meta = result.meta || {};
    const price = meta.regularMarketPrice || candles[candles.length - 1].close;
    const previousClose =
      candles.length >= 2 ? candles[candles.length - 2].close : meta.chartPreviousClose || price;
    return {
      symbol,
      candles,
      price,
      previousClose,
      currency: meta.currency || "USD",
      asOf: new Date((meta.regularMarketTime || candles[candles.length - 1].time) * 1000).toISOString(),
    };
  }).catch((err) => {
    console.error(`[Yahoo] Exception for ${symbol}:`, err);
    return null;
  });
}

/** Run async jobs with a concurrency cap so we don't trip Yahoo's rate limiting. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// -------------------------------------------------------------------------
// Indicator math
// -------------------------------------------------------------------------

/** Wilder's RSI series; entries before `period` are null. */
export function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = closes.map(() => null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}

/** Simple moving average of the window ending at index `end` (inclusive). */
export function sma(values: number[], period: number, end = values.length - 1): number | null {
  if (end + 1 < period) return null;
  let sum = 0;
  for (let i = end - period + 1; i <= end; i++) sum += values[i];
  return sum / period;
}

export function dailyReturns(closes: number[]): number[] {
  return closes.slice(1).map((c, i) => c / closes[i] - 1);
}

export function correlation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 10) return null;
  const x = a.slice(-n);
  const y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

export function beta(asset: number[], market: number[]): number | null {
  const n = Math.min(asset.length, market.length);
  if (n < 20) return null;
  const x = market.slice(-n);
  const y = asset.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let cov = 0, varx = 0;
  for (let i = 0; i < n; i++) {
    cov += (x[i] - mx) * (y[i] - my);
    varx += (x[i] - mx) ** 2;
  }
  return varx ? cov / varx : null;
}

/** Percentile (0–100) of the last value within the trailing `lookback` values. */
export function percentileOfLast(series: number[], lookback = 252): number | null {
  const window = series.slice(-lookback);
  if (window.length < 20) return null;
  const last = window[window.length - 1];
  return (window.filter((v) => v <= last).length / window.length) * 100;
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
