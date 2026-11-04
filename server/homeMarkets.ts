import { Router, Request, Response } from "express";
import { getYahooChart, mapLimit, round, cached, sma, emaSeries, rsiSeries, Candle, Chart } from "./marketData";
import { UNIVERSE, findEntry, CURRENCY } from "./universe";
import { config } from "./config";
import { mockNews } from "./mockDb";

/**
 * Data for the expanded homepage: index cards, global futures, forex, the
 * instrument dossier (the dense side widget), the news feed and the IPO calendar.
 *
 * Prices come from the Yahoo daily chart endpoint (delayed, cached 5 minutes).
 * News and US IPOs use Finnhub when FINNHUB_API is set; Indian IPOs are read
 * from NSE's public site on a best-effort basis. Nothing is invented: when a
 * source is missing the response says so and the UI shows that.
 */
const router = Router();

// -------------------------------------------------------------------------
// Instrument catalogue
// -------------------------------------------------------------------------

type Kind = "index" | "future" | "fx" | "crypto" | "stock";
type Region = "US" | "IN" | "GLOBAL";

interface Instrument {
  symbol: string;
  name: string;
  short: string;
  kind: Kind;
  region: Region;
  currency: string;
  unit?: string;
  /** Stocks whose earnings tend to move with this instrument. Shown, never traded on. */
  linked?: string[];
  exchange?: string;
}

export const INDEX_CARDS: Instrument[] = [
  { symbol: "^GSPC", name: "S&P 500", short: "SPX", kind: "index", region: "US", currency: "$", exchange: "NYSE · Nasdaq" },
  { symbol: "^IXIC", name: "Nasdaq", short: "IXIC", kind: "index", region: "US", currency: "$", exchange: "Nasdaq" },
  { symbol: "^DJI", name: "Dow Jones 30", short: "DJI", kind: "index", region: "US", currency: "$", exchange: "NYSE" },
  { symbol: "^NSEI", name: "Nifty 50", short: "NIFTY", kind: "index", region: "IN", currency: "₹", exchange: "NSE" },
  { symbol: "^BSESN", name: "Sensex", short: "SENSEX", kind: "index", region: "IN", currency: "₹", exchange: "BSE" },
  { symbol: "^NSEBANK", name: "Nifty Bank", short: "BANKNIFTY", kind: "index", region: "IN", currency: "₹", exchange: "NSE" },
];

export const FUTURES: Instrument[] = [
  { symbol: "CL=F", name: "WTI crude oil", short: "CL", kind: "future", region: "GLOBAL", currency: "$", unit: "per barrel", exchange: "NYMEX", linked: ["XOM", "CVX", "RELIANCE", "ONGC"] },
  { symbol: "NG=F", name: "Natural gas", short: "NG", kind: "future", region: "GLOBAL", currency: "$", unit: "per MMBtu", exchange: "NYMEX", linked: ["EQT", "GAIL", "IGL", "PETRONET"] },
  { symbol: "GC=F", name: "Gold", short: "GC", kind: "future", region: "GLOBAL", currency: "$", unit: "per troy oz", exchange: "COMEX", linked: ["NEM", "TITAN", "MUTHOOTFIN"] },
  { symbol: "HG=F", name: "Copper", short: "HG", kind: "future", region: "GLOBAL", currency: "$", unit: "per pound", exchange: "COMEX", linked: ["FCX", "HINDALCO", "VEDL"] },
  { symbol: "BZ=F", name: "Brent crude", short: "BZ", kind: "future", region: "GLOBAL", currency: "$", unit: "per barrel", exchange: "ICE", linked: ["BPCL", "IOC"] },
  { symbol: "SI=F", name: "Silver", short: "SI", kind: "future", region: "GLOBAL", currency: "$", unit: "per troy oz", exchange: "COMEX", linked: ["HINDZINC"] },
];

