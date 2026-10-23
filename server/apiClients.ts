import { Ticker } from "../src/types";
import { sampleTickers, generateHistoricalData, mockNews } from "./mockDb";
import { config } from "./config";
import { UNIVERSE, BENCHMARK, CURRENCY, UniverseEntry, findEntry } from "./universe";
import {
  cached,
  getYahooChart,
  mapLimit,
  rsiSeries,
  emaSeries,
  sma,
  dailyReturns,
  beta as betaOf,
  round,
} from "./marketData";

/**
 * =========================================================================
 * REAL-WORLD REST API CLIENTS
 * =========================================================================
 *
 * Every value returned here says where it came from. When a live source fails
 * we fall back to sample data, but the result is flagged (source: "mock" or
 * fundamentalsSource: "sample") so the UI can label it instead of passing it off as live.
 */

// -------------------------------------------------------------------------
// 1. Live US quotes: Finnhub API (FINNHUB_API)
// -------------------------------------------------------------------------

/**
 * GET https://finnhub.io/api/v1/quote?symbol={symbol}&token={apiKey}
 * Free tier covers US stocks only. Cached for 30 seconds.
 */
export function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<{ price: number; chg: number } | null> {
  return cached(`finnhub:${symbol}`, 30_000, async () => {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`);
    if (!response.ok) {
      console.warn(`[Finnhub API] Non-OK status: ${response.status} for ${symbol}`);
      return null;
    }
    const data = await response.json();
    if (data && typeof data.c === "number" && data.c !== 0) {
      return { price: data.c, chg: typeof data.dp === "number" ? round(data.dp) : 0 };
    }
    return null;
  }).catch((err) => {
    console.error(`[Finnhub API] Exception requesting quote for ${symbol}:`, err);
    return null;
  });
}

// -------------------------------------------------------------------------
// 2. Company fundamentals: Financial Modeling Prep (FINANCIAL_MODELING_API)
// -------------------------------------------------------------------------

interface Fundamentals {
  pe: number | null;
  roe: number | null;
  mktCapValue: number | null;
  sector?: string;
  name?: string;
}

async function fmpGet(path: string, symbol: string, apiKey: string): Promise<any | null> {
  const response = await fetch(`https://financialmodelingprep.com/stable/${path}?symbol=${symbol}&apikey=${apiKey}`);
  if (!response.ok) {
    console.warn(`[FMP API] ${response.status} on ${path} for ${symbol}`);
    return null;
  }
  const data = await response.json();
  return Array.isArray(data) ? data[0] ?? null : null;
}

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

/**
 * FMP "stable" endpoints (the old /api/v3 paths are legacy and refused for newer keys).
 * The free plan allows 250 calls a day and covers US exchanges only, so results are
 * cached for 12 hours: 16 US tickers x 3 calls x 2 refreshes ≈ 96 calls a day.
 */
export function fetchFmpFundamentals(symbol: string, apiKey: string): Promise<Fundamentals | null> {
  return cached(`fmp:${symbol}`, 12 * 3600_000, async () => {
    const [profile, ratios, metrics] = await Promise.all([
      fmpGet("profile", symbol, apiKey),
      fmpGet("ratios-ttm", symbol, apiKey),
      fmpGet("key-metrics-ttm", symbol, apiKey),
    ]);
    if (!profile && !ratios && !metrics) return null;
    const roe = num(metrics?.returnOnEquityTTM) ?? num(ratios?.returnOnEquityTTM);
    return {
      pe: num(ratios?.priceToEarningsRatioTTM) ?? num(ratios?.peRatioTTM),
      roe: roe === null ? null : round(roe * 100, 1),
      mktCapValue: num(profile?.marketCap) ?? num(profile?.mktCap),
      sector: profile?.sector || undefined,
      name: profile?.companyName || undefined,
    };
  }).catch((err) => {
    console.error(`[FMP API] Exception requesting fundamentals for ${symbol}:`, err);
    return null;
  });
}

// -------------------------------------------------------------------------
// 3. Stocks list built from the universe
// -------------------------------------------------------------------------

export function formatMktCap(value: number | null, currency: string): string {
  if (value === null) return "—";
  if (value >= 1e12) return `${currency}${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${currency}${(value / 1e9).toFixed(1)}B`;
  return `${currency}${(value / 1e6).toFixed(0)}M`;
}

async function buildTicker(entry: UniverseEntry, benchmarkReturns: number[] | null): Promise<Ticker | null> {
  const chart = await getYahooChart(entry.symbol, "2y");
  const sample = sampleTickers.find((t) => t.id === entry.id);
  const currency = CURRENCY[entry.market];

  // Indicators from real daily closes when Yahoo answers, otherwise sample values.
  let price: number, chg: number, rsi: number, macdCross: boolean, volSurge: number, beta: number;
  let source: Ticker["source"];
  let asOf: string;

  if (chart && chart.candles.length >= 30) {
    const closes = chart.candles.map((c) => c.close);
    const volumes = chart.candles.map((c) => c.volume);
    const ema26 = emaSeries(closes, 26);
    const macd = emaSeries(closes, 12).map((v, i) => v - ema26[i]);
    const signal = emaSeries(macd, 9);
    const n = closes.length - 1;
    const avgVol = sma(volumes, 20, n - 1);

    price = chart.price;
    chg = round(((chart.price - chart.previousClose) / chart.previousClose) * 100);
    rsi = round(rsiSeries(closes).at(-1) ?? 50, 1);
    // Bullish cross within the last 5 sessions
    macdCross = Array.from({ length: 5 }, (_, k) => n - k).some(
      (i) => i > 0 && macd[i] > signal[i] && macd[i - 1] <= signal[i - 1]
    );
    volSurge = avgVol ? round(volumes[n] / avgVol, 2) : 1;
    beta = round((benchmarkReturns && betaOf(dailyReturns(closes), benchmarkReturns)) ?? sample?.beta ?? 1, 2);
    source = "yahoo";
    asOf = chart.asOf;
  } else if (sample) {
    ({ price, chg, rsi, macdCross, volSurge, beta } = sample);
    source = "mock";
    asOf = new Date().toISOString();
  } else {
    return null; // no live data and no sample: leave it out rather than invent numbers
  }

  // Real-time US price from Finnhub overrides Yahoo's quote when a key is set.
  if (entry.market === "US" && config.finnhub.apiKey) {
    const quote = await fetchFinnhubQuote(entry.symbol, config.finnhub.apiKey);
    if (quote) {
      price = quote.price;
      chg = quote.chg;
      source = "finnhub";
      asOf = new Date().toISOString();
    }
  }

  // Fundamentals: FMP for US when keyed; otherwise sample values, clearly flagged.
  let fundamentals: Fundamentals | null = null;
  let fundamentalsSource: Ticker["fundamentalsSource"] = "none";
  if (entry.market === "US" && config.financialModeling.apiKey) {
    fundamentals = await fetchFmpFundamentals(entry.symbol, config.financialModeling.apiKey);
    if (fundamentals) fundamentalsSource = "fmp";
  }
  if (!fundamentals && sample) {
    fundamentals = {
      pe: sample.pe,
      roe: sample.roe,
      // Sample caps are in USD; only rescale them for US listings.
      mktCapValue: entry.market === "US" ? Math.round(sample.mktCapValue * (price / sample.price)) : null,
    };
    fundamentalsSource = "sample";
  }

  return {
    id: entry.id,
    name: fundamentals?.name || entry.name,
    sector: fundamentals?.sector || entry.sector,
    price: round(price),
    chg,
    volSurge,
    rsi,
    beta,
    macdCross,
    pe: fundamentals?.pe != null ? round(fundamentals.pe, 1) : null,
    roe: fundamentals?.roe ?? null,
    mktCapValue: fundamentals?.mktCapValue ?? null,
    mktCap: formatMktCap(fundamentals?.mktCapValue ?? null, currency),
    market: entry.market,
    currency,
    source,
    delayed: source !== "finnhub",
    fundamentalsSource,
    asOf,
  };
}

/** All tickers in the universe. Cached for 60 seconds. */
export function getLiveTickersList(): Promise<Ticker[]> {
  return cached("tickers", 60_000, async () => {
    const benchmarks: Record<string, number[] | null> = {};
    for (const market of ["US", "IN"] as const) {
      const chart = await getYahooChart(BENCHMARK[market], "2y");
      benchmarks[market] = chart ? dailyReturns(chart.candles.map((c) => c.close)) : null;
    }
    const list = await mapLimit(UNIVERSE, 4, (entry) => buildTicker(entry, benchmarks[entry.market]));
    const tickers = list.filter((t): t is Ticker => t !== null);
    const counts = tickers.reduce<Record<string, number>>((acc, t) => ((acc[t.source] = (acc[t.source] || 0) + 1), acc), {});
    console.log(`[Stocks Service] ${tickers.length} tickers built. Sources: ${JSON.stringify(counts)}`);
    return tickers;
  });
}

// -------------------------------------------------------------------------
// 4. Historical Candles: AlphaVantage Series (ALPHA_VANTAGE_A)
// -------------------------------------------------------------------------

/**
 * Custom historical series loader using AlphaVantage API.
 * GET https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&apikey={apiKey}
 */
export async function getAlphaVantageHistory(symbol: string, apiKey: string): Promise<any[] | null> {
  try {
    // Avoid rate limits by fetching daily compact series
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const timeSeries = data["Time Series (Daily)"];
    if (timeSeries) {
      const dates = Object.keys(timeSeries).slice(0, 30).reverse();
      return dates.map((date) => {
        const item = timeSeries[date];
        return {
          date: date.substring(5), // MM-DD
          open: parseFloat(item["1. open"]),
          high: parseFloat(item["2. high"]),
          low: parseFloat(item["3. low"]),
          close: parseFloat(item["4. close"]),
          volume: parseInt(item["5. volume"]) || 1000000,
        };
      });
    }
  } catch (err) {
    console.error(`[AlphaVantage API] Exception fetching history for ${symbol}:`, err);
  }
  return null;
}

// -------------------------------------------------------------------------
// 4b. History used by the charts: Yahoo first, Alpha Vantage second, sample last
// -------------------------------------------------------------------------

export interface HistoryResult {
  history: any[];
  source: "yahoo" | "alphavantage" | "mock";
}

export async function getLiveHistory(idOrSymbol: string): Promise<HistoryResult> {
  const entry = findEntry(idOrSymbol);
  const symbol = entry?.symbol || idOrSymbol.toUpperCase();

  let source: HistoryResult["source"] = "yahoo";
  const chart = await getYahooChart(symbol, "3mo");
  let rawCandles: any[] | null = chart
    ? chart.candles.map((c) => ({
        date: new Date(c.time * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        open: round(c.open),
        high: round(c.high),
        low: round(c.low),
        close: round(c.close),
        volume: c.volume,
      }))
    : null;

  // Alpha Vantage only knows US symbols on the free plan.
  if ((!rawCandles || rawCandles.length === 0) && config.alphaVantage.apiKey && entry?.market !== "IN") {
    console.log(`[History] Yahoo failed, trying AlphaVantage for ${symbol}`);
    rawCandles = await getAlphaVantageHistory(symbol, config.alphaVantage.apiKey);
    source = "alphavantage";
  }

  if (!rawCandles || rawCandles.length === 0) {
    console.log(`[History] All APIs failed for ${symbol}, using sample data`);
    const base = sampleTickers.find((t) => t.id === entry?.id) || sampleTickers[0];
    return { history: generateHistoricalData(base.price, symbol.charCodeAt(0) || 42), source: "mock" };
  }

  const closes = rawCandles.map((c) => c.close);
  const rsi = rsiSeries(closes);
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = emaSeries(macdLine, 9);

  return {
    source,
    history: rawCandles.map((candle, idx) => ({
      ...candle,
      rsi: rsi[idx] === null ? 50 : round(rsi[idx]!, 1),
      macd: round(macdLine[idx] || 0),
      signal: round(signalLine[idx] || 0),
      histogram: round((macdLine[idx] || 0) - (signalLine[idx] || 0)),
    })),
  };
}

// -------------------------------------------------------------------------
// 5. News Intelligence feed: NewsData.io (NEWS_IO_API)
// -------------------------------------------------------------------------

/**
 * Fetch latest corporate market press announcements from NewsData.io.
 * GET https://newsdata.io/api/1/news?apikey={apiKey}&q=stocks+OR+finance+OR+economy&language=en
 */
export async function fetchNewsIoFeed(apiKey: string): Promise<any[] | null> {
  try {
    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=stocks+OR+finance+OR+economy&language=en`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[NewsData API] Non-OK status: ${response.status}`);
      return null;
    }
    const data = await response.json();
    if (data && Array.isArray(data.results) && data.results.length > 0) {
      return data.results.slice(0, 7).map((art: any, idx: number) => {
        const rawDate = art.pubDate ? new Date(art.pubDate) : new Date();
        const timeStr = rawDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
          id: `newsio-${idx}`,
          title: art.title || "Market event observed.",
          category: art.source_id ? art.source_id.toUpperCase() : "MEDIA FEED",
          timestamp: `${timeStr} (${rawDate.getMonth() + 1}/${rawDate.getDate()})`,
          influence: idx % 2 === 0 ? "HIGH" : "STABLE",
        };
      });
    }
  } catch (err) {
    console.error("[NewsData API] Exception fetching headlines stream:", err);
  }
  return null;
}

