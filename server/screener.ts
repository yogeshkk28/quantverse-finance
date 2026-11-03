/**
 * Screener data service (`/api/screener`).
 *
 * Builds one row per stock in SCREENER_UNIVERSE from two batched Yahoo Finance sources:
 *
 *  1. Quote snapshot (v7 quote, 50 symbols per call): price, day change, market cap,
 *     volume, P/E, forward P/E, P/B, dividend yield, EPS, 52-week range, analyst rating.
 *  2. One year of daily closes (v8 spark, 20 symbols per call, falling back to the
 *     per-symbol chart endpoint): returns, RSI, moving averages, volatility, beta,
 *     drawdown, Sharpe, MACD and golden-cross signals, sparklines.
 *
 * Factor scores (Value, Momentum, Stability, Growth) are percentile ranks computed here,
 * within each market, from those inputs.
 *
 * The first build fills in progressively and the endpoint reports `status: "building"`
 * until it finishes. If Yahoo can't be reached at all, rows are generated from a seeded
 * random walk and the response says `mode: "simulated"` so the UI can label it plainly.
 */
import type { ScreenerResponse, ScreenerRow } from "../src/types";
import { SCREENER_UNIVERSE, ScreenerEntry } from "./screenerUniverse";
import { BENCHMARK, CURRENCY, Market } from "./universe";
import { YF_HEADERS, getYahooChart, mapLimit, rsiSeries, emaSeries, round } from "./marketData";

const REFRESH_MS = 5 * 60_000;
const FIRST_LOAD_WAIT_MS = 20_000;
const FALLBACK_USDINR = 84;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));
const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

// -------------------------------------------------------------------------
// Yahoo session (cookie + crumb), needed by the v7 quote endpoint
// -------------------------------------------------------------------------

let yahooSession: { cookie: string; crumb: string; expires: number } | null = null;
let sessionFailedUntil = 0;

async function getSession(force = false) {
  if (!force && yahooSession && yahooSession.expires > Date.now()) return yahooSession;
  if (!force && sessionFailedUntil > Date.now()) return null;
  try {
    const first = await fetch("https://fc.yahoo.com/", {
      headers: YF_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    const setCookies = typeof first.headers.getSetCookie === "function" ? first.headers.getSetCookie() : [];
    const cookie = setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
    if (!cookie) throw new Error("no cookie");
    const res = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { ...YF_HEADERS, Accept: "text/plain", Cookie: cookie },
      signal: AbortSignal.timeout(8000),
    });
    const crumb = (await res.text()).trim();
    if (!res.ok || !crumb || crumb.includes("<") || crumb.length > 40) throw new Error(`crumb ${res.status}`);
    yahooSession = { cookie, crumb, expires: Date.now() + 30 * 60_000 };
    return yahooSession;
  } catch (err) {
    console.warn("[Screener] Yahoo session unavailable:", (err as Error).message);
    sessionFailedUntil = Date.now() + 5 * 60_000;
    yahooSession = null;
    return null;
  }
}