export const FOREX: Instrument[] = [
  { symbol: "USDINR=X", name: "US dollar / Indian rupee", short: "USD/INR", kind: "fx", region: "GLOBAL", currency: "₹" },
  { symbol: "EURUSD=X", name: "Euro / US dollar", short: "EUR/USD", kind: "fx", region: "GLOBAL", currency: "$" },
  { symbol: "GBPUSD=X", name: "British pound / US dollar", short: "GBP/USD", kind: "fx", region: "GLOBAL", currency: "$" },
  { symbol: "USDJPY=X", name: "US dollar / Japanese yen", short: "USD/JPY", kind: "fx", region: "GLOBAL", currency: "¥" },
  { symbol: "EURINR=X", name: "Euro / Indian rupee", short: "EUR/INR", kind: "fx", region: "GLOBAL", currency: "₹" },
  { symbol: "GBPINR=X", name: "British pound / Indian rupee", short: "GBP/INR", kind: "fx", region: "GLOBAL", currency: "₹" },
  { symbol: "DX-Y.NYB", name: "US Dollar Index", short: "DXY", kind: "fx", region: "GLOBAL", currency: "" },
];

const CRYPTO: Instrument[] = [
  { symbol: "BTC-USD", name: "Bitcoin", short: "BTC", kind: "crypto", region: "GLOBAL", currency: "$" },
  { symbol: "ETH-USD", name: "Ethereum", short: "ETH", kind: "crypto", region: "GLOBAL", currency: "$" },
  { symbol: "SOL-USD", name: "Solana", short: "SOL", kind: "crypto", region: "GLOBAL", currency: "$" },
  { symbol: "BNB-USD", name: "BNB", short: "BNB", kind: "crypto", region: "GLOBAL", currency: "$" },
  { symbol: "XRP-USD", name: "XRP", short: "XRP", kind: "crypto", region: "GLOBAL", currency: "$" },
  { symbol: "DOGE-USD", name: "Dogecoin", short: "DOGE", kind: "crypto", region: "GLOBAL", currency: "$" },
  { symbol: "ADA-USD", name: "Cardano", short: "ADA", kind: "crypto", region: "GLOBAL", currency: "$" },
  { symbol: "AVAX-USD", name: "Avalanche", short: "AVAX", kind: "crypto", region: "GLOBAL", currency: "$" },
];

const EXTRA_INDICES: Instrument[] = [
  { symbol: "^NDX", name: "Nasdaq 100", short: "NDX", kind: "index", region: "US", currency: "$", exchange: "Nasdaq" },
  { symbol: "^N225", name: "Nikkei 225", short: "N225", kind: "index", region: "GLOBAL", currency: "¥", exchange: "TSE" },
  { symbol: "^FTSE", name: "FTSE 100", short: "UKX", kind: "index", region: "GLOBAL", currency: "£", exchange: "LSE" },
  { symbol: "^GDAXI", name: "DAX", short: "DAX", kind: "index", region: "GLOBAL", currency: "€", exchange: "Xetra" },
  { symbol: "^HSI", name: "Hang Seng", short: "HSI", kind: "index", region: "GLOBAL", currency: "HK$", exchange: "HKEX" },
];

const CATALOGUE: Instrument[] = [...INDEX_CARDS, ...EXTRA_INDICES, ...FUTURES, ...FOREX, ...CRYPTO];

function resolveInstrument(raw: string): Instrument | null {
  const key = raw.trim().toUpperCase();
  const hit = CATALOGUE.find((i) => i.symbol.toUpperCase() === key || i.short.toUpperCase() === key);
  if (hit) return hit;
  const stock = findEntry(key);
  if (!stock) return null;
  return {
    symbol: stock.symbol,
    name: stock.name,
    short: stock.id,
    kind: "stock",
    region: stock.market,
    currency: CURRENCY[stock.market],
    exchange: stock.market === "US" ? "US" : "NSE",
  };
}

// -------------------------------------------------------------------------
// Quote helpers
// -------------------------------------------------------------------------

