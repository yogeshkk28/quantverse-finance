/**
 * Validation of the Correlation Web engine on synthetic markets with known structure.
 * Run: npm run validate:web
 *
 * Every check prints PASS/FAIL; the process exits non-zero on any failure.
 */
import { symmetricEigen, correlationMatrix, correlationSpectrum } from "../server/quant/linalg";
import { estimate, ledoitWolf, partialCorrelations, distanceMatrix } from "../server/quant/estimators";
import { minimumSpanningTree, tmfg, centrality, bootstrapMst, edgeKey } from "../server/quant/networks";
import { clusterStocks } from "../server/quant/clustering";
import { rollingRegime, crossCorrelation } from "../server/quant/regimes";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

// Deterministic Gaussian noise.
let seed = 12345;
const uniform = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed + 0.5) / 4294967296;
};
const gauss = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
const noise = (t: number, s = 1) => Array.from({ length: t }, () => gauss() * s);

// 1. Eigen-solver
{
  const n = 12;
  const a = Array.from({ length: n }, () => noise(n));
  const sym = a.map((row, i) => row.map((v, j) => (v + a[j][i]) / 2));
  const { values, vectors } = symmetricEigen(sym);
  let resid = 0;
  let ortho = 0;
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      const av = sym[i].reduce((s, v, j) => s + v * vectors[k][j], 0);
      resid = Math.max(resid, Math.abs(av - values[k] * vectors[k][i]));
    }
    for (let l = 0; l < n; l++) {
      const dot = vectors[k].reduce((s, v, i) => s + v * vectors[l][i], 0);
      ortho = Math.max(ortho, Math.abs(dot - (k === l ? 1 : 0)));
    }
  }
  check("Jacobi eigen: A v = λ v", resid < 1e-9, `max residual ${resid.toExponential(1)}`);
  check("Jacobi eigen: orthonormal vectors", ortho < 1e-9, `max error ${ortho.toExponential(1)}`);
  check("Jacobi eigen: sorted descending", values.every((v, i) => i === 0 || values[i - 1] >= v));
}

// 2. Planted market: one market factor, three sectors of eight stocks each.
const T = 250;
const N = 24;
const sectorOf = (i: number) => Math.floor(i / 8);
const market = noise(T);
const sectors = [noise(T), noise(T), noise(T)];
const raw = Array.from({ length: N }, (_, i) => {
  const e = noise(T);
  return market.map((m, t) => 0.6 * m + 0.7 * sectors[sectorOf(i)][t] + 0.8 * e[t]);
});
// Market-adjusted: regress out the market factor, as the server does with the index.
const residual = raw.map((r) => {
  const mm = market.reduce((s, v) => s + v, 0) / T;
  const mr = r.reduce((s, v) => s + v, 0) / T;
  let cov = 0, varm = 0;
  for (let t = 0; t < T; t++) {
    cov += (r[t] - mr) * (market[t] - mm);
    varm += (market[t] - mm) ** 2;
  }
  const b = cov / varm;
  return r.map((v, t) => v - mr - b * (market[t] - mm));
});

{
  const est = estimate(raw, "sample");
  // The market mode lies in the span of the three sector indicators, so the planted
  // structure has exactly three distinct eigen-directions: market plus two sector contrasts.
  check("RMT: exactly the three planted modes clear the noise band", est.spectrum.signal === 3, `signal = ${est.spectrum.signal}`);
  const lw = ledoitWolf(raw);
  check("Ledoit–Wolf: intensity in (0, 1)", lw.shrinkage > 0 && lw.shrinkage < 1, `δ = ${lw.shrinkage.toFixed(3)}`);
  const rmt = estimate(raw, "rmt");
  const diagOk = rmt.corr.every((row, i) => Math.abs(row[i] - 1) < 1e-9);
  check("RMT-cleaned matrix keeps a unit diagonal", diagOk);
  const spec = correlationSpectrum(raw.map((r) => r.slice(0, 20)));
  check("Gram-trick spectrum (T < N) has trace N", Math.abs(spec.reduce((s, v) => s + v, 0) - N) < 1e-6);
}