async function fetchQuoteBatch(symbols: string[]): Promise<any[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const session = await getSession(attempt > 0);
    if (!session) return null;
    const url =
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.map(encodeURIComponent).join(",")}` +
      `&crumb=${encodeURIComponent(session.crumb)}`;
    try {
      const res = await fetch(url, {
        headers: { ...YF_HEADERS, Cookie: session.cookie },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 401 || res.status === 403) continue; // stale crumb: refresh once
      if (!res.ok) {
        console.warn(`[Screener] quote batch ${res.status}`);
        return null;
      }
      const data = await res.json();
      return data?.quoteResponse?.result ?? [];
    } catch (err) {
      console.warn("[Screener] quote batch failed:", (err as Error).message);
      return null;
    }
  }
  return null;
}

// -------------------------------------------------------------------------
// One year of daily closes
// -------------------------------------------------------------------------

interface Series {
  t: number[]; // unix seconds
  c: number[];
  v?: number[];
}

function cleanSeries(t: unknown, c: unknown, v?: unknown): Series | null {
  if (!Array.isArray(t) || !Array.isArray(c)) return null;
  const out: Series = { t: [], c: [], v: Array.isArray(v) ? [] : undefined };
  for (let i = 0; i < t.length; i++) {
    const close = num(c[i]);
    if (close === null || close <= 0) continue;
    out.t.push(t[i]);
    out.c.push(close);
    if (out.v) out.v.push(num((v as unknown[])[i]) ?? 0);
  }
  return out.c.length >= 20 ? out : null;
}

async function fetchSparkBatch(symbols: string[]): Promise<Map<string, Series> | null> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols.map(encodeURIComponent).join(",")}` +
    `&range=1y&interval=1d`;
  try {
    const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      console.warn(`[Screener] spark batch ${res.status}`);
      return null;
    }
    const data = await res.json();
    const out = new Map<string, Series>();
    if (Array.isArray(data?.spark?.result)) {
      // Older shape: { spark: { result: [{ symbol, response: [chart] }] } }
      for (const r of data.spark.result) {
        const chart = r?.response?.[0];
        const s = cleanSeries(chart?.timestamp, chart?.indicators?.quote?.[0]?.close);
        if (s && r.symbol) out.set(r.symbol, s);
      }
    } else if (data && typeof data === "object") {
      // Current shape: { AAPL: { timestamp: [], close: [] }, … }
      for (const [symbol, v] of Object.entries<any>(data)) {
        const s = cleanSeries(v?.timestamp, v?.close);
        if (s) out.set(symbol, s);
      }
    }
    return out;
  } catch (err) {
    console.warn("[Screener] spark batch failed:", (err as Error).message);
    return null;
  }
}

async function fetchChartSeries(symbol: string): Promise<Series | null> {
  const chart = await getYahooChart(symbol, "1y");
  if (!chart) return null;
  return cleanSeries(
    chart.candles.map((k) => k.time),
    chart.candles.map((k) => k.close),
    chart.candles.map((k) => k.volume)
  );
}

// -------------------------------------------------------------------------
// Metrics from a close series
// -------------------------------------------------------------------------

const dayKey = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

function stdev(xs: number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
}

function pctChange(c: number[], back: number): number | null {
  const i = c.length - 1 - back;
  return i >= 0 ? round((c[c.length - 1] / c[i] - 1) * 100, 2) : null;
}

/** Beta from returns on the dates both series traded. */
function betaAligned(s: Series, bench: Map<string, number> | null): number | null {
  if (!bench) return null;
  const a: number[] = [];
  const b: number[] = [];
  let prevA: number | null = null;
  let prevB: number | null = null;
  for (let i = 0; i < s.t.length; i++) {
    const bc = bench.get(dayKey(s.t[i]));
    if (bc === undefined) continue;
    if (prevA !== null && prevB !== null) {
      a.push(s.c[i] / prevA - 1);
      b.push(bc / prevB - 1);
    }
    prevA = s.c[i];
    prevB = bc;
  }
  if (a.length < 40) return null;
  const mb = b.reduce((x, y) => x + y, 0) / b.length;
  const ma = a.reduce((x, y) => x + y, 0) / a.length;
  let cov = 0, varb = 0;
  for (let i = 0; i < a.length; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    varb += (b[i] - mb) ** 2;
  }
  return varb ? round(cov / varb, 2) : null;
}

interface SeriesMetrics {
  last: number;
  prev: number;
  perfW1: number | null;
  perfM1: number | null;
  perfM3: number | null;
  perfM6: number | null;
  perfYtd: number | null;
  perfY1: number | null;
  rsi: number | null;
  sma50: number | null;
  sma200: number | null;
  high: number;
  low: number;
  macdCross: boolean;
  volatility: number | null;
  maxDrawdown: number;
  sharpe: number | null;
  beta: number | null;
  avgVol20: number | null;
  lastVol: number | null;
  spark: number[];
}