/**
 * Gathers news. Falling back elegantly if unavailable.
 */
export async function getLiveNewsFeed(): Promise<any[]> {
  const apiKey = config.newsIo.apiKey;

  if (!apiKey) {
    console.log("[News Service] Serving corporate stream via standard offline mock quantitative media table.");
    return mockNews;
  }

  console.log("[News Service] Gathering live stories from NewsData.io API");
  const actualItems = await fetchNewsIoFeed(apiKey);
  if (actualItems && actualItems.length > 0) {
    return actualItems;
  }

  console.log("[News Service] NewsData call returned no headlines. Serving mock fallback database.");
  return mockNews;
}


// -------------------------------------------------------------------------
// 6. Macroeconomic indicators: FRED API (FRED_API)
// -------------------------------------------------------------------------

/**
 * GET https://api.stlouisfed.org/fred/series/observations
 * `units=pc1` asks FRED for the percent change from a year ago, which is what
 * the dashboard labels CPI and GDP as. Without it FRED returns raw index levels
 * (CPI ≈ 320, real GDP ≈ 23,000 billion dollars).
 */
export async function fetchFredSeries(seriesId: string, apiKey: string, units = "lin", limit = 5): Promise<any[] | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&units=${units}&limit=${limit}&sort_order=desc`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[FRED API] Non-200 status: ${response.status} for series ${seriesId}`);
      return null;
    }
    const data = await response.json();
    if (data && Array.isArray(data.observations)) {
      // FRED marks missing observations with "."
      return data.observations.filter((o: any) => o.value !== ".");
    }
  } catch (err) {
    console.error(`[FRED API] Exception reading series ${seriesId}:`, err);
  }
  return null;
}