const priceDigits = (p: number) => (p < 2 ? 4 : p < 20 ? 3 : 2);

function quoteFrom(inst: Instrument, chart: Chart, sparkLen = 30) {
  const cs = chart.candles;
  const last = cs[cs.length - 1];
  const year = cs.slice(-252);
  const d = priceDigits(chart.price);
  const change = chart.price - chart.previousClose;
  return {
    symbol: inst.symbol,
    short: inst.short,
    name: inst.name,
    kind: inst.kind,
    region: inst.region,
    currency: inst.currency,
    unit: inst.unit,
    exchange: inst.exchange,
    linked: inst.linked,
    available: true as const,
    asOf: chart.asOf,
    price: round(chart.price, d),
    change: round(change, d),
    changePct: round((change / chart.previousClose) * 100),
    dayLow: round(last.low, d),
    dayHigh: round(last.high, d),
    low52: round(Math.min(...year.map((c) => c.low)), d),
    high52: round(Math.max(...year.map((c) => c.high)), d),
    volume: last.volume || null,
    spark: cs.slice(-sparkLen).map((c) => round(c.close, d)),
    sparkTimes: cs.slice(-sparkLen).map((c) => c.time),
  };
}

async function quotes(list: Instrument[], sparkLen = 30) {
  return mapLimit(list, 3, async (inst) => {
    const chart = await getYahooChart(inst.symbol, "1y");
    if (!chart || chart.candles.length < 2) {
      return { symbol: inst.symbol, short: inst.short, name: inst.name, kind: inst.kind, region: inst.region, currency: inst.currency, unit: inst.unit, exchange: inst.exchange, linked: inst.linked, available: false as const };
    }
    return quoteFrom(inst, chart, sparkLen);
  });
}

// GET /api/index-cards: the six headline indices with a 30-session trend.
router.get("/api/index-cards", async (_req: Request, res: Response) => {
  res.json({ indices: await cached("home:index-cards", 60_000, () => quotes(INDEX_CARDS, 30)) });
});

// GET /api/futures: front-month energy and metals futures.
router.get("/api/futures", async (_req: Request, res: Response) => {
  res.json({ futures: await cached("home:futures", 60_000, () => quotes(FUTURES, 30)) });
});

// GET /api/forex: INR crosses, majors and the dollar index, 3 months of closes each.
router.get("/api/forex", async (_req: Request, res: Response) => {
  res.json({ pairs: await cached("home:forex", 60_000, () => quotes(FOREX, 66)) });
});

// -------------------------------------------------------------------------
// Instrument dossier
// -------------------------------------------------------------------------

const PERF_WINDOWS: [string, number | "ytd"][] = [
  ["1W", 5],
  ["1M", 21],
  ["3M", 63],
  ["6M", 126],
  ["YTD", "ytd"],
  ["1Y", 252],
];

function pctSince(cs: Candle[], back: number | "ytd"): number | null {
  const last = cs[cs.length - 1].close;
  let base: number | undefined;
  if (back === "ytd") {
    const jan1 = Date.UTC(new Date(cs[cs.length - 1].time * 1000).getUTCFullYear(), 0, 1) / 1000;
    const prior = cs.filter((c) => c.time < jan1);
    base = prior.length ? prior[prior.length - 1].close : cs.find((c) => c.time >= jan1)?.close;
  } else if (cs.length > back) {
    base = cs[cs.length - 1 - back].close;
  }
  return base ? round((last / base - 1) * 100) : null;
}

/** Each calendar year's path as % from the prior year's last close, sampled by day of year. */
function seasonals(cs: Candle[]) {
  const byYear = new Map<number, Candle[]>();
  for (const c of cs) {
    const y = new Date(c.time * 1000).getUTCFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(c);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a).slice(0, 3);
  return years
    .map((y) => {
      const rows = byYear.get(y)!;
      const prev = byYear.get(y - 1);
      const base = prev ? prev[prev.length - 1].close : rows[0].open;
      return {
        year: y,
        points: rows.map((c) => {
          const d = new Date(c.time * 1000);
          const doy = Math.floor((Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(y, 0, 1)) / 86_400_000);
          return { d: doy, v: round((c.close / base - 1) * 100) };
        }),
      };
    })
    .filter((s) => s.points.length > 5);
}

