import type { CorrelationLead, EventStudy } from "../../types";

export type Market = "US" | "IN";
export type Basis = "residual" | "raw";
export type Estimator = "lw" | "rmt" | "sample";
export type NetworkKind = "mst" | "tmfg" | "partial" | "threshold" | "leads";
export type Role = "core" | "bridge" | "periphery" | "mid";

export interface WebNode {
  id: string;
  name: string;
  sector: string;
  beta: number;
  cluster: number;
  mktCap: number | null;
  /** Loadings on the top three eigenvectors of the sample correlation matrix. */
  loadings: number[];
  degree: number;
  mstDegree: number;
  strength: number;
  eigenvector: number;
  betweenness: number;
  closeness: number;
  hub: number;
  role: Role;
}

export interface WebEdge {
  source: string;
  target: string;
  value: number;
  distance: number;
  reliability?: number;
}

export interface Structure {
  market: Market;
  days: number;
  sessions: number;
  basis: Basis;
  estimator: Estimator;
  shrinkage: number | null;
  missing: string[];
  asOf: string;
  ids: string[];
  nodes: WebNode[];
  order: string[];
  corr: number[][];
  partial: number[][];
  clusters: {
    k: number;
    silhouette: number;
    labels: number[];
    scan: Array<{ k: number; silhouette: number }>;
  };
  edges: {
    mst: WebEdge[];
    tmfg: WebEdge[];
    partial: WebEdge[];
    threshold: WebEdge[];
    leads: CorrelationLead[];
  };
  thresholds: { link: number; partial: number | null; partialTest: "fisher" | "ranked" };
  spectrum: {
    eigenvalues: number[];
    q: number;
    sigma2: number;
    lambdaPlus: number;
    lambdaMinus: number;
    signal: number;
    marketShare: number;
    absorption: number;
    effectiveRank: number;
    mp: Array<{ x: number; y: number }>;
  };
  stats: { avgCorr: number; treeLength: number; mstReliability: number };
  error?: string;
}

export interface RegimePoint {
  date: string;
  avgCorr: number;
  avgResidualCorr: number;
  absorption: number;
  marketShare: number;
  treeLength: number;
  survival: number | null;
}

export interface Dynamics {
  window: number;
  step: number;
  points: RegimePoint[];
  absorptionPercentile: number;
  corrPercentile: number;
  absorptionShift: number;
  state: "coupled" | "normal" | "dispersed";
  error?: string;
}

export interface PairAnalysis {
  a: string;
  b: string;
  window: number;
  days: number;
  ccfBand: number;
  series: Array<{ date: string; raw: number; residual: number }>;
  ccf: Array<{ lag: number; r: number }>;
}

export type { CorrelationLead, EventStudy };