function seriesMetrics(s: Series, bench: Map<string, number> | null): SeriesMetrics {
  const c = s.c;
  const n = c.length - 1;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  // YTD: last close of the previous calendar year is the base.
  const year = new Date(s.t[n] * 1000).getUTCFullYear();
  const firstThisYear = s.t.findIndex((t) => new Date(t * 1000).getUTCFullYear() === year);
  const perfYtd = firstThisYear > 0 ? round((c[n] / c[firstThisYear - 1] - 1) * 100, 2) : null;

  const ema26 = emaSeries(c, 26);
  const macd = emaSeries(c, 12).map((v, i) => v - ema26[i]);
  const signal = emaSeries(macd, 9);
  const macdCross = [0, 1, 2, 3, 4].some((k) => {
    const i = n - k;
    return i > 26 && macd[i] > signal[i] && macd[i - 1] <= signal[i - 1];
  });

  const rets = c.slice(1).map((v, i) => v / c[i] - 1);
  const recent = rets.slice(-63);
  const vol = recent.length >= 20 ? stdev(recent) * Math.sqrt(252) * 100 : null;
  const yearSd = rets.length >= 60 ? stdev(rets) : 0;
  const sharpe = yearSd ? (mean(rets) * 252) / (yearSd * Math.sqrt(252)) : null;

  let peak = c[0];
  let maxDd = 0;
  for (const v of c) {
    peak = Math.max(peak, v);
    maxDd = Math.min(maxDd, v / peak - 1);
  }

  const step = Math.max(1, Math.ceil(c.length / 64));
  const spark = c.filter((_, i) => i % step === 0 || i === n).map((v) => round(v, 2));

  const lastRsi = num(rsiSeries(c).at(-1));
  const v = s.v;
  return {
    last: c[n],
    prev: c[n - 1] ?? c[n],
    perfW1: pctChange(c, 5),
    perfM1: pctChange(c, 21),
    perfM3: pctChange(c, 63),
    perfM6: pctChange(c, 126),
    perfYtd,
    perfY1: c.length >= 230 ? round((c[n] / c[0] - 1) * 100, 2) : null,
    rsi: lastRsi === null ? null : round(lastRsi, 1),
    sma50: c.length >= 50 ? mean(c.slice(-50)) : null,
    sma200: c.length >= 200 ? mean(c.slice(-200)) : null,
    high: Math.max(...c),
    low: Math.min(...c),
    macdCross,
    volatility: vol === null ? null : round(vol, 1),
    maxDrawdown: round(maxDd * 100, 1),
    sharpe: sharpe === null ? null : round(sharpe, 2),
    beta: betaAligned(s, bench),
    avgVol20: v && v.length > 21 ? mean(v.slice(-21, -1)) : null,
    lastVol: v && v.length ? v[v.length - 1] : null,
    spark,
  };
}

// -------------------------------------------------------------------------
// Row assembly
// -------------------------------------------------------------------------

interface BuildState {
  quotes: Map<string, any>;
  series: Map<string, Series>;
  bench: Record<Market, Map<string, number> | null>;
  usdInr: number;
  mode: "live" | "simulated";
  status: "building" | "ready";
  progress: number;
  updatedAt: string;
  rows: ScreenerRow[];
}

function parseRating(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const x = parseFloat(v);
  return isFinite(x) && x >= 1 && x <= 5 ? x : null;
}