export interface MacroIndicator {
  series: string;
  label: string;
  value: number | null;
  date: string | null;
  unit: string;
}

export interface MacroResponse {
  available: boolean;
  reason?: string;
  indicators: MacroIndicator[];
}

const MACRO_SERIES = [
  { id: "FEDFUNDS", label: "Fed funds rate", units: "lin", unit: "%" },
  { id: "CPIAUCSL", label: "CPI inflation", units: "pc1", unit: "% YoY" },
  { id: "GDPC1", label: "Real GDP growth", units: "pc1", unit: "% YoY" },
  { id: "UNRATE", label: "Unemployment", units: "lin", unit: "%" },
];

/** Cached for 6 hours; these series update monthly or quarterly. */
export function getMacroIndicators(): Promise<MacroResponse> {
  const key = config.fred.apiKey;
  if (!key) {
    return Promise.resolve({ available: false, reason: "Add FRED_API to .env to load macro data.", indicators: [] });
  }
  return cached("fred:macro", 6 * 3600_000, async () => {
    const results = await Promise.all(MACRO_SERIES.map((s) => fetchFredSeries(s.id, key, s.units)));
    const indicators = MACRO_SERIES.map((s, i) => {
      const obs = results[i]?.[0];
      const value = obs ? parseFloat(obs.value) : NaN;
      return {
        series: s.id,
        label: s.label,
        value: isNaN(value) ? null : round(value, 2),
        date: obs?.date ?? null,
        unit: s.unit,
      };
    });
    const available = indicators.some((x) => x.value !== null);
    return { available, reason: available ? undefined : "FRED did not return data.", indicators };
  });
}