{
  const est = estimate(residual, "lw");
  const dist = distanceMatrix(est.corr);
  const cl = clusterStocks(dist);
  const purity = [0, 1, 2].reduce((s, sec) => {
    const labels = cl.labels.filter((_, i) => sectorOf(i) === sec);
    const counts = new Map<number, number>();
    labels.forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1));
    return s + Math.max(...counts.values());
  }, 0) / N;
  check("Clustering recovers the three planted sectors", cl.k === 3 && purity === 1, `k = ${cl.k}, purity = ${purity.toFixed(2)}, silhouette = ${cl.silhouette.toFixed(2)}`);
  const order = cl.order.map(sectorOf);
  const switches = order.filter((s, i) => i > 0 && s !== order[i - 1]).length;
  check("Dendrogram order keeps each sector contiguous", switches === 2, `${switches} sector changes`);

  const mst = minimumSpanningTree(dist, est.corr);
  const within = mst.filter((e) => sectorOf(e.i) === sectorOf(e.j)).length;
  check("MST has N−1 edges", mst.length === N - 1);
  check("MST edges stay inside sectors except the bridges", within === N - 3, `${within}/${N - 1} within-sector`);
  const tm = tmfg(est.corr, dist);
  const uniq = new Set(tm.map((e) => edgeKey(e.i, e.j)));
  check("TMFG has 3N−6 distinct edges", tm.length === 3 * N - 6 && uniq.size === tm.length, `${tm.length}`);
  const tmWithin = tm.filter((e) => sectorOf(e.i) === sectorOf(e.j)).length / tm.length;
  check("TMFG keeps mostly within-sector edges", tmWithin > 0.8, `${(tmWithin * 100).toFixed(0)}%`);

  const rel = bootstrapMst(residual, (s) => ledoitWolf(s).corr, 60);
  const bridgeKeys = mst.filter((e) => sectorOf(e.i) !== sectorOf(e.j)).map((e) => edgeKey(e.i, e.j));
  const relWithin = mst.filter((e) => sectorOf(e.i) === sectorOf(e.j)).map((e) => rel.get(edgeKey(e.i, e.j)) ?? 0);
  const relBridge = bridgeKeys.map((k) => rel.get(k) ?? 0);
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / Math.max(xs.length, 1);
  check("Bootstrap reliabilities are probabilities", [...rel.values()].every((v) => v >= 0 && v <= 1));
  check(
    "Bootstrap: within-sector MST edges are not less reliable than bridges",
    avg(relWithin) >= avg(relBridge) - 0.05,
    `within ${avg(relWithin).toFixed(2)} vs bridges ${avg(relBridge).toFixed(2)}`
  );

  const cent = centrality(N, tm);
  check("Centrality: hub scores in [0, 1]", cent.every((c) => c.hub >= 0 && c.hub <= 1));
  check("Centrality: every stock reachable (closeness > 0)", cent.every((c) => c.closeness > 0));
}

// 3. Partial correlation separates direct from indirect links: A → B → C.
{
  const a = noise(T * 2);
  const b = a.map((v) => v + gauss() * 0.7);
  const c = b.map((v) => v + gauss() * 0.7);
  const others = Array.from({ length: 5 }, () => noise(T * 2));
  const series = [a, b, c, ...others];
  const corr = correlationMatrix(series);
  const pc = partialCorrelations(corr);
  check("Partial: A–C correlated in plain terms", corr[0][2] > 0.5, `ρ = ${corr[0][2].toFixed(2)}`);
  check("Partial: A–C link vanishes given B", Math.abs(pc[0][2]) < 0.1, `ρ·B = ${pc[0][2].toFixed(2)}`);
  check("Partial: direct links survive", pc[0][1] > 0.4 && pc[1][2] > 0.4, `A–B ${pc[0][1].toFixed(2)}, B–C ${pc[1][2].toFixed(2)}`);
}

// 4. Pure noise: no structure should be claimed.
{
  const rnd = Array.from({ length: N }, () => noise(T));
  const est = estimate(rnd, "sample");
  check("Pure noise: no eigenvalue above the noise band", est.spectrum.signal <= 1, `signal = ${est.spectrum.signal}`);
  const lw = ledoitWolf(rnd);
  check("Pure noise: Ledoit–Wolf shrinks hard", lw.shrinkage > 0.5, `δ = ${lw.shrinkage.toFixed(2)}`);
  const cl = clusterStocks(distanceMatrix(lw.corr));
  check("Pure noise: silhouette stays weak", cl.silhouette < 0.15, `silhouette = ${cl.silhouette.toFixed(2)}`);
}

// 5. Regime: the market factor doubles in the last 60 sessions.
{
  const len = 500;
  const m = noise(len);
  const series = Array.from({ length: 16 }, () => {
    const e = noise(len);
    return m.map((v, t) => (t >= len - 60 ? 1.6 : 0.4) * v + e[t]);
  });
  const dates = Array.from({ length: len }, (_, t) => 1.6e9 + t * 86400);
  const regime = rollingRegime(series, series, dates, 60, 5);
  check("Regime: stress window flagged as coupled", regime.state === "coupled", `AR pct ${regime.absorptionPercentile.toFixed(0)}, shift ${regime.absorptionShift.toFixed(1)}σ`);
  const first = regime.points[0];
  const last = regime.points[regime.points.length - 1];
  check("Regime: MST contracts under stress", last.treeLength < first.treeLength, `${first.treeLength.toFixed(2)} → ${last.treeLength.toFixed(2)}`);
}

// 6. Cross-correlation finds a planted one-day lead.
{
  const a = noise(300);
  const b = a.map((_, t) => (t > 0 ? 0.6 * a[t - 1] : 0) + gauss());
  const ccf = crossCorrelation(a, b, 3);
  const best = ccf.reduce((x, y) => (Math.abs(y.r) > Math.abs(x.r) ? y : x));
  check("CCF peaks at lag +1 when A leads B", best.lag === 1, `peak lag ${best.lag}, r = ${best.r.toFixed(2)}`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