function buildRow(e: ScreenerEntry, q: any | undefined, s: Series | undefined, st: BuildState): ScreenerRow | null {
  const m = s ? seriesMetrics(s, st.bench[e.market]) : null;
  const price = num(q?.regularMarketPrice) ?? m?.last ?? null;
  if (price === null) return null;

  const chg =
    num(q?.regularMarketChangePercent) ?? (m ? round((m.last / m.prev - 1) * 100, 2) : null);
  const fx = e.market === "IN" ? st.usdInr : 1;
  const mktCap = num(q?.marketCap);
  const volume = num(q?.regularMarketVolume) ?? m?.lastVol ?? null;
  const avgVolume = num(q?.averageDailyVolume3Month) ?? num(q?.averageDailyVolume10Day) ?? m?.avgVol20 ?? null;
  const sma50 = m?.sma50 ?? num(q?.fiftyDayAverage);
  const sma200 = m?.sma200 ?? num(q?.twoHundredDayAverage);
  const high52 = num(q?.fiftyTwoWeekHigh) ?? m?.high ?? null;
  const low52 = num(q?.fiftyTwoWeekLow) ?? m?.low ?? null;
  const eps = num(q?.epsTrailingTwelveMonths);
  const epsFwd = num(q?.epsForward);
  const pe = num(q?.trailingPE);
  const divYield =
    num(q?.dividendYield) ?? (num(q?.trailingAnnualDividendYield) !== null ? q.trailingAnnualDividendYield * 100 : null);
  const dist = (ref: number | null) => (ref ? round((price / ref - 1) * 100, 2) : null);

  return {
    id: e.id,
    symbol: e.symbol,
    name: e.name,
    sector: e.sector,
    industry: e.industry,
    market: e.market,
    currency: CURRENCY[e.market],
    source: st.mode === "simulated" ? "simulated" : q && s ? "live" : "partial",
    price: round(price, 2),
    chg: chg === null ? null : round(chg, 2),
    mktCap: mktCap === null ? null : Math.round(mktCap),
    mktCapUsd: mktCap === null ? null : mktCap / fx,
    volume,
    avgVolume: avgVolume === null ? null : Math.round(avgVolume),
    relVolume: volume !== null && avgVolume ? round(volume / avgVolume, 2) : null,
    turnoverUsd: avgVolume ? (avgVolume * price) / fx : null,
    pe: pe !== null && pe > 0 ? round(pe, 1) : null,
    fwdPe: num(q?.forwardPE) !== null && q.forwardPE > 0 ? round(q.forwardPE, 1) : null,
    pb: num(q?.priceToBook) !== null && q.priceToBook > 0 ? round(q.priceToBook, 2) : null,
    divYield: divYield !== null ? round(divYield, 2) : q ? 0 : null,
    eps: eps !== null ? round(eps, 2) : null,
    epsGrowth: eps !== null && epsFwd !== null && eps > 0 ? round((epsFwd / eps - 1) * 100, 1) : null,
    analyst: parseRating(q?.averageAnalystRating),
    perfW1: m?.perfW1 ?? null,
    perfM1: m?.perfM1 ?? null,
    perfM3: m?.perfM3 ?? null,
    perfM6: m?.perfM6 ?? null,
    perfYtd: m?.perfYtd ?? null,
    perfY1: m?.perfY1 ?? null,
    rsi: m?.rsi ?? null,
    sma50Dist: dist(sma50),
    sma200Dist: dist(sma200),
    high52: high52 === null ? null : round(high52, 2),
    low52: low52 === null ? null : round(low52, 2),
    fromHigh52: dist(high52),
    fromLow52: dist(low52),
    macdCross: m ? m.macdCross : null,
    goldenCross: sma50 !== null && sma200 !== null ? sma50 > sma200 : null,
    beta: m?.beta ?? null,
    volatility: m?.volatility ?? null,
    maxDrawdown: m?.maxDrawdown ?? null,
    sharpe: m?.sharpe ?? null,
    scoreValue: null,
    scoreMomentum: null,
    scoreStability: null,
    scoreGrowth: null,
    scoreComposite: null,
    spark: m?.spark ?? [],
  };
}

/** Percentile rank (0–100) of each row's value among rows that have one. */
function percentiles(rows: ScreenerRow[], get: (r: ScreenerRow) => number | null): Map<string, number> {
  const vals = rows.map((r) => [r.id, get(r)] as const).filter((x): x is readonly [string, number] => x[1] !== null);
  vals.sort((a, b) => a[1] - b[1]);
  const out = new Map<string, number>();
  const n = vals.length;
  if (n < 5) return out;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && vals[j + 1][1] === vals[i][1]) j++;
    const pct = ((i + j) / 2 / (n - 1)) * 100; // ties share the average rank
    for (let k = i; k <= j; k++) out.set(vals[k][0], pct);
    i = j + 1;
  }
  return out;
}

function avgOf(maps: Map<string, number>[], id: string, minParts = 1): number | null {
  const parts = maps.map((m) => m.get(id)).filter((v): v is number => v !== undefined);
  return parts.length >= minParts ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
}

function scoreRows(rows: ScreenerRow[]) {
  for (const market of ["US", "IN"] as const) {
    const group = rows.filter((r) => r.market === market);
    const value = [
      percentiles(group, (r) => (r.pe ? 1 / r.pe : null)),
      percentiles(group, (r) => (r.pb ? 1 / r.pb : null)),
      percentiles(group, (r) => r.divYield),
    ];
    const momentum = [
      percentiles(group, (r) => r.perfM6),
      percentiles(group, (r) => r.perfY1),
      percentiles(group, (r) => r.sma200Dist),
    ];
    const stability = [
      percentiles(group, (r) => (r.volatility === null ? null : -r.volatility)),
      percentiles(group, (r) => r.maxDrawdown),
      percentiles(group, (r) => r.sharpe),
    ];
    const growth = [percentiles(group, (r) => r.epsGrowth)];
    for (const r of group) {
      r.scoreValue = avgOf(value, r.id);
      r.scoreMomentum = avgOf(momentum, r.id, 2);
      r.scoreStability = avgOf(stability, r.id, 2);
      r.scoreGrowth = avgOf(growth, r.id);
      const all = [r.scoreValue, r.scoreMomentum, r.scoreStability, r.scoreGrowth].filter((v): v is number => v !== null);
      r.scoreComposite = all.length >= 2 ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : null;
    }
  }
}

