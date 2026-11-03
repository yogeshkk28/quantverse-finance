/**
 * Dynamic structure: how coupled the market is, window by window.
 *
 * - Average pairwise correlation (raw and market-adjusted).
 * - Absorption ratio (Kritzman, Li, Page & Rigobon 2011): variance share of
 *   the top ⌈N/5⌉ eigenvectors. High means risk is concentrated in a few
 *   common drivers, which historically precedes sharp drawdowns. Its
 *   standardised shift compares the last 15 sessions with the last year.
 * - Normalised MST length (Onnela et al. 2003): the tree contracts in stress.
 * - MST edge survival (Onnela et al. 2003): the share of backbone edges that
 *   survive from one window to the next. Low survival = the structure is
 *   being rewired.
 */
import { correlationMatrix, correlationSpectrum } from "./linalg";
import { edgeKey, minimumSpanningTree, treeLength } from "./networks";

export interface RegimePoint {
  date: string;
  avgCorr: number;
  avgResidualCorr: number;
  absorption: number;
  marketShare: number;
  treeLength: number;
  /** Null for the first window. */
  survival: number | null;
}

export interface Regime {
  window: number;
  step: number;
  points: RegimePoint[];
  /** Percentile (0–100) of the latest absorption ratio within the whole history. */
  absorptionPercentile: number;
  /** Percentile of the latest average correlation. */
  corrPercentile: number;
  /** (mean AR over ~15 sessions − mean AR over ~1 year) / σ(AR over ~1 year). */
  absorptionShift: number;
  state: "coupled" | "normal" | "dispersed";
}

const offDiagMean = (m: number[][]) => {
  const n = m.length;
  let s = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += m[i][j];
  return n > 1 ? s / ((n * (n - 1)) / 2) : 0;
};

const pctRank = (xs: number[], x: number) => (xs.length ? (xs.filter((v) => v <= x).length / xs.length) * 100 : 50);

export function rollingRegime(
  raw: number[][],
  residual: number[][],
  dates: number[],
  window = 60,
  step = 5
): Regime {
  const t = dates.length;
  const n = raw.length;
  const k = Math.max(1, Math.ceil(n / 5));
  const points: RegimePoint[] = [];
  let prev: Set<string> | null = null;
  // Anchor windows on the latest day so the last point is always "now".
  const ends: number[] = [];
  for (let end = t; end - window >= 0; end -= step) ends.unshift(end);

  for (const end of ends) {
    const slice = (rows: number[][]) => rows.map((r) => r.slice(end - window, end));
    const rawW = slice(raw);
    const corr = correlationMatrix(rawW);
    const eig = correlationSpectrum(rawW);
    const total = eig.reduce((s, v) => s + Math.max(v, 0), 0) || 1;
    const dist = corr.map((row) => row.map((r) => Math.sqrt(Math.max(0, 2 * (1 - r)))));
    const mst = minimumSpanningTree(dist, corr);
    const keys = new Set(mst.map((e) => edgeKey(e.i, e.j)));
    const survival = prev ? [...keys].filter((x) => prev!.has(x)).length / Math.max(keys.size, 1) : null;
    prev = keys;
    points.push({
      date: new Date(dates[end - 1] * 1000).toISOString().slice(0, 10),
      avgCorr: offDiagMean(corr),
      avgResidualCorr: offDiagMean(correlationMatrix(slice(residual))),
      absorption: eig.slice(0, k).reduce((s, v) => s + v, 0) / total,
      marketShare: eig[0] / total,
      treeLength: treeLength(mst),
      survival,
    });
  }

  const ar = points.map((p) => p.absorption);
  const last = points[points.length - 1];
  const short = ar.slice(-3); // ≈ 15 sessions at a 5-day step
  const year = ar.slice(-50); // ≈ 250 sessions
  const m = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / Math.max(xs.length, 1);
  const sd = Math.sqrt(year.reduce((s, v) => s + (v - m(year)) ** 2, 0) / Math.max(year.length - 1, 1));
  const absorptionShift = sd > 0 ? (m(short) - m(year)) / sd : 0;
  const absorptionPercentile = last ? pctRank(ar, last.absorption) : 50;
  const corrPercentile = last ? pctRank(points.map((p) => p.avgCorr), last.avgCorr) : 50;
  const state = absorptionPercentile >= 80 || absorptionShift >= 1 ? "coupled" : absorptionPercentile <= 20 ? "dispersed" : "normal";
  return { window, step, points, absorptionPercentile, corrPercentile, absorptionShift, state };
}

/** Rolling correlation of two series, one value per day once `window` days are available. */
export function rollingPairCorrelation(a: number[], b: number[], window: number): Array<number | null> {
  return a.map((_, end) => {
    if (end + 1 < window) return null;
    const x = a.slice(end + 1 - window, end + 1);
    const y = b.slice(end + 1 - window, end + 1);
    return correlationMatrix([x, y])[0][1];
  });
}

/** Cross-correlation of a(t) with b(t + lag) for lag in [−maxLag, maxLag]. Positive lag: a leads b. */
export function crossCorrelation(a: number[], b: number[], maxLag = 5): Array<{ lag: number; r: number }> {
  const out: Array<{ lag: number; r: number }> = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const x = lag >= 0 ? a.slice(0, a.length - lag) : a.slice(-lag);
    const y = lag >= 0 ? b.slice(lag) : b.slice(0, b.length + lag);
    out.push({ lag, r: x.length > 10 ? correlationMatrix([x, y])[0][1] : 0 });
  }
  return out;
}
