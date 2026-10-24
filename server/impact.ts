/**
 * The impact engine behind the Correlation Web.
 *
 * Layer 1, links: correlation of daily returns, either raw or market-adjusted
 *   (residuals after removing each stock's beta to its benchmark index, so two
 *   stocks don't look linked just because both follow the market).
 * Layer 2, lead-lag: does stock A's residual move today line up with stock B's
 *   residual move tomorrow? Kept only when it clears a Bonferroni-corrected
 *   significance threshold and beats the reverse direction.
 * Layer 3, event study: after stock A's largest residual moves, what did each
 *   peer do on the day and over the next five sessions, with a t-statistic.
 *
 * Everything is descriptive history, not a forecast.
 */
import { BENCHMARK, Market, UNIVERSE } from "./universe";
import { correlation, getYahooChart, mapLimit } from "./marketData";

export interface Panel {
  ids: string[];
  /** Unix day (seconds, midnight UTC) for each return. */
  dates: number[];
  /** returns[i][t]: simple daily return of stock i on day t. */
  returns: number[][];
  benchmark: number[];
  /** Universe members left out because their history didn't load. */
  missing: string[];
}

/** Daily returns for every member of a market, aligned on the days all of them traded. */
export async function loadPanel(market: Market): Promise<Panel | null> {
  const members = UNIVERSE.filter((u) => u.market === market);
  const [bench, ...charts] = await mapLimit([BENCHMARK[market], ...members.map((m) => m.symbol)], 4, (s) =>
    getYahooChart(s, "2y")
  );
  if (!bench) return null;

  const loaded = members.map((m, i) => ({ id: m.id, chart: charts[i] })).filter((x) => x.chart);
  const missing = members.filter((m, i) => !charts[i]).map((m) => m.id);
  if (loaded.length < 3) return null;

  const day = (t: number) => t - (t % 86400);
  const series = [bench, ...loaded.map((x) => x.chart!)].map(
    (c) => new Map(c.candles.map((k) => [day(k.time), k.close]))
  );
  const dates = [...series[0].keys()].filter((d) => series.every((s) => s.has(d))).sort((a, b) => a - b);
  if (dates.length < 40) return null;

  const toReturns = (s: Map<number, number>) => dates.slice(1).map((d, i) => s.get(d)! / s.get(dates[i])! - 1);
  return {
    ids: loaded.map((x) => x.id),
    dates: dates.slice(1),
    benchmark: toReturns(series[0]),
    returns: series.slice(1).map(toReturns),
    missing,
  };
}

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

function std(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(xs.length - 1, 1));
}

/** Residual returns after an OLS fit on the benchmark: r - alpha - beta * m. */
export function residuals(r: number[], m: number[]): { beta: number; resid: number[] } {
  const mr = mean(r);
  const mm = mean(m);
  let cov = 0;
  let varm = 0;
  for (let i = 0; i < r.length; i++) {
    cov += (r[i] - mr) * (m[i] - mm);
    varm += (m[i] - mm) ** 2;
  }
  const beta = varm ? cov / varm : 0;
  const alpha = mr - beta * mm;
  return { beta, resid: r.map((v, i) => v - alpha - beta * m[i]) };
}

/**
 * Clip values beyond ±3 robust standard deviations (from the median absolute
 * deviation), so one extreme day can't manufacture a correlation on its own.
 */
export function winsorize(xs: number[], k = 3): number[] {
  const sorted = [...xs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const dev = xs.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const sigma = 1.4826 * dev[Math.floor(dev.length / 2)];
  if (!sigma) return xs;
  const lo = median - k * sigma;
  const hi = median + k * sigma;
  return xs.map((v) => Math.min(hi, Math.max(lo, v)));
}

// Standard normal CDF via the Abramowitz–Stegun erf approximation (error < 1.5e-7).
function normCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

// Regularized incomplete beta I_x(a, b) via its continued fraction (Numerical Recipes betacf).
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta);
  if (x > (a + 1) / (a + b + 2)) return 1 - incompleteBeta(1 - x, b, a);
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
  let f = d;
  for (let m = 1; m <= 200; m++) {
    for (const step of [0, 1]) {
      const num =
        step === 0
          ? (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m))
          : -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
      d = 1 + num * d;
      d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
      c = 1 + num / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      f *= c * d;
    }
    if (Math.abs(c * d - 1) < 1e-10) break;
  }
  return (front * f) / a;
}