function stdev(xs: number[]) {
  const m = xs.reduce((s, v) => s + v, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, xs.length - 1));
}

/** Annualised realised volatility over trailing windows: a term structure from prices alone. */
function volTerm(closes: number[], annual: number) {
  const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const windows: [string, number][] = [["1W", 5], ["2W", 10], ["1M", 21], ["2M", 42], ["3M", 63], ["6M", 126], ["1Y", 252]];
  return windows
    .filter(([, n]) => rets.length >= n)
    .map(([label, n]) => ({ label, vol: round(stdev(rets.slice(-n)) * Math.sqrt(annual) * 100, 1) }));
}

type Vote = "buy" | "sell" | "neutral";

/** A summary rating from 10 moving-average votes and 6 oscillator votes. Describes the trend; not advice. */
function technicals(cs: Candle[]) {
  const closes = cs.map((c) => c.close);
  const price = closes[closes.length - 1];
  const ma: { name: string; value: number; vote: Vote }[] = [];
  for (const n of [10, 20, 50, 100, 200]) {
    const s = sma(closes, n);
    if (s != null) ma.push({ name: `SMA ${n}`, value: round(s, priceDigits(s)), vote: price > s ? "buy" : "sell" });
    if (closes.length >= n) {
      const e = emaSeries(closes, n);
      const v = e[e.length - 1];
      ma.push({ name: `EMA ${n}`, value: round(v, priceDigits(v)), vote: price > v ? "buy" : "sell" });
    }
  }

  const osc: { name: string; value: number; vote: Vote }[] = [];
  const rsi = rsiSeries(closes, 14).at(-1);
  if (rsi != null) osc.push({ name: "RSI (14)", value: round(rsi, 1), vote: rsi < 30 ? "buy" : rsi > 70 ? "sell" : "neutral" });

  if (closes.length > 35) {
    const e12 = emaSeries(closes, 12);
    const e26 = emaSeries(closes, 26);
    const macd = e12.map((v, i) => v - e26[i]);
    const signal = emaSeries(macd.slice(26), 9);
    const m = macd[macd.length - 1];
    const s = signal[signal.length - 1];
    osc.push({ name: "MACD (12, 26)", value: round(m - s, 3), vote: m > s ? "buy" : "sell" });
  }

  const w14 = cs.slice(-14);
  if (w14.length === 14) {
    const hi = Math.max(...w14.map((c) => c.high));
    const lo = Math.min(...w14.map((c) => c.low));
    const k = hi > lo ? ((price - lo) / (hi - lo)) * 100 : 50;
    osc.push({ name: "Stochastic %K (14)", value: round(k, 1), vote: k < 20 ? "buy" : k > 80 ? "sell" : "neutral" });
    const wr = k - 100;
    osc.push({ name: "Williams %R (14)", value: round(wr, 1), vote: wr < -80 ? "buy" : wr > -20 ? "sell" : "neutral" });
  }

  if (closes.length > 10) {
    const mom = price - closes[closes.length - 11];
    osc.push({ name: "Momentum (10)", value: round(mom, priceDigits(Math.abs(mom) || 1)), vote: mom > 0 ? "buy" : "sell" });
  }

  const w20 = cs.slice(-20);
  if (w20.length === 20) {
    const tp = w20.map((c) => (c.high + c.low + c.close) / 3);
    const m = tp.reduce((s, v) => s + v, 0) / 20;
    const md = tp.reduce((s, v) => s + Math.abs(v - m), 0) / 20;
    const cci = md ? (tp[19] - m) / (0.015 * md) : 0;
    osc.push({ name: "CCI (20)", value: round(cci, 1), vote: cci < -100 ? "buy" : cci > 100 ? "sell" : "neutral" });
  }

  const tally = (xs: { vote: Vote }[]) => ({
    buy: xs.filter((x) => x.vote === "buy").length,
    sell: xs.filter((x) => x.vote === "sell").length,
    neutral: xs.filter((x) => x.vote === "neutral").length,
  });
  const score = (t: ReturnType<typeof tally>) => {
    const n = t.buy + t.sell + t.neutral;
    return n ? (t.buy - t.sell) / n : 0;
  };
  const maT = tally(ma);
  const oscT = tally(osc);
  // Moving averages and oscillators weigh equally, like most summary gauges.
  const s = (score(maT) + score(oscT)) / 2;
  const label = s <= -0.5 ? "Strong sell" : s < -0.1 ? "Sell" : s <= 0.1 ? "Neutral" : s < 0.5 ? "Buy" : "Strong buy";
  return { score: round(s, 3), label, movingAverages: { ...maT, rows: ma }, oscillators: { ...oscT, rows: osc } };
}

