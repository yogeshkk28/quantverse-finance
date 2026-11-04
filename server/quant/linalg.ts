/**
 * Small dense linear-algebra kit for the Correlation Web.
 *
 * Matrices are plain `number[][]` (row-major). The universe is tens of stocks,
 * not thousands, so a cyclic Jacobi eigensolver is exact enough and fast enough.
 */

export type Matrix = number[][];

export const zeros = (n: number, m = n): Matrix => Array.from({ length: n }, () => new Array(m).fill(0));

export const identity = (n: number): Matrix => {
  const out = zeros(n);
  for (let i = 0; i < n; i++) out[i][i] = 1;
  return out;
};

export const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);

/** Population standardisation (divide by T, not T-1), so the sample covariance of the output has a unit diagonal. */
export function standardize(xs: number[]): number[] {
  const m = mean(xs);
  const sd = Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length);
  return sd > 0 ? xs.map((v) => (v - m) / sd) : xs.map(() => 0);
}

/** Pearson correlation matrix of the rows of `series` (each row is one asset's return series). */
export function correlationMatrix(series: number[][]): Matrix {
  const z = series.map(standardize);
  const n = z.length;
  const t = n ? z[0].length : 0;
  const out = identity(n);
  for (let i = 0; i < n; i++) {
    const zi = z[i];
    for (let j = i + 1; j < n; j++) {
      const zj = z[j];
      let s = 0;
      for (let k = 0; k < t; k++) s += zi[k] * zj[k];
      const r = Math.max(-1, Math.min(1, s / t));
      out[i][j] = r;
      out[j][i] = r;
    }
  }
  return out;
}

export interface Eigen {
  /** Eigenvalues, largest first. */
  values: number[];
  /** vectors[k] is the unit eigenvector belonging to values[k]. */
  vectors: number[][];
}

/**
 * Eigen-decomposition of a real symmetric matrix by cyclic Jacobi rotations.
 * Converges quadratically; ~6–10 sweeps for the matrix sizes used here.
 */
export function symmetricEigen(input: Matrix, maxSweeps = 60): Eigen {
  const n = input.length;
  const a = new Float64Array(n * n);
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) a[i * n + j] = (input[i][j] + input[j][i]) / 2;
    v[i * n + i] = 1;
  }

  let scale = 0;
  for (let i = 0; i < n * n; i++) scale += a[i] * a[i];
  const tol = 1e-22 * Math.max(scale, 1e-300);

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q] ** 2;
    if (off <= tol) break;

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q];
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        // A <- A J (columns p, q)
        for (let k = 0; k < n; k++) {
          const akp = a[k * n + p];
          const akq = a[k * n + q];
          a[k * n + p] = c * akp - s * akq;
          a[k * n + q] = s * akp + c * akq;
        }
        // A <- J^T A (rows p, q)
        for (let k = 0; k < n; k++) {
          const apk = a[p * n + k];
          const aqk = a[q * n + k];
          a[p * n + k] = c * apk - s * aqk;
          a[q * n + k] = s * apk + c * aqk;
        }
        // V <- V J
        for (let k = 0; k < n; k++) {
          const vkp = v[k * n + p];
          const vkq = v[k * n + q];
          v[k * n + p] = c * vkp - s * vkq;
          v[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => a[y * n + y] - a[x * n + x]);
  return {
    values: order.map((i) => a[i * n + i]),
    vectors: order.map((i) => {
      const vec = Array.from({ length: n }, (_, k) => v[k * n + i]);
      // Fix the sign so loadings sum to a positive number (a market mode reads as all-positive);
      // fall back to the largest component when the sum is ~0. Stable output between runs.
      const sum = vec.reduce((s, x) => s + x, 0);
      let big = 0;
      for (const x of vec) if (Math.abs(x) > Math.abs(big)) big = x;
      const flip = Math.abs(sum) > 1e-9 ? sum < 0 : big < 0;
      return flip ? vec.map((x) => -x) : vec;
    }),
  };
}

/** V diag(values) V^T. */
export function fromEigen(values: number[], vectors: number[][]): Matrix {
  const n = vectors.length ? vectors[0].length : 0;
  const out = zeros(n);
  for (let k = 0; k < values.length; k++) {
    const lam = values[k];
    const vec = vectors[k];
    for (let i = 0; i < n; i++) {
      const vi = lam * vec[i];
      if (vi === 0) continue;
      for (let j = i; j < n; j++) out[i][j] += vi * vec[j];
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) out[i][j] = out[j][i];
  return out;
}

/** Rescale a covariance-like matrix to unit diagonal. */
export function toCorrelation(m: Matrix): Matrix {
  const d = m.map((row, i) => Math.sqrt(Math.max(row[i], 1e-12)));
  return m.map((row, i) => row.map((v, j) => (i === j ? 1 : Math.max(-1, Math.min(1, v / (d[i] * d[j]))))));
}

/**
 * Eigenvalues of the correlation matrix of `series` without forming an N×N
 * matrix when T < N: the non-zero spectrum of Z Zᵀ/T equals that of Zᵀ Z/T.
 */
export function correlationSpectrum(series: number[][]): number[] {
  const n = series.length;
  const t = n ? series[0].length : 0;
  if (n <= t) return symmetricEigen(correlationMatrix(series)).values;
  const z = series.map(standardize);
  const gram = zeros(t);
  for (let a = 0; a < t; a++) {
    for (let b = a; b < t; b++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += z[i][a] * z[i][b];
      gram[a][b] = s / t;
      gram[b][a] = s / t;
    }
  }
  const vals = symmetricEigen(gram).values;
  return [...vals, ...new Array(n - t).fill(0)];
}
