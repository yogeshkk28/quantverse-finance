/**
 * Filtered correlation networks and node centrality.
 *
 * - MST (Mantegna 1999): the N−1 edges of minimum total distance that connect
 *   every stock. The backbone of the market's dependency structure.
 * - TMFG (Massara, Di Matteo & Aste 2016): a planar, chordal graph with 3N−6
 *   edges built greedily to keep the most correlation. It retains the MST's
 *   hierarchy but also the triangles (cliques) that a tree throws away, and is
 *   the fast O(N²) alternative to the PMFG.
 * - Bootstrap edge reliability (Tumminello et al. 2007): how often an MST edge
 *   reappears when the days are resampled.
 * - Centrality (Pozzi, Di Matteo & Aste 2013): stocks at the centre of the
 *   network carry systemic risk; stocks at the periphery diversify.
 */
import { Matrix } from "./linalg";

export interface Edge {
  i: number;
  j: number;
  /** Correlation of the pair under the active estimator. */
  rho: number;
  /** Mantegna distance √(2(1−ρ)). */
  distance: number;
}

/** Kruskal's algorithm on the complete distance graph. */
export function minimumSpanningTree(dist: Matrix, corr: Matrix): Edge[] {
  const n = dist.length;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  pairs.sort((a, b) => dist[a[0]][a[1]] - dist[b[0]][b[1]]);

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const edges: Edge[] = [];
  for (const [i, j] of pairs) {
    const a = find(i);
    const b = find(j);
    if (a === b) continue;
    parent[a] = b;
    edges.push({ i, j, rho: corr[i][j], distance: dist[i][j] });
    if (edges.length === n - 1) break;
  }
  return edges;
}

/** Triangulated Maximally Filtered Graph with similarity weights w = ρ. */
export function tmfg(corr: Matrix, dist: Matrix): Edge[] {
  const n = corr.length;
  const edge = (i: number, j: number): Edge => ({ i: Math.min(i, j), j: Math.max(i, j), rho: corr[i][j], distance: dist[i][j] });
  if (n < 4) {
    const all: Edge[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) all.push(edge(i, j));
    return all;
  }

  // Seed: the four stocks most strongly tied to the rest (strength over above-average weights).
  let wsum = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) wsum += corr[i][j];
  const wbar = wsum / ((n * (n - 1)) / 2);
  const strength = corr.map((row, i) => row.reduce((s, v, j) => (j !== i && v > wbar ? s + v : s), 0));
  const seed = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => strength[b] - strength[a])
    .slice(0, 4);

  const edges: Edge[] = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) edges.push(edge(seed[a], seed[b]));
  let faces: Array<[number, number, number]> = [
    [seed[0], seed[1], seed[2]],
    [seed[0], seed[1], seed[3]],
    [seed[0], seed[2], seed[3]],
    [seed[1], seed[2], seed[3]],
  ];
  const remaining = new Set(Array.from({ length: n }, (_, i) => i).filter((i) => !seed.includes(i)));

  while (remaining.size) {
    let best = -Infinity;
    let bestV = -1;
    let bestF = -1;
    for (let f = 0; f < faces.length; f++) {
      const [a, b, c] = faces[f];
      for (const v of remaining) {
        const gain = corr[v][a] + corr[v][b] + corr[v][c];
        if (gain > best) {
          best = gain;
          bestV = v;
          bestF = f;
        }
      }
    }
    const [a, b, c] = faces[bestF];
    edges.push(edge(bestV, a), edge(bestV, b), edge(bestV, c));
    faces = faces.filter((_, f) => f !== bestF);
    faces.push([bestV, a, b], [bestV, b, c], [bestV, a, c]);
    remaining.delete(bestV);
  }
  return edges;
}

/** Edges whose |ρ| clears `threshold`. */
export function thresholdGraph(corr: Matrix, dist: Matrix, threshold: number): Edge[] {
  const out: Edge[] = [];
  for (let i = 0; i < corr.length; i++)
    for (let j = i + 1; j < corr.length; j++)
      if (Math.abs(corr[i][j]) >= threshold) out.push({ i, j, rho: corr[i][j], distance: dist[i][j] });
  return out;
}

/** Normalised tree length (Onnela et al. 2003): mean MST distance. It shrinks when the market moves as one. */
export const treeLength = (mst: Edge[]) => (mst.length ? mst.reduce((s, e) => s + e.distance, 0) / mst.length : 0);