function risk(cs: Candle[]) {
  const year = cs.slice(-252);
  let peak = year[0].close;
  let maxDd = 0;
  for (const c of year) {
    peak = Math.max(peak, c.close);
    maxDd = Math.min(maxDd, c.close / peak - 1);
  }
  const hi = Math.max(...year.map((c) => c.close));
  const last = year[year.length - 1].close;
  const ups = year.slice(1).filter((c, i) => c.close > year[i].close).length;
  const tr = cs.slice(-15).slice(1).map((c, i, arr) => {
    const prevClose = (i === 0 ? cs[cs.length - 15] : arr[i - 1]).close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)) / c.close;
  });
  return {
    maxDrawdown1Y: round(maxDd * 100),
    fromHigh: round((last / hi - 1) * 100),
    upDays1Y: round((ups / Math.max(1, year.length - 1)) * 100, 1),
    atrPct: round((tr.reduce((s, v) => s + v, 0) / Math.max(1, tr.length)) * 100),
  };
}

/** Breadth across the tracked stocks of an index's market. */
async function breadth(region: "US" | "IN", indexCandles: Candle[]) {
  const members = UNIVERSE.filter((u) => u.market === region);
  const charts = (await mapLimit(members, 4, (u) => getYahooChart(u.symbol, "2y"))).filter(
    (c): c is Chart => !!c && c.candles.length > 60
  );
  if (charts.length < 5) return null;

  const n = charts.length;
  const pct = (k: number) => round((k / n) * 100);
  const above = (p: number) => pct(charts.filter((c) => { const cl = c.candles.map((x) => x.close); const s = sma(cl, p); return s != null && cl[cl.length - 1] > s; }).length);

  const idx1M = pctSince(indexCandles, 21) ?? 0;
  const idx3M = pctSince(indexCandles, 63) ?? 0;
  const out1M = charts.filter((c) => (pctSince(c.candles, 21) ?? -Infinity) > idx1M).length;
  const out3M = charts.filter((c) => (pctSince(c.candles, 63) ?? -Infinity) > idx3M).length;
  const ew1M = charts.reduce((s, c) => s + (pctSince(c.candles, 21) ?? 0), 0) / n;

  const highsLows = (
    [
      ["1W", 5],
      ["1M", 21],
      ["3M", 63],
      ["6M", 126],
    ] as [string, number][]
  ).map(([label, w]) => {
    let highs = 0;
    let lows = 0;
    for (const c of charts) {
      const year = c.candles.slice(-252);
      const recent = year.slice(-w);
      const yHi = Math.max(...year.map((x) => x.high));
      const yLo = Math.min(...year.map((x) => x.low));
      if (Math.max(...recent.map((x) => x.high)) >= yHi) highs++;
      if (Math.min(...recent.map((x) => x.low)) <= yLo) lows++;
    }
    return { label, highs, lows, netPct: pct(highs - lows) };
  });

  return {
    members: n,
    region,
    aboveMa: [
      { label: "20-day", pct: above(20) },
      { label: "50-day", pct: above(50) },
      { label: "200-day", pct: above(200) },
    ],
    outperforming: [
      { label: "Over 1 month", pct: pct(out1M) },
      { label: "Over 3 months", pct: pct(out3M) },
    ],
    equalWeightVsIndex1M: round(ew1M - idx1M),
    highsLows,
  };
}

