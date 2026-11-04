/**
 * Correlation estimators.
 *
 * A sample correlation matrix of N stocks over T days carries N(N-1)/2
 * numbers estimated from N·T observations; with T only a few times N most of
 * its fine structure is noise. Two standard cures are offered:
 *
 * - Ledoit–Wolf (2003, "Honey, I shrunk the sample covariance matrix"):
 *   shrink towards a constant-correlation target with the analytically
 *   optimal intensity δ*.
 * - Random-matrix filtering (Laloux, Cizeau, Bouchaud & Potters 1999;
 *   Plerou et al. 2002): eigenvalues inside the Marchenko–Pastur noise band
 *   are flattened to their average, keeping only the eigen-directions that
 *   stand out from pure noise.
 */
import { Matrix, correlationMatrix, fromEigen, mean, standardize, symmetricEigen, toCorrelation, zeros } from "./linalg";

export type Estimator = "lw" | "rmt" | "sample";

export interface Spectrum {
  /** Eigenvalues of the sample correlation matrix, largest first. */
  eigenvalues: number[];
  /** N/T. */
  q: number;
  /** Noise variance after removing the market mode, Plerou et al. */
  sigma2: number;
  lambdaMinus: number;
  lambdaPlus: number;
  /** Eigenvalues above the noise band. The first is usually the market mode. */
  signal: number;
  /** Share of total variance in the largest eigenvalue. */
  marketShare: number;
  /** Absorption ratio (Kritzman et al. 2011): variance share of the top ⌈N/5⌉ eigenvectors. */
  absorption: number;
  /** exp(Shannon entropy of the normalised spectrum): the effective number of independent bets. */
  effectiveRank: number;
  /** Loadings of the top three eigenvectors (sign fixed so the largest loading is positive). */
  topVectors: number[][];
}

export interface Estimate {
  estimator: Estimator;
  corr: Matrix;
  /** Ledoit–Wolf shrinkage intensity δ* (0 = sample, 1 = target). Null for other estimators. */
  shrinkage: number | null;
  spectrum: Spectrum;
}

/** Ledoit–Wolf shrinkage of the correlation matrix towards the constant-correlation target. */
export function ledoitWolf(series: number[][]): { corr: Matrix; shrinkage: number; sample: Matrix } {
  const x = series.map(standardize); // unit population variance, so S = R
  const n = x.length;
  const t = n ? x[0].length : 0;
  const s = correlationMatrix(series);
  if (n < 2 || t < 3) return { corr: s, shrinkage: 0, sample: s };

  let rbar = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) rbar += s[i][j];
  rbar /= (n * (n - 1)) / 2;

  const sq = x.map((row) => row.map((v) => v * v - 1)); // x_it² - s_ii
  let piHat = 0;
  let rhoHat = 0;
  let gammaHat = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let pij = 0;
      let thII = 0; // θ_ii,ij
      let thJJ = 0; // θ_jj,ij
      for (let k = 0; k < t; k++) {
        const dev = x[i][k] * x[j][k] - s[i][j];
        pij += dev * dev;
        if (i !== j) {
          thII += sq[i][k] * dev;
          thJJ += sq[j][k] * dev;
        }
      }
      pij /= t;
      if (i === j) {
        piHat += pij;
        rhoHat += pij;
      } else {
        piHat += 2 * pij;
        rhoHat += 2 * (rbar / 2) * ((thII + thJJ) / t);
        gammaHat += 2 * (rbar - s[i][j]) ** 2;
      }
    }
  }
  const kappa = gammaHat > 0 ? (piHat - rhoHat) / gammaHat : 0;
  const delta = Math.max(0, Math.min(1, kappa / t));
  const corr = s.map((row, i) => row.map((v, j) => (i === j ? 1 : delta * rbar + (1 - delta) * v)));
  return { corr, shrinkage: delta, sample: s };
}