export const edgeKey = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`);

/**
 * Moving-block bootstrap of the MST. `estimateCorr` maps resampled series to a
 * correlation matrix. Blocks keep short-range autocorrelation intact.
 */
export function bootstrapMst(
  series: number[][],
  estimateCorr: (s: number[][]) => Matrix,
  replicas: number,
  block = 5,
  seed = 7
): Map<string, number> {
  const t = series[0]?.length ?? 0;
  const counts = new Map<string, number>();
  let state = seed >>> 0;
  const rand = () => {
    // Mulberry32: deterministic, so the same data always gives the same reliabilities.
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  for (let b = 0; b < replicas; b++) {
    const idx: number[] = [];
    while (idx.length < t) {
      const start = Math.floor(rand() * Math.max(t - block + 1, 1));
      for (let k = 0; k < block && idx.length < t; k++) idx.push(start + k);
    }
    const resampled = series.map((row) => idx.map((k) => row[k]));
    const c = estimateCorr(resampled);
    const d = c.map((row) => row.map((r) => Math.sqrt(Math.max(0, 2 * (1 - r)))));
    for (const e of minimumSpanningTree(d, c)) {
      const key = edgeKey(e.i, e.j);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const out = new Map<string, number>();
  for (const [k, v] of counts) out.set(k, v / replicas);
  return out;
}

export interface Centrality {
  degree: number;
  /** Sum of (1+ρ)/2 over incident edges. */
  strength: number;
  eigenvector: number;
  betweenness: number;
  closeness: number;
  /** Mean percentile rank of strength, eigenvector, betweenness and closeness (0–1). */
  hub: number;
  role: "core" | "bridge" | "periphery" | "mid";
}

/** Shortest paths use distance as length; eigenvector centrality uses similarity (1+ρ)/2 as weight. */
export function centrality(n: number, edges: Edge[]): Centrality[] {
  const adj: Array<Array<{ to: number; len: number; w: number }>> = Array.from({ length: n }, () => []);
  for (const e of edges) {
    const w = (1 + e.rho) / 2;
    const len = Math.max(e.distance, 1e-9);
    adj[e.i].push({ to: e.j, len, w });
    adj[e.j].push({ to: e.i, len, w });
  }

  const degree = adj.map((a) => a.length);
  const strength = adj.map((a) => a.reduce((s, x) => s + x.w, 0));

  // Eigenvector centrality by power iteration (shifted by I so bipartite trees still converge).
  let vec = new Array(n).fill(1 / Math.sqrt(n));
  for (let it = 0; it < 300; it++) {
    const next = vec.map((v, i) => v + adj[i].reduce((s, x) => s + x.w * vec[x.to], 0));
    const norm = Math.sqrt(next.reduce((s, v) => s + v * v, 0)) || 1;
    const normed = next.map((v) => v / norm);
    const diff = normed.reduce((s, v, i) => s + Math.abs(v - vec[i]), 0);
    vec = normed;
    if (diff < 1e-10) break;
  }
  const maxVec = Math.max(...vec) || 1;
  const eigenvector = vec.map((v) => v / maxVec);

  // Brandes betweenness with Dijkstra, plus closeness from the same distances.
  const between = new Array(n).fill(0);
  const closeness = new Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const dist = new Array(n).fill(Infinity);
    const sigma = new Array(n).fill(0);
    const preds: number[][] = Array.from({ length: n }, () => []);
    const done = new Array(n).fill(false);
    const stack: number[] = [];
    dist[s] = 0;
    sigma[s] = 1;
    for (;;) {
      let u = -1;
      for (let k = 0; k < n; k++) if (!done[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
      if (u < 0) break;
      done[u] = true;
      stack.push(u);
      for (const { to, len } of adj[u]) {
        const alt = dist[u] + len;
        if (alt < dist[to] - 1e-12) {
          dist[to] = alt;
          sigma[to] = sigma[u];
          preds[to] = [u];
        } else if (Math.abs(alt - dist[to]) <= 1e-12) {
          sigma[to] += sigma[u];
          preds[to].push(u);
        }
      }
    }
    const reach = dist.filter((d, k) => k !== s && d < Infinity);
    closeness[s] = reach.length ? reach.length / reach.reduce((a, b) => a + b, 0) : 0;
    const delta = new Array(n).fill(0);
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of preds[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) between[w] += delta[w];
    }
  }
  const norm = n > 2 ? (n - 1) * (n - 2) : 1; // undirected pairs counted twice above
  const betweenness = between.map((b) => b / norm);

  const pct = (xs: number[]) => {
    const sorted = [...xs].sort((a, b) => a - b);
    return xs.map((x) => (n > 1 ? sorted.filter((v) => v < x).length / (n - 1) : 0.5));
  };
  const ps = pct(strength);
  const pe = pct(eigenvector);
  const pb = pct(betweenness);
  const pc = pct(closeness);
  return Array.from({ length: n }, (_, i) => {
    const hub = (ps[i] + pe[i] + pb[i] + pc[i]) / 4;
    let role: Centrality["role"] = "mid";
    if (hub >= 0.8) role = "core";
    else if (pb[i] >= 0.75 && ps[i] < 0.5) role = "bridge";
    else if (hub <= 0.3) role = "periphery";
    return {
      degree: degree[i],
      strength: strength[i],
      eigenvector: eigenvector[i],
      betweenness: betweenness[i],
      closeness: closeness[i],
      hub,
      role,
    };
  });
}
