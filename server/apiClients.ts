import { Ticker } from "../src/types";
import { tickers as mockTickers, generateHistoricalData, mockNews } from "./mockDb";
import { config } from "./config";

/**
 * =========================================================================
 * REAL-WORLD REST API CLIENT SERVICES WITH DEGRADATION FALLBACKS
 * =========================================================================
 * 
 * Provides high-fidelity real data feeds when credentials are set,
 * and maintains continuous system integrity via high-fidelity mock loops when silent.
 */

// -------------------------------------------------------------------------
// 1. Live Quotes: Finnhub API (FINNHUB_API)
// -------------------------------------------------------------------------

/**
 * Fetch latest ticker quotes using Finnhub API.
 * GET https://finnhub.io/api/v1/quote?symbol={symbol}&token={apiKey}
 */
export async function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<Partial<Ticker> | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[Finnhub API] Non-OK status: ${response.status} for ${symbol}`);
      return null;
    }
    const data = await response.json();
    if (data && typeof data.c === "number" && data.c !== 0) {
      return {
        price: data.c,
        chg: data.dp !== null && data.dp !== undefined ? parseFloat(data.dp.toFixed(2)) : 0,
      };
    }
  } catch (err) {
    console.error(`[Finnhub API] Exception requesting quote for ${symbol}:`, err);
  }
  return null;
}

// -------------------------------------------------------------------------
// 2. Company Fundamentals: Financial Modeling Prep (FINANCIAL_MODELING_API)
// -------------------------------------------------------------------------

/**
 * Fetch key company metrics from Financial Modeling Prep if available.
 * GET https://financialmodelingprep.com/api/v3/profile/{symbol}?apikey={apiKey}
 */
export async function fetchFmpProfile(symbol: string, apiKey: string): Promise<Partial<Ticker> | null> {
  try {
    const url = `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[FMP API] Non-200 status: ${response.status} for ${symbol}`);
      return null;
    }
    const data = await response.json();
    if (Array.isArray(data) && data[0]) {
      const p = data[0];
      return {
        pe: p.pe ? parseFloat(parseFloat(p.pe).toFixed(2)) : undefined,
        roe: p.roe ? parseFloat((parseFloat(p.roe) * 100).toFixed(2)) : undefined,
        sector: p.sector || undefined,
        name: p.companyName || undefined,
      };
    }
  } catch (err) {
    console.error(`[FMP API] Exception requesting fundamentals for ${symbol}:`, err);
  }
  return null;
}

// -------------------------------------------------------------------------
// 3. Main Stocks Query Aggregation
// -------------------------------------------------------------------------

/**
 * Normalizes stocks queries. Merges base qualitative structures (mockDb)
 * with real time prices (Finnhub API) and corporate fundamentals (Financial Modeling Prep).
 */
export async function getLiveTickersList(): Promise<Ticker[]> {
  const finnhubKey = config.finnhub.apiKey;
  const fmpKey = config.financialModeling.apiKey;

  if (!finnhubKey && !fmpKey) {
    console.log("[Stocks Service] Serving client assets via standard offline mock quantitative database.");
    return mockTickers;
  }

  console.log(
    `[Stocks Service] Compiling asset list with live API adapters: Finnhub [${finnhubKey ? "Active" : "Mock Pool"}], FMP [${fmpKey ? "Active" : "Mock Pool"}]`
  );

  // Update a slice of primary indices dynamically so as to avoid performance degradation
  const listToPoll = mockTickers.slice(0, 10);
  const remainder = mockTickers.slice(10);

  const pollPromises = listToPoll.map(async (ticker) => {
    let priceUpdate: Partial<Ticker> | null = null;
    let funUpdate: Partial<Ticker> | null = null;

    if (finnhubKey) {
      priceUpdate = await fetchFinnhubQuote(ticker.id, finnhubKey);
    }
    if (fmpKey) {
      funUpdate = await fetchFmpProfile(ticker.id, fmpKey);
    }

    const merged = { ...ticker };

    if (priceUpdate && typeof priceUpdate.price === "number") {
      merged.price = parseFloat(priceUpdate.price.toFixed(2));
      merged.chg = priceUpdate.chg !== undefined ? priceUpdate.chg : ticker.chg;
    }
    if (funUpdate) {
      if (funUpdate.pe !== undefined) merged.pe = funUpdate.pe;
      if (funUpdate.roe !== undefined) merged.roe = funUpdate.roe;
      if (funUpdate.sector !== undefined) merged.sector = funUpdate.sector;
      if (funUpdate.name !== undefined) merged.name = funUpdate.name;
    }

    // Recalculate derivative coordinates dynamically
    if (priceUpdate && typeof priceUpdate.price === "number") {
      const factorObj = priceUpdate.price / ticker.price;
      if (merged.mktCapValue) {
        merged.mktCapValue = Math.round(merged.mktCapValue * factorObj);
        merged.mktCap = merged.mktCapValue >= 1e12 
          ? `${(merged.mktCapValue / 1e12).toFixed(2)}T` 
          : `${(merged.mktCapValue / 1e9).toFixed(1)}B`;
      }
    }

    return merged;
  });

  try {
    const updated = await Promise.all(pollPromises);
    return [...updated, ...remainder];
  } catch (err) {
    console.error("[Stocks Service] Failed polling real-world APIs, falling back to mock database:", err);
    return mockTickers;
  }
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

/**
 * Normalizes live historical technical indicator graphs over real or mock candlesticks.
 */
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Real RSI computation from actual close prices
function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? -c : 0));
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
}

// Real EMA computation
function computeEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

// Yahoo Finance historical OHLCV — split-adjusted, free, no key needed
async function getYahooHistory(symbol: string): Promise<any[] | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
    const response = await fetch(url, { headers: YF_HEADERS });
    if (!response.ok) {
      console.warn(`[Yahoo History] Non-OK ${response.status} for ${symbol}`);
      return null;
    }
    const data: any = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators.quote[0];

    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        open:   parseFloat((quote.open[i]   || 0).toFixed(2)),
        high:   parseFloat((quote.high[i]   || 0).toFixed(2)),
        low:    parseFloat((quote.low[i]    || 0).toFixed(2)),
        close:  parseFloat((quote.close[i]  || 0).toFixed(2)),
        volume: quote.volume[i] || 0,
      }))
      .filter(d => d.open > 0 && d.close > 0);
  } catch (err) {
    console.error(`[Yahoo History] Exception for ${symbol}:`, err);
    return null;
  }
}
export async function getLiveHistory(symbol: string): Promise<any[]> {
  // Step 1: Try Yahoo Finance (split-adjusted, most reliable)
  let rawCandles = await getYahooHistory(symbol);

  // Step 2: Fallback to Alpha Vantage if Yahoo fails
  if (!rawCandles || rawCandles.length === 0) {
    const apiKey = config.alphaVantage.apiKey;
    if (apiKey) {
      console.log(`[History] Yahoo failed, trying AlphaVantage for ${symbol}`);
      rawCandles = await getAlphaVantageHistory(symbol, apiKey);
    }
  }

  // Step 3: Final fallback to mock data
  if (!rawCandles || rawCandles.length === 0) {
    console.log(`[History] All APIs failed for ${symbol}, using mock data`);
    const baseStock = mockTickers.find(t => t.id === symbol.toUpperCase()) || mockTickers[0];
    return generateHistoricalData(baseStock.price, symbol.charCodeAt(0) || 42);
  }

  // Compute REAL RSI and MACD from actual close prices (not Math.sin!)
  const closes = rawCandles.map(c => c.close);
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = computeEMA(macdLine, 9);

  return rawCandles.map((candle, idx) => ({
    ...candle,
    rsi:       idx >= 14 ? computeRSI(closes.slice(0, idx + 1)) : 50,
    macd:      parseFloat((macdLine[idx]   || 0).toFixed(2)),
    signal:    parseFloat((signalLine[idx] || 0).toFixed(2)),
    histogram: parseFloat(((macdLine[idx] || 0) - (signalLine[idx] || 0)).toFixed(2)),
  }));
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
// 6. Macroeconomic Indicators Feed: FRED API (FRED_API)
// -------------------------------------------------------------------------

/**
 * Fetch macroeconomic indicators using Federal Reserve Economic Data (FRED).
 * Default series of interest: GDPC1 (Real GDP), CPIAUCSL (CPI/Inflation), FEDFUNDS (Interest rate), UNRATE (Unemployment)
 */
export async function fetchFredSeries(seriesId: string, apiKey: string): Promise<any[] | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=5&sort_order=desc`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[FRED API] Non-200 status: ${response.status} for series ${seriesId}`);
      return null;
    }
    const data = await response.json();
    if (data && Array.isArray(data.observations)) {
      return data.observations;
    }
  } catch (err) {
    console.error(`[FRED API] Exception reading series ${seriesId}:`, err);
  }
  return null;
}

/**
 * Composite macro indicators endpoint handler helper
 */
export async function getMacroIndicators(): Promise<any> {
  const key = config.fred.apiKey;
  if (!key) {
    console.log("[FRED Service] Using mock macroeconomic indicators (no FRED_API key provided)");
    return {
      interestRate: { series: "FEDFUNDS", value: 5.33, date: "Latest", unit: "%" },
      inflationRate: { series: "CPIAUCSL", value: 3.4, date: "Latest", unit: "% YoY" },
      gdpGrowth: { series: "GDPC1", value: 2.1, date: "Latest", unit: "%" },
      unemployment: { series: "UNRATE", value: 3.9, date: "Latest", unit: "%" }
    };
  }

  try {
    console.log("[FRED Service] Querying macroeconomic indicators using Real FRED API adapter");
    const [fedfunds, inflation, gdp, unrate] = await Promise.all([
      fetchFredSeries("FEDFUNDS", key),
      fetchFredSeries("CPIAUCSL", key),
      fetchFredSeries("GDPC1", key),
      fetchFredSeries("UNRATE", key),
    ]);

    const getValue = (obs: any[] | null, def: number): number => {
      if (obs && obs[0] && obs[0].value) {
        const val = parseFloat(obs[0].value);
        return isNaN(val) ? def : val;
      }
      return def;
    };

    return {
      interestRate: { series: "FEDFUNDS", value: getValue(fedfunds, 5.33), date: fedfunds?.[0]?.date || "Latest", unit: "%" },
      inflationRate: { series: "CPIAUCSL", value: getValue(inflation, 3.4), date: inflation?.[0]?.date || "Latest", unit: "% YoY" },
      gdpGrowth: { series: "GDPC1", value: getValue(gdp, 2.1), date: gdp?.[0]?.date || "Latest", unit: "%" },
      unemployment: { series: "UNRATE", value: getValue(unrate, 3.9), date: unrate?.[0]?.date || "Latest", unit: "%" }
    };
  } catch (err) {
    console.error("[FRED Service] Exception compiling indices:", err);
    return {
      interestRate: { series: "FEDFUNDS", value: 5.33, date: "Fallback", unit: "%" },
      inflationRate: { series: "CPIAUCSL", value: 3.4, date: "Fallback", unit: "% YoY" },
      gdpGrowth: { series: "GDPC1", value: 2.1, date: "Fallback", unit: "%" },
      unemployment: { series: "UNRATE", value: 3.9, date: "Fallback", unit: "%" }
    };
  }
}

// -------------------------------------------------------------------------
// 7. Fear and Greed Index: Alternative.me API (ALTERNATE.ME_API)
// -------------------------------------------------------------------------

/**
 * Fetch current Fear and Greed Index dynamically from alternative.me.
 */
export async function getFearAndGreedIndex(): Promise<{ value: number; classification: string }> {
  try {
    console.log("[Alternative.me API] Triggering live call to fetch Fear & Greed index");
    const response = await fetch("https://api.alternative.me/fng/?limit=1");
    if (response.ok) {
      const data = await response.json();
      if (data && data.data && data.data[0]) {
        const metric = data.data[0];
        return {
          value: parseInt(metric.value) || 72,
          classification: (metric.value_classification || "Greed").toUpperCase(),
        };
      }
    }
  } catch (err) {
    console.error("[Alternative.me API] Failed calling index:", err);
  }
  // Safe default
  return { value: 72, classification: "GREED" };
}
export interface GlobalIndex {
  symbol: string;
  label: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
}
// Agar config.coinGecko nahi hai toh ye use karo:
const apiKey = process.env.COINGECKO_API || '';
// REPLACE your entire getLiveGlobalIndices function with this

export async function getLiveGlobalIndices(): Promise<GlobalIndex[]> {
  const fallback: GlobalIndex[] = [
    { symbol: '^NSEI',   label: 'Nifty 50',   price: 24500, change: 120,   changePct: 0.49,  currency: '₹' },
    { symbol: '^GSPC',   label: 'S&P 500',    price: 5450,  change: -12,   changePct: -0.22, currency: '$' },
    { symbol: '^NDX',    label: 'Nasdaq 100', price: 19200, change: 85,    changePct: 0.44,  currency: '$' },
    { symbol: 'GC=F',    label: 'Gold Spot',  price: 2330,  change: 8,     changePct: 0.34,  currency: '$' },
    { symbol: 'CL=F',    label: 'Crude WTI',  price: 78,    change: -0.5,  changePct: -0.64, currency: '$' },
    { symbol: 'BTC-USD', label: 'BTC/USD',    price: 67000, change: 1200,  changePct: 1.82,  currency: '$' },
  ];

  // ── Helper: Yahoo Finance v8/chart (works without auth, unlike v7/quote) ──
  async function fetchYahooV8(rawSymbol: string): Promise<{ price: number; change: number; changePct: number } | null> {
    try {
      // URL-encode special chars: ^ → %5E, = → %3D
      const encoded = encodeURIComponent(rawSymbol);
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=2d`;
      const response = await fetch(url, { headers: YF_HEADERS });
      if (!response.ok) {
        console.warn(`[Yahoo v8] ${response.status} for ${rawSymbol}`);
        return null;
      }
      const data: any = await response.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) return null;

      const price      = parseFloat((meta.regularMarketPrice).toFixed(2));
      const prevClose  = meta.chartPreviousClose || meta.previousClose || price;
      const change     = parseFloat((price - prevClose).toFixed(2));
      const changePct  = parseFloat(((change / prevClose) * 100).toFixed(2));
      return { price, change, changePct };
    } catch (err) {
      console.error(`[Yahoo v8] Exception for ${rawSymbol}:`, err);
      return null;
    }
  }

  // ── Helper: CoinGecko for BTC (reliable, they have the key) ──
  async function fetchBTCCoinGecko(): Promise<{ price: number; change: number; changePct: number } | null> {
    try {
      const apiKey = process.env.COINGECKO_API || "";
      const headers: Record<string, string> = { ...YF_HEADERS };
      if (apiKey) headers['x-cg-demo-api-key'] = apiKey;

      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';
      const response = await fetch(url, { headers });
      if (!response.ok) return null;

      const data: any = await response.json();
      const btc = data.bitcoin;
      if (!btc?.usd) return null;

      const price     = parseFloat((btc.usd).toFixed(2));
      const changePct = parseFloat((btc.usd_24h_change || 0).toFixed(2));
      const change    = parseFloat((price * changePct / 100).toFixed(2));
      return { price, change, changePct };
    } catch (err) {
      console.error('[CoinGecko] BTC fetch failed:', err);
      return null;
    }
  }

  // ── Fetch all in parallel ──
  const [nifty, sp500, nasdaq, gold, crude, btc] = await Promise.all([
    fetchYahooV8('^NSEI'),
    fetchYahooV8('^GSPC'),
    fetchYahooV8('^NDX'),
    fetchYahooV8('GC=F'),
    fetchYahooV8('CL=F'),
    fetchBTCCoinGecko(),
  ]);

  const results = [nifty, sp500, nasdaq, gold, crude, btc];

  return fallback.map((fb, i) => {
    const live = results[i];
    if (!live) return fb; // use fallback for failed calls
    return { ...fb, price: live.price, change: live.change, changePct: live.changePct };
  });
}