function assemble(st: BuildState) {
  const rows = SCREENER_UNIVERSE.map((e) => buildRow(e, st.quotes.get(e.symbol), st.series.get(e.symbol), st)).filter(
    (r): r is ScreenerRow => r !== null
  );
  scoreRows(rows);
  st.rows = rows;
  st.updatedAt = new Date().toISOString();
}

// -------------------------------------------------------------------------
// Simulated fallback (only when Yahoo is unreachable)
// -------------------------------------------------------------------------

function seeded(seedText: string) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function simulate(st: BuildState) {
  const day = new Date().toISOString().slice(0, 10);
  const now = Math.floor(Date.now() / 1000);
  for (const market of ["US", "IN"] as const) {
    const rnd = seeded(`${BENCHMARK[market]}:${day}`);
    const t: number[] = [];
    const c: number[] = [];
    let p = 100;
    for (let i = 0; i < 252; i++) {
      p *= 1 + (rnd() - 0.48) * 0.022;
      t.push(now - Math.round((251 - i) * 86400 * 1.45));
      c.push(p);
    }
    st.bench[market] = new Map(t.map((x, i) => [dayKey(x), c[i]]));
  }
  for (const e of SCREENER_UNIVERSE) {
    const rnd = seeded(`${e.symbol}:${day}`);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
    const vol = 0.009 + rnd() * 0.015;
    const drift = (rnd() - 0.42) * 0.0016;
    const bench = st.bench[e.market]!;
    const benchCloses = [...bench.values()];
    const b = 0.5 + rnd() * 1.1;
    let p = e.market === "IN" ? 150 + rnd() * 4000 : 20 + rnd() * 800;
    const t: number[] = [];
    const c: number[] = [];
    const v: number[] = [];
    const baseVol = (e.market === "IN" ? 2e6 : 6e6) * (0.2 + rnd() * 2);
    for (let i = 0; i < 252; i++) {
      const mkt = i > 0 ? benchCloses[i] / benchCloses[i - 1] - 1 : 0;
      p *= 1 + drift + b * mkt + vol * gauss();
      t.push(now - Math.round((251 - i) * 86400 * 1.45));
      c.push(Math.max(1, p));
      v.push(Math.round(baseVol * (0.5 + rnd() * (i > 248 ? 3 : 1.2))));
    }
    st.series.set(e.symbol, { t, c, v });
    const last = c[c.length - 1];
    const eps = last / (8 + rnd() * 50) * (rnd() < 0.08 ? -1 : 1);
    st.quotes.set(e.symbol, {
      regularMarketPrice: last,
      regularMarketChangePercent: (last / c[c.length - 2] - 1) * 100,
      marketCap: (e.market === "IN" ? 3e11 + rnd() ** 2 * 1.8e13 : 8e9 + rnd() ** 3 * 2.5e12),
      regularMarketVolume: v[v.length - 1],
      averageDailyVolume3Month: baseVol,
      trailingPE: eps > 0 ? last / eps : undefined,
      forwardPE: eps > 0 ? (last / eps) * (0.75 + rnd() * 0.3) : undefined,
      epsTrailingTwelveMonths: eps,
      epsForward: eps * (0.9 + rnd() * 0.45),
      priceToBook: 0.8 + rnd() ** 2 * 18,
      dividendYield: rnd() < 0.3 ? 0 : rnd() ** 2 * 5,
      averageAnalystRating: `${(1.5 + rnd() * 2).toFixed(1)} - Simulated`,
    });
  }
}

// -------------------------------------------------------------------------
// Build orchestration
// -------------------------------------------------------------------------

let current: BuildState | null = null;
let building: Promise<void> | null = null;
let builtAt = 0;