// Lanczos approximation of ln Γ(x).
function lgamma(x: number): number {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Two-sided p-value of a t-statistic with `df` degrees of freedom. */
export function tPValue(t: number, df: number): number {
  if (df < 1 || !Number.isFinite(t)) return 1;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** z such that a two-sided test across `tests` comparisons keeps the family error rate at `alpha`. */
export function bonferroniZ(tests: number, alpha = 0.05): number {
  const target = 1 - alpha / (2 * Math.max(tests, 1));
  let lo = 0;
  let hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (normCdf(mid) < target) lo = mid;
    else hi = mid;
  }
  return hi;
}

export interface Link {
  source: string;
  target: string;
  value: number;
}

export interface Lead {
  /** The stock that moves first. */
  source: string;
  /** The stock that tends to follow one session later. */
  target: string;
  /** Correlation of source today with target tomorrow (market-adjusted). */
  value: number;
  /** Same thing in the other direction, for comparison. */
  reverse: number;
  /** Typical next-day residual move of target per 1% residual move of source, in %. */
  sensitivity: number;
}

export interface WebResult {
  n: number;
  linkThreshold: number;
  leadThreshold: number;
  betas: Record<string, number>;
  links: Link[];
  leads: Lead[];
}

const round = (v: number, digits = 3) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Links and lead-lag pairs over the last `days` sessions of the panel. */
export function buildWeb(panel: Panel, days: number, mode: "adjusted" | "raw", minAbs: number): WebResult {
  const take = (xs: number[]) => xs.slice(-days);
  const bench = take(panel.benchmark);
  const fits = panel.returns.map((r) => residuals(take(r), bench));
  // Residuals are winsorized: fat-tailed days would otherwise dominate the correlations.
  const resid = fits.map((f) => winsorize(f.resid));
  const series = mode === "adjusted" ? resid : panel.returns.map(take);
  const n = bench.length;
  const k = panel.ids.length;
  const pairs = (k * (k - 1)) / 2;

  const linkThreshold = Math.max(minAbs, bonferroniZ(pairs) / Math.sqrt(n));
  const links: Link[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const r = correlation(series[i], series[j]);
      if (r !== null && Math.abs(r) >= linkThreshold) {
        links.push({ source: panel.ids[i], target: panel.ids[j], value: round(r, 2) });
      }
    }
  }

  // Lead-lag always uses residuals: raw returns would mostly rediscover the market's own autocorrelation.
  const leadThreshold = bonferroniZ(pairs * 2) / Math.sqrt(n - 1);
  const leads: Lead[] = [];
  if (n >= 60) {
    const lagged = (a: number[], b: number[]) => correlation(a.slice(0, -1), b.slice(1)) ?? 0;
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        if (i === j) continue;
        const forward = lagged(resid[i], resid[j]);
        const reverse = lagged(resid[j], resid[i]);
        if (Math.abs(forward) < leadThreshold || Math.abs(forward) <= Math.abs(reverse)) continue;
        const sensitivity = forward * (std(resid[j].slice(1)) / std(resid[i].slice(0, -1)));
        leads.push({
          source: panel.ids[i],
          target: panel.ids[j],
          value: round(forward, 2),
          reverse: round(reverse, 2),
          sensitivity: round(sensitivity, 2),
        });
      }
    }
    leads.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }

  const betas = Object.fromEntries(panel.ids.map((id, i) => [id, round(fits[i].beta, 2)]));
  return { n, linkThreshold: round(linkThreshold, 2), leadThreshold: round(leadThreshold, 2), betas, links, leads: leads.slice(0, 15) };
}

export interface EventStudy {
  symbol: string;
  threshold: number; // smallest market-adjusted move among the events, in %
  sessions: number;
  events: Array<{ date: string; move: number; residual: number }>;
  self: PeerReaction | null;
  peers: PeerReaction[];
}

export interface PeerReaction {
  id: string;
  /** Average residual move on the event day, signed so positive means "same direction", in %. */
  sameDay: number;
  /** Average cumulative residual move over the next five sessions, signed the same way, in %. */
  next5: number;
  /** t-statistic of next5 across events. */
  t: number;
  /** Two-sided p-value of t. */
  p: number;
  /** p clears a Bonferroni correction across all peers tested. */
  significant: boolean;
  n: number;
}

const HORIZON = 5;

const EVENTS = 12;

/** What peers did around `id`'s twelve largest market-adjusted moves over the whole panel (about two years). */
export function eventStudy(panel: Panel, id: string): EventStudy | null {
  const idx = panel.ids.indexOf(id);
  if (idx < 0) return null;
  const resid = panel.returns.map((r) => residuals(r, panel.benchmark).resid);
  const own = resid[idx];

  // Largest moves first, skipping any whose follow-up window would overlap one already taken.
  const candidates = own
    .map((v, t) => ({ t, size: Math.abs(v) }))
    .filter((c) => c.t < own.length - HORIZON)
    .sort((a, b) => b.size - a.size);
  const picked: number[] = [];
  for (const c of candidates) {
    if (picked.length === EVENTS) break;
    if (picked.every((t) => Math.abs(t - c.t) > HORIZON)) picked.push(c.t);
  }
  const eventDays = picked.sort((a, b) => a - b);
  const cut = eventDays.length ? Math.min(...eventDays.map((t) => Math.abs(own[t]))) : 0;

  const tests = panel.ids.length; // every peer plus the stock itself
  const react = (series: number[], peerId: string): PeerReaction => {
    const same: number[] = [];
    const after: number[] = [];
    for (const t of eventDays) {
      const sign = Math.sign(own[t]);
      same.push(sign * series[t]);
      let sum = 0;
      for (let h = 1; h <= HORIZON; h++) sum += series[t + h];
      after.push(sign * sum);
    }
    const sd = std(after);
    const t = after.length > 1 && sd > 0 ? mean(after) / (sd / Math.sqrt(after.length)) : 0;
    const p = after.length > 1 ? tPValue(t, after.length - 1) : 1;
    return {
      id: peerId,
      sameDay: round(mean(same) * 100, 2),
      next5: round(mean(after) * 100, 2),
      t: round(t, 2),
      p: round(p, 4),
      significant: after.length >= 5 && p < 0.05 / tests,
      n: after.length,
    };
  };

  const fmt = (d: number) => new Date(d * 1000).toISOString().slice(0, 10);
  return {
    symbol: id,
    threshold: round(cut * 100, 2),
    sessions: own.length,
    events: eventDays.map((t) => ({
      date: fmt(panel.dates[t]),
      move: round(panel.returns[idx][t] * 100, 2),
      residual: round(own[t] * 100, 2),
    })),
    self: eventDays.length ? react(own, id) : null,
    peers: eventDays.length
      ? panel.ids
          .map((peer, j) => (j === idx ? null : react(resid[j], peer)))
          .filter((p): p is PeerReaction => p !== null)
          .sort((a, b) => Math.abs(b.t) - Math.abs(a.t))
      : [],
  };
}