// -------------------------------------------------------------------------
// 7. Crypto Fear & Greed: Alternative.me
// -------------------------------------------------------------------------

/**
 * This is the crypto (Bitcoin) sentiment index, not a stock-market one.
 * The stock index lives in fearGreed.ts. Returns null on failure.
 */
export function getCryptoFearGreed(): Promise<{ value: number; classification: string } | null> {
  return cached("fng:crypto", 30 * 60_000, async () => {
    const response = await fetch("https://api.alternative.me/fng/?limit=1");
    if (!response.ok) return null;
    const metric = (await response.json())?.data?.[0];
    const value = parseInt(metric?.value);
    return isNaN(value) ? null : { value, classification: metric.value_classification || "" };
  }).catch((err) => {
    console.error("[Alternative.me API] Failed calling index:", err);
    return null;
  });
}

// -------------------------------------------------------------------------
// 8. Global index strip
// -------------------------------------------------------------------------

export interface GlobalIndex {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string;
  live: boolean;
}

const GLOBAL_INDICES = [
  { symbol: "^NSEI", label: "Nifty 50", currency: "₹" },
  { symbol: "^NSEBANK", label: "Nifty Bank", currency: "₹" },
  { symbol: "^GSPC", label: "S&P 500", currency: "$" },
  { symbol: "^NDX", label: "Nasdaq 100", currency: "$" },
  { symbol: "GC=F", label: "Gold", currency: "$" },
  { symbol: "CL=F", label: "Crude WTI", currency: "$" },
  { symbol: "BTC-USD", label: "BTC/USD", currency: "$" },
];

/** Index levels from Yahoo. Entries that fail come back with live: false and null values. */
export async function getLiveGlobalIndices(): Promise<GlobalIndex[]> {
  return Promise.all(
    GLOBAL_INDICES.map(async (idx) => {
      const chart = await getYahooChart(idx.symbol, "5d");
      if (!chart) return { ...idx, price: null, change: null, changePct: null, live: false };
      const change = chart.price - chart.previousClose;
      return {
        ...idx,
        price: round(chart.price),
        change: round(change),
        changePct: round((change / chart.previousClose) * 100),
        live: true,
      };
    })
  );
}
