/**
 * The Correlation Web's analytics: one entry point per view.
 *
 * structure()  the cleaned correlation matrix, its spectrum, filtered networks
 *              (MST, TMFG, partial-correlation, threshold, lead-lag),
 *              clusters and centrality for one window.
 * dynamics()   rolling regime metrics over the whole panel (about two years).
 * pair()       drill-down for two stocks: rolling correlation and lead-lag profile.
 *
 * Methods and references are documented in docs/correlation-web.md.
 */
import { Panel, bonferroniZ, buildWeb, residuals, winsorize } from "./impact";
import { Estimator, distanceMatrix, estimate, ledoitWolf, marchenkoPasturCurve, partialCorrelations } from "./quant/estimators";
import { Edge, bootstrapMst, centrality, edgeKey, minimumSpanningTree, thresholdGraph, tmfg, treeLength } from "./quant/networks";
import { clusterStocks } from "./quant/clustering";
import { crossCorrelation, rollingPairCorrelation, rollingRegime } from "./quant/regimes";

export type Basis = "residual" | "raw";

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Winsorised return series for the last `days` sessions on the chosen basis. */
function seriesFor(panel: Panel, days: number, basis: Basis) {
  const bench = panel.benchmark.slice(-days);
  const fits = panel.returns.map((r) => residuals(r.slice(-days), bench));
  const series =
    basis === "residual" ? fits.map((f) => winsorize(f.resid)) : panel.returns.map((r) => winsorize(r.slice(-days)));
  return { series, betas: fits.map((f) => f.beta), n: bench.length };
}

export interface StructureEdge {
  source: string;
  target: string;
  value: number;
  distance: number;
  /** Share of bootstrap replicas whose MST contains this edge (MST edges only). */
  reliability?: number;
}

export function structure(panel: Panel, days: number, basis: Basis, estimator: Estimator) {
  const { series, betas, n: t } = seriesFor(panel, days, basis);
  const ids = panel.ids;
  const n = ids.length;
  const pairs = (n * (n - 1)) / 2;

  const est = estimate(series, estimator);
  const corr = est.corr;
  const dist = distanceMatrix(corr);
  const partial = partialCorrelations(corr);

  const mst = minimumSpanningTree(dist, corr);
  const filtered = tmfg(corr, dist);
  const reliability = bootstrapMst(series, (s) => ledoitWolf(s).corr, n <= 40 ? 100 : 40);

  const linkThreshold = Math.max(basis === "raw" ? 0.4 : 0.3, bonferroniZ(pairs) / Math.sqrt(t));
  const threshold = thresholdGraph(corr, dist, linkThreshold);

  // Partial correlations: Fisher z with T − (N − 2) − 3 effective observations, Bonferroni across pairs.
  const dof = t - (n - 2) - 3;
  const partialTest: "fisher" | "ranked" = dof >= 10 ? "fisher" : "ranked";
  const partialThreshold = partialTest === "fisher" ? Math.tanh(bonferroniZ(pairs) / Math.sqrt(dof)) : null;
  let partialEdges: Edge[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) partialEdges.push({ i, j, rho: partial[i][j], distance: dist[i][j] });
  partialEdges.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));
  partialEdges =
    partialThreshold !== null ? partialEdges.filter((e) => Math.abs(e.rho) >= partialThreshold) : partialEdges.slice(0, n);

  const clusters = clusterStocks(dist);
  const cent = centrality(n, n >= 4 ? filtered : mst);
  const mstDegree = new Array(n).fill(0);
  for (const e of mst) {
    mstDegree[e.i]++;
    mstDegree[e.j]++;
  }

  const toOut = (e: Edge, withReliability = false): StructureEdge => ({
    source: ids[e.i],
    target: ids[e.j],
    value: r3(e.rho),
    distance: r3(e.distance),
    ...(withReliability ? { reliability: r3(reliability.get(edgeKey(e.i, e.j)) ?? 0) } : {}),
  });

  // Lead-lag is always on market-adjusted returns (see impact.ts).
  const leads = buildWeb(panel, days, "adjusted", 0.3).leads;

  let off = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += corr[i][j];

  const sp = est.spectrum;
  return {
    sessions: t,
    basis,
    estimator,
    shrinkage: est.shrinkage === null ? null : r3(est.shrinkage),
    ids,
    betas: betas.map(r3),
    order: clusters.order.map((i) => ids[i]),
    corr: corr.map((row) => row.map(r3)),
    partial: partial.map((row) => row.map(r3)),
    clusters: {
      k: clusters.k,
      silhouette: r3(clusters.silhouette),
      labels: clusters.labels,
      scan: clusters.scan.map((s) => ({ k: s.k, silhouette: r3(s.silhouette) })),
      merges: clusters.merges.map((m) => ({ ...m, height: r3(m.height) })),
    },
    centrality: cent.map((c, i) => ({
      degree: c.degree,
      mstDegree: mstDegree[i],
      strength: r3(c.strength),
      eigenvector: r3(c.eigenvector),
      betweenness: r3(c.betweenness),
      closeness: r3(c.closeness),
      hub: r3(c.hub),
      role: c.role,
    })),
    edges: {
      mst: mst.map((e) => toOut(e, true)),
      tmfg: filtered.map((e) => toOut(e)),
      partial: partialEdges.map((e) => toOut(e)),
      threshold: threshold.map((e) => toOut(e)),
      leads,
    },
    thresholds: { link: r3(linkThreshold), partial: partialThreshold === null ? null : r3(partialThreshold), partialTest },
    spectrum: {
      eigenvalues: sp.eigenvalues.map(r3),
      q: r3(sp.q),
      sigma2: r3(sp.sigma2),
      lambdaPlus: r3(sp.lambdaPlus),
      lambdaMinus: r3(sp.lambdaMinus),
      signal: sp.signal,
      marketShare: r3(sp.marketShare),
      absorption: r3(sp.absorption),
      effectiveRank: Math.round(sp.effectiveRank * 10) / 10,
      loadings: sp.topVectors.map((v) => v.map(r3)),
      mp: marchenkoPasturCurve(sp.q, sp.sigma2).map((p) => ({ x: r3(p.x), y: r3(p.y) })),
    },
    stats: {
      avgCorr: r3(n > 1 ? off / pairs : 0),
      treeLength: r3(treeLength(mst)),
      mstReliability: r3(mst.length ? mst.reduce((s, e) => s + (reliability.get(edgeKey(e.i, e.j)) ?? 0), 0) / mst.length : 0),
    },
  };
}