const PROFILE: Record<Kind, { type: string; hours: Record<Region, string> }> = {
  index: { type: "Stock index", hours: { US: "09:30–16:00 New York", IN: "09:15–15:30 Mumbai", GLOBAL: "Local exchange hours" } },
  stock: { type: "Common stock", hours: { US: "09:30–16:00 New York", IN: "09:15–15:30 Mumbai", GLOBAL: "Local exchange hours" } },
  future: { type: "Front-month future", hours: { US: "", IN: "", GLOBAL: "Sun–Fri, nearly 24 hours" } },
  fx: { type: "Currency pair", hours: { US: "", IN: "", GLOBAL: "Mon–Fri, 24 hours" } },
  crypto: { type: "Cryptocurrency", hours: { US: "", IN: "", GLOBAL: "24/7" } },
};

// GET /api/dossier?symbol=^NSEI : everything the side widget shows for one instrument.
router.get("/api/dossier", async (req: Request, res: Response) => {
  const inst = resolveInstrument(String(req.query.symbol || "^GSPC"));
  if (!inst) return res.status(400).json({ error: "Unknown symbol" });

  try {
    const body = await cached(`home:dossier:${inst.symbol}`, 120_000, async () => {
      const chart = (await getYahooChart(inst.symbol, "5y")) ?? (await getYahooChart(inst.symbol, "2y"));
      if (!chart || chart.candles.length < 30) return { symbol: inst.symbol, short: inst.short, name: inst.name, kind: inst.kind, available: false };
      const cs = chart.candles;
      const q = quoteFrom(inst, chart, 60);
      const vols = cs.slice(-31, -1).map((c) => c.volume).filter((v) => v > 0);
      const avgVol30 = vols.length >= 10 ? vols.reduce((s, v) => s + v, 0) / vols.length : null;
      const region = inst.kind === "index" || inst.kind === "stock" ? inst.region : "GLOBAL";

      return {
        ...q,
        avgVolume30: avgVol30 && q.volume ? Math.round(avgVol30) : null,
        performance: PERF_WINDOWS.map(([label, w]) => ({ label, pct: pctSince(cs, w) })),
        seasonals: seasonals(cs),
        technicals: technicals(cs),
        volTerm: volTerm(cs.map((c) => c.close).slice(-253), inst.kind === "crypto" ? 365 : 252),
        risk: risk(cs),
        breadth: inst.kind === "index" && (inst.region === "US" || inst.region === "IN") ? await breadth(inst.region, cs) : null,
        profile: {
          type: PROFILE[inst.kind].type,
          exchange: inst.exchange ?? "—",
          hours: PROFILE[inst.kind].hours[region] || PROFILE[inst.kind].hours.GLOBAL,
          quoteCurrency: chart.currency,
          dataSymbol: inst.symbol,
          history: `${new Date(cs[0].time * 1000).toISOString().slice(0, 10)} onward`,
        },
      };
    });
    res.json(body);
  } catch (err) {
    console.error("[Dossier]", err);
    res.json({ symbol: inst.symbol, short: inst.short, name: inst.name, kind: inst.kind, available: false });
  }
});

// -------------------------------------------------------------------------
// News
// -------------------------------------------------------------------------

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string | null;
  image: string | null;
  time: string | null; // ISO
  topic: string;
  related: string[];
}

const NEWS_TOPICS = ["general", "forex", "crypto", "merger"] as const;
const TOPIC_LABEL: Record<string, string> = { general: "Markets", forex: "Forex", crypto: "Crypto", merger: "Deals" };