async function loadBenchmark(market: Market): Promise<Map<string, number> | null> {
  const chart = await getYahooChart(BENCHMARK[market], "1y");
  return chart ? new Map(chart.candles.map((k) => [dayKey(k.time), k.close])) : null;
}

async function build(): Promise<void> {
  const st: BuildState = {
    quotes: new Map(),
    series: new Map(),
    bench: { US: null, IN: null },
    usdInr: current?.usdInr ?? FALLBACK_USDINR,
    mode: "live",
    status: "building",
    progress: 0,
    updatedAt: new Date().toISOString(),
    rows: [],
  };
  // The first build is visible while it fills in; refreshes swap in when complete.
  if (!current) current = st;
  const started = Date.now();
  const symbols = SCREENER_UNIVERSE.map((e) => e.symbol);
  const quoteBatches = chunk([...symbols, "INR=X"], 50);
  const sparkBatches = chunk(symbols, 20);
  const totalSteps = quoteBatches.length + sparkBatches.length + 2;
  let done = 0;
  const tick = () => {
    done++;
    st.progress = Math.min(0.99, done / totalSteps);
  };

  const [usBench, inBench] = await Promise.all([loadBenchmark("US"), loadBenchmark("IN")]);
  st.bench = { US: usBench, IN: inBench };
  tick();

  for (const batch of quoteBatches) {
    const result = await fetchQuoteBatch(batch);
    for (const q of result ?? []) if (q?.symbol) st.quotes.set(q.symbol, q);
    tick();
    if (!result && st.quotes.size === 0) break; // session refused: don't keep trying
  }
  const fx = num(st.quotes.get("INR=X")?.regularMarketPrice);
  if (fx && fx > 50 && fx < 150) st.usdInr = fx;
  assemble(st);

  let sparkFailures = 0;
  for (const batch of sparkBatches) {
    const result = await fetchSparkBatch(batch);
    if (result) for (const [sym, s] of result) st.series.set(sym, s);
    else sparkFailures++;
    tick();
    assemble(st);
    if (sparkFailures >= 3 && st.series.size === 0) break; // endpoint down: go to the fallback
    await sleep(150);
  }

  // Per-symbol chart fallback for anything spark missed, if Yahoo is reachable at all.
  const missing = symbols.filter((s) => !st.series.has(s));
  if (missing.length) {
    const probe = await fetchChartSeries(missing[0]);
    if (probe) {
      st.series.set(missing[0], probe);
      let count = 0;
      await mapLimit(missing.slice(1), 3, async (sym) => {
        const s = await fetchChartSeries(sym);
        if (s) st.series.set(sym, s);
        if (++count % 15 === 0) assemble(st);
      });
    }
  }
  tick();

  if (st.quotes.size === 0 && st.series.size === 0) {
    console.warn("[Screener] Yahoo unreachable: serving simulated screener data.");
    st.mode = "simulated";
    simulate(st);
  }
  assemble(st);
  st.status = "ready";
  st.progress = 1;
  current = st;
  builtAt = Date.now();
  console.log(
    `[Screener] ${st.rows.length}/${SCREENER_UNIVERSE.length} rows (${st.mode}); quotes ${st.quotes.size}, ` +
      `history ${st.series.size}; ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
}

function ensureBuild() {
  if (!building && Date.now() - builtAt > REFRESH_MS) {
    building = build()
      .catch((err) => console.error("[Screener] build failed:", err))
      .finally(() => {
        building = null;
      });
  }
  return building;
}

export async function getScreener(): Promise<ScreenerResponse> {
  const pending = ensureBuild();
  if (pending && (!current || current.rows.length === 0)) {
    await Promise.race([pending, sleep(FIRST_LOAD_WAIT_MS)]);
  }
  const st = current;
  const ready = st?.status === "ready";
  return {
    rows: st?.rows ?? [],
    status: ready ? "ready" : "building",
    progress: ready ? 1 : st?.progress ?? 0,
    mode: st?.mode ?? "live",
    updatedAt: st?.updatedAt ?? new Date().toISOString(),
    universe: SCREENER_UNIVERSE.length,
    coverage: {
      quotes: SCREENER_UNIVERSE.filter((e) => st?.quotes.has(e.symbol)).length,
      history: SCREENER_UNIVERSE.filter((e) => st?.series.has(e.symbol)).length,
    },
    usdInr: st?.usdInr ?? FALLBACK_USDINR,
  };
}