/** Marchenko–Pastur noise band and summary statistics of a correlation spectrum. */
export function describeSpectrum(eigenvalues: number[], vectors: number[][], t: number): Spectrum {
  const n = eigenvalues.length;
  const q = n / Math.max(t, 1);
  const total = eigenvalues.reduce((s, v) => s + Math.max(v, 0), 0) || 1;
  const plain = (1 + Math.sqrt(q)) ** 2;
  // If a market mode sits above the band, the noise only carries the variance it leaves behind.
  const sigma2 = eigenvalues[0] > plain ? Math.max(1 - eigenvalues[0] / n, 0.05) : 1;
  const lambdaPlus = sigma2 * (1 + Math.sqrt(q)) ** 2;
  const lambdaMinus = q < 1 ? sigma2 * (1 - Math.sqrt(q)) ** 2 : 0;
  const signal = eigenvalues.filter((v) => v > lambdaPlus).length;
  const k = Math.max(1, Math.ceil(n / 5));
  const absorption = eigenvalues.slice(0, k).reduce((s, v) => s + v, 0) / total;
  const p = eigenvalues.map((v) => Math.max(v, 0) / total).filter((v) => v > 0);
  const effectiveRank = Math.exp(-p.reduce((s, v) => s + v * Math.log(v), 0));
  return {
    eigenvalues,
    q,
    sigma2,
    lambdaMinus,
    lambdaPlus,
    signal,
    marketShare: eigenvalues[0] / total,
    absorption,
    effectiveRank,
    topVectors: vectors.slice(0, 3),
  };
}

/** Marchenko–Pastur density for the noise band, sampled for plotting. */
export function marchenkoPasturCurve(q: number, sigma2: number, points = 60): Array<{ x: number; y: number }> {
  const lp = sigma2 * (1 + Math.sqrt(q)) ** 2;
  const lm = sigma2 * (1 - Math.sqrt(q)) ** 2;
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= points; i++) {
    const x = lm + ((lp - lm) * i) / points;
    const inside = (lp - x) * (x - lm);
    const y = x > 0 && inside > 0 ? Math.sqrt(inside) / (2 * Math.PI * sigma2 * q * x) : 0;
    out.push({ x, y });
  }
  return out;
}

/** Random-matrix filtering: flatten eigenvalues inside the noise band to their mean (trace preserved). */
export function rmtClip(sample: Matrix, t: number): { corr: Matrix; spectrum: Spectrum } {
  const eig = symmetricEigen(sample);
  const spectrum = describeSpectrum(eig.values, eig.vectors, t);
  const noise = eig.values.filter((v) => v <= spectrum.lambdaPlus);
  const flat = noise.length ? mean(noise) : 0;
  const cleaned = eig.values.map((v) => (v > spectrum.lambdaPlus ? v : flat));
  return { corr: toCorrelation(fromEigen(cleaned, eig.vectors)), spectrum };
}

/** Correlation matrix by the chosen estimator, plus the spectrum of the sample matrix. */
export function estimate(series: number[][], estimator: Estimator): Estimate {
  const t = series[0]?.length ?? 0;
  if (estimator === "lw") {
    const lw = ledoitWolf(series);
    const eig = symmetricEigen(lw.sample);
    return { estimator, corr: lw.corr, shrinkage: lw.shrinkage, spectrum: describeSpectrum(eig.values, eig.vectors, t) };
  }
  const sample = correlationMatrix(series);
  if (estimator === "rmt") {
    const r = rmtClip(sample, t);
    return { estimator, corr: r.corr, shrinkage: null, spectrum: r.spectrum };
  }
  const eig = symmetricEigen(sample);
  return { estimator, corr: sample, shrinkage: null, spectrum: describeSpectrum(eig.values, eig.vectors, t) };
}

/**
 * Partial correlations ρ_ij·rest = −P_ij / √(P_ii P_jj), P the precision matrix.
 * Eigenvalues are floored so a singular sample matrix (T < N) still inverts.
 */
export function partialCorrelations(corr: Matrix): Matrix {
  const n = corr.length;
  const eig = symmetricEigen(corr);
  const floor = Math.max(1e-3, (eig.values[0] || 1) * 1e-4);
  const precision = fromEigen(
    eig.values.map((v) => 1 / Math.max(v, floor)),
    eig.vectors
  );
  const out = zeros(n);
  for (let i = 0; i < n; i++) {
    out[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const v = -precision[i][j] / Math.sqrt(precision[i][i] * precision[j][j]);
      out[i][j] = out[j][i] = Math.max(-1, Math.min(1, v));
    }
  }
  return out;
}

/** Mantegna (1999) metric distance d = √(2(1 − ρ)): 0 for identical, 2 for perfectly opposite. */
export function distanceMatrix(corr: Matrix): Matrix {
  return corr.map((row) => row.map((r) => Math.sqrt(Math.max(0, 2 * (1 - r)))));
}