async function finnhubNews(topic: string, key: string): Promise<NewsItem[]> {
  const r = await fetch(`https://finnhub.io/api/v1/news?category=${topic}&token=${key}`);
  if (!r.ok) throw new Error(`finnhub news ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data)) return [];
  return data.slice(0, 30).map((a: any) => ({
    id: `fh-${a.id}`,
    title: String(a.headline || "").trim(),
    summary: String(a.summary || "").trim(),
    source: String(a.source || "Finnhub"),
    url: a.url || null,
    image: a.image || null,
    time: a.datetime ? new Date(a.datetime * 1000).toISOString() : null,
    topic: TOPIC_LABEL[topic] ?? topic,
    related: String(a.related || "").split(",").map((s: string) => s.trim()).filter(Boolean),
  }));
}

async function newsDataNews(key: string): Promise<NewsItem[]> {
  const q = encodeURIComponent("stock market OR sensex OR nifty OR nasdaq OR wall street");
  const r = await fetch(`https://newsdata.io/api/1/news?apikey=${key}&q=${q}&language=en&category=business`);
  if (!r.ok) throw new Error(`newsdata ${r.status}`);
  const data = await r.json();
  return (Array.isArray(data?.results) ? data.results : []).map((a: any, i: number) => ({
    id: `nd-${a.article_id ?? i}`,
    title: String(a.title || "").trim(),
    summary: String(a.description || "").trim().slice(0, 400),
    source: String(a.source_name || a.source_id || "NewsData"),
    url: a.link || null,
    image: a.image_url || null,
    time: a.pubDate ? new Date(a.pubDate.replace(" ", "T") + "Z").toISOString() : null,
    topic: Array.isArray(a.country) && a.country.includes("india") ? "India" : "Markets",
    related: [],
  }));
}

// GET /api/market-news : Finnhub when keyed, then NewsData, then labelled samples.
router.get("/api/market-news", async (_req: Request, res: Response) => {
  const finnhubKey = config.finnhub.apiKey;
  const newsKey = config.newsIo.apiKey;
  try {
    const body = await cached("home:news", 5 * 60_000, async () => {
      if (finnhubKey) {
        const lists = await Promise.all(NEWS_TOPICS.map((t) => finnhubNews(t, finnhubKey).catch(() => [] as NewsItem[])));
        const items = lists.flat().filter((n) => n.title);
        if (items.length) return { provider: "Finnhub", sample: false, items: dedupe(items) };
      }
      if (newsKey) {
        const items = await newsDataNews(newsKey).catch(() => [] as NewsItem[]);
        if (items.length) return { provider: "NewsData.io", sample: false, items: dedupe(items) };
      }
      return {
        provider: "Sample",
        sample: true,
        items: mockNews.map((n) => ({ id: `s-${n.id}`, title: n.title, summary: "", source: "Sample headline", url: null, image: null, time: null, topic: n.category, related: [] })),
      };
    });
    res.json(body);
  } catch (err) {
    console.error("[News]", err);
    res.json({ provider: "Unavailable", sample: true, items: [] });
  }
});

function dedupe(items: NewsItem[]) {
  const seen = new Set<string>();
  return items
    .filter((n) => {
      const k = n.title.toLowerCase().slice(0, 80);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""));
}

// -------------------------------------------------------------------------
// IPO calendar
// -------------------------------------------------------------------------

interface Ipo {
  name: string;
  symbol: string | null;
  market: "US" | "IN";
  exchange: string;
  board: string;
  status: "upcoming" | "open" | "listed";
  openDate: string | null;
  closeDate: string | null;
  priceBand: string | null;
  size: string | null;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function usIpos(key: string): Promise<Ipo[]> {
  const today = new Date();
  const from = isoDay(new Date(today.getTime() - 21 * 86_400_000));
  const to = isoDay(new Date(today.getTime() + 45 * 86_400_000));
  const r = await fetch(`https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${key}`);
  if (!r.ok) throw new Error(`finnhub ipo ${r.status}`);
  const data = await r.json();
  const todayIso = isoDay(today);
  return (Array.isArray(data?.ipoCalendar) ? data.ipoCalendar : [])
    .filter((x: any) => x.status !== "withdrawn" && x.name)
    .map((x: any): Ipo => {
      const date: string | null = x.date || null;
      const status: Ipo["status"] = !date || date > todayIso ? "upcoming" : date === todayIso ? "open" : "listed";
      const shares = Number(x.numberOfShares) || 0;
      const value = Number(x.totalSharesValue) || 0;
      return {
        name: x.name,
        symbol: x.symbol || null,
        market: "US",
        exchange: x.exchange || "US",
        board: "Mainboard",
        status,
        openDate: date,
        closeDate: date,
        priceBand: x.price ? `$${x.price}` : null,
        size: value ? `$${fmtBig(value)}` : shares ? `${fmtBig(shares)} shares` : null,
      };
    });
}

function fmtBig(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

/** NSE's public site needs a session cookie from its home page before the JSON routes answer. */
async function indiaIpos(): Promise<Ipo[]> {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.nseindia.com/market-data/all-upcoming-issues-ipo",
  };
  const home = await fetch("https://www.nseindia.com/", { headers });
  const raw = (home.headers as any).getSetCookie?.() ?? [home.headers.get("set-cookie") ?? ""];
  const cookie = (raw as string[]).map((c) => c.split(";")[0]).filter(Boolean).join("; ");
  const get = async (path: string) => {
    const r = await fetch(`https://www.nseindia.com${path}`, { headers: { ...headers, Cookie: cookie } });
    if (!r.ok) throw new Error(`nse ${path} ${r.status}`);
    return r.json();
  };
  const [current, upcoming] = await Promise.all([
    get("/api/ipo-current-issue").catch(() => []),
    get("/api/all-upcoming-issues?category=ipo").catch(() => []),
  ]);
  const rows = (x: any) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []);
  const map = (x: any, status: Ipo["status"]): Ipo => ({
    name: x.companyName || x.company || x.name || x.symbol,
    symbol: x.symbol || null,
    market: "IN",
    exchange: "NSE",
    board: /sme/i.test(String(x.series || x.issueType || "")) ? "SME" : "Mainboard",
    status,
    openDate: x.issueStartDate || x.startDate || null,
    closeDate: x.issueEndDate || x.endDate || null,
    priceBand: x.issuePrice || x.priceBand || x.priceRange || null,
    size: x.issueSize ? `₹${x.issueSize}` : null,
  });
  const out = [...rows(current).map((x: any) => map(x, "open")), ...rows(upcoming).map((x: any) => map(x, "upcoming"))];
  const seen = new Set<string>();
  return out.filter((i) => i.name && !seen.has(i.name) && seen.add(i.name));
}

// GET /api/ipos : US from Finnhub (needs FINNHUB_API), India from NSE (best effort).
router.get("/api/ipos", async (_req: Request, res: Response) => {
  const key = config.finnhub.apiKey;
  const [us, india] = await Promise.all([
    key
      ? cached("home:ipo:us", 6 * 3600_000, () => usIpos(key)).then(
          (items) => ({ available: true, source: "Finnhub", items }),
          () => ({ available: false, reason: "Finnhub's IPO calendar didn't answer.", items: [] as Ipo[] })
        )
      : Promise.resolve({ available: false, reason: "Add FINNHUB_API to .env to load the US IPO calendar.", items: [] as Ipo[] }),
    cached("home:ipo:in", 3 * 3600_000, indiaIpos).then(
      (items) => ({ available: true, source: "NSE", items }),
      () => ({ available: false, reason: "NSE's IPO page couldn't be reached from the server.", items: [] as Ipo[] })
    ),
  ]);
  res.json({ US: us, IN: india });
});

export default router;
