/**
 * Hierarchical clustering on the Mantegna distance matrix.
 *
 * Average linkage (UPGMA) builds the dendrogram. The number of clusters is the
 * cut with the highest mean silhouette, so it comes from the data, not a
 * preset. The dendrogram's leaf order seriates the heatmap so that blocks of
 * correlated stocks sit next to each other.
 */
import { Matrix } from "./linalg";

/** One merge: clusters `a` and `b` (ids; leaves are 0..N−1, merges N, N+1, …) joined at `height`. */
export interface Merge {
  a: number;
  b: number;
  height: number;
  size: number;
}

export function averageLinkage(dist: Matrix): Merge[] {
  const n = dist.length;
  const members = new Map<number, number[]>();
  for (let i = 0; i < n; i++) members.set(i, [i]);
  // Inter-cluster average distances, keyed by active cluster id.
  const d = new Map<number, Map<number, number>>();
  for (let i = 0; i < n; i++) {
    const row = new Map<number, number>();
    for (let j = 0; j < n; j++) if (j !== i) row.set(j, dist[i][j]);
    d.set(i, row);
  }
  const merges: Merge[] = [];
  let next = n;
  while (members.size > 1) {
    let best = Infinity;
    let ba = -1;
    let bb = -1;
    for (const [a, row] of d) {
      for (const [b, v] of row) {
        if (a < b && (v < best || (v === best && (a < ba || (a === ba && b < bb))))) {
          best = v;
          ba = a;
          bb = b;
        }
      }
    }
    const ma = members.get(ba)!;
    const mb = members.get(bb)!;
    const merged = [...ma, ...mb];
    const row = new Map<number, number>();
    for (const [c, mc] of members) {
      if (c === ba || c === bb) continue;
      const v = (d.get(ba)!.get(c)! * ma.length + d.get(bb)!.get(c)! * mb.length) / merged.length;
      row.set(c, v);
      d.get(c)!.delete(ba);
      d.get(c)!.delete(bb);
      d.get(c)!.set(next, v);
    }
    d.delete(ba);
    d.delete(bb);
    d.set(next, row);
    members.delete(ba);
    members.delete(bb);
    members.set(next, merged);
    merges.push({ a: ba, b: bb, height: best, size: merged.length });
    next++;
  }
  return merges;
}

/** Leaf order from a depth-first walk of the dendrogram (tighter sub-cluster first). */
export function leafOrder(n: number, merges: Merge[]): number[] {
  if (n === 0) return [];
  const children = new Map<number, [number, number]>();
  const size = new Map<number, number>();
  merges.forEach((m, k) => {
    children.set(n + k, [m.a, m.b]);
    size.set(n + k, m.size);
  });
  const out: number[] = [];
  const walk = (id: number) => {
    const ch = children.get(id);
    if (!ch) {
      out.push(id);
      return;
    }
    const [a, b] = ch;
    const sa = size.get(a) ?? 1;
    const sb = size.get(b) ?? 1;
    if (sa >= sb) {
      walk(a);
      walk(b);
    } else {
      walk(b);
      walk(a);
    }
  };
  walk(n + merges.length - 1);
  return out;
}

/** Labels 0..k−1 from cutting the dendrogram into k clusters, numbered by size (largest first). */
export function cutTree(n: number, merges: Merge[], k: number): number[] {
  const parent = Array.from({ length: 2 * n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let m = 0; m < n - k; m++) {
    const id = n + m;
    parent[find(merges[m].a)] = id;
    parent[find(merges[m].b)] = id;
  }
  const roots = Array.from({ length: n }, (_, i) => find(i));
  const counts = new Map<number, number>();
  roots.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const ranked = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a - b);
  return roots.map((r) => ranked.indexOf(r));
}

/** Mean silhouette width (Rousseeuw 1987); singletons score 0. */
export function silhouette(dist: Matrix, labels: number[]): number {
  const n = labels.length;
  const k = Math.max(...labels) + 1;
  if (k < 2 || k >= n) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const sums = new Array(k).fill(0);
    const counts = new Array(k).fill(0);
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      sums[labels[j]] += dist[i][j];
      counts[labels[j]]++;
    }
    const own = labels[i];
    if (counts[own] === 0) continue;
    const a = sums[own] / counts[own];
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== own && counts[c]) b = Math.min(b, sums[c] / counts[c]);
    total += (b - a) / Math.max(a, b);
  }
  return total / n;
}

export interface Clustering {
  merges: Merge[];
  order: number[];
  labels: number[];
  k: number;
  silhouette: number;
  /** Silhouette for every k tried, for the "why this many clusters" view. */
  scan: Array<{ k: number; silhouette: number }>;
}

export function clusterStocks(dist: Matrix, maxK = 7): Clustering {
  const n = dist.length;
  const merges = averageLinkage(dist);
  const order = leafOrder(n, merges);
  if (n < 4) return { merges, order, labels: new Array(n).fill(0), k: 1, silhouette: 0, scan: [] };
  const scan: Array<{ k: number; silhouette: number }> = [];
  let best = { k: 1, s: -Infinity, labels: new Array(n).fill(0) };
  for (let k = 2; k <= Math.min(maxK, n - 1); k++) {
    const labels = cutTree(n, merges, k);
    const s = silhouette(dist, labels);
    scan.push({ k, silhouette: s });
    if (s > best.s + 1e-9) best = { k, s, labels };
  }
  return { merges, order, labels: best.labels, k: best.k, silhouette: best.s, scan };
}