export function dynamics(panel: Panel, window = 60) {
  const raw = panel.returns.map((r) => winsorize(r));
  const resid = panel.returns.map((r) => winsorize(residuals(r, panel.benchmark).resid));
  const regime = rollingRegime(raw, resid, panel.dates, window, 5);
  return {
    ...regime,
    absorptionPercentile: Math.round(regime.absorptionPercentile),
    corrPercentile: Math.round(regime.corrPercentile),
    absorptionShift: r3(regime.absorptionShift),
    points: regime.points.map((p) => ({
      date: p.date,
      avgCorr: r3(p.avgCorr),
      avgResidualCorr: r3(p.avgResidualCorr),
      absorption: r3(p.absorption),
      marketShare: r3(p.marketShare),
      treeLength: r3(p.treeLength),
      survival: p.survival === null ? null : r3(p.survival),
    })),
  };
}

export function pair(panel: Panel, a: string, b: string, days: number, window = 60) {
  const ia = panel.ids.indexOf(a);
  const ib = panel.ids.indexOf(b);
  if (ia < 0 || ib < 0 || ia === ib) return null;
  const resid = (i: number) => winsorize(residuals(panel.returns[i], panel.benchmark).resid);
  const ra = resid(ia);
  const rb = resid(ib);
  const rawA = winsorize(panel.returns[ia]);
  const rawB = winsorize(panel.returns[ib]);
  const rollRaw = rollingPairCorrelation(rawA, rawB, window);
  const rollRes = rollingPairCorrelation(ra, rb, window);
  const dates = panel.dates.map((d) => new Date(d * 1000).toISOString().slice(0, 10));
  const series = dates
    .map((date, k) => ({ date, raw: rollRaw[k], residual: rollRes[k] }))
    .filter((p) => p.raw !== null)
    .map((p) => ({ date: p.date, raw: r3(p.raw!), residual: r3(p.residual!) }));
  const ccf = crossCorrelation(ra.slice(-days), rb.slice(-days), 5).map((c) => ({ lag: c.lag, r: r3(c.r) }));
  const n = Math.min(days, ra.length);
  return {
    a,
    b,
    window,
    days: n,
    /** ±band for one lag at 95% under no correlation. */
    ccfBand: r3(1.96 / Math.sqrt(n)),
    series,
    ccf,
  };
}
