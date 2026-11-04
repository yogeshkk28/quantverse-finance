/** Where a ticker's price came from. "mock" means sample data, never live. */
export type DataSource = "finnhub" | "yahoo" | "mock";

export interface Ticker {
  id: string;
  name: string;
  price: number;
  chg: number;
  volSurge: number;
  /** null when no fundamentals source covers this stock (e.g. NSE on free tiers). */
  pe: number | null;
  mktCap: string;
  mktCapValue: number | null;
  rsi: number;
  roe: number | null;
  sector: string;
  beta: number;
  macdCross: boolean;
  market: "US" | "IN";
  currency: string;
  source: DataSource;
  /** true when the price is not a real-time quote. */
  delayed: boolean;
  fundamentalsSource: "fmp" | "sample" | "none";
  asOf: string;
}

export interface HistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface CorrelationNode {
  id: string;
  name: string;
  sector: string;
  beta: number;
  val: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface CorrelationLink {
  source: string | CorrelationNode;
  target: string | CorrelationNode;
  value: number;
}

/** Stock `source` tends to move one session before `target` (market-adjusted). */
export interface CorrelationLead {
  source: string | CorrelationNode;
  target: string | CorrelationNode;
  value: number;
  reverse: number;
  sensitivity: number;
}

export interface PeerReaction {
  id: string;
  sameDay: number;
  next5: number;
  t: number;
  p: number;
  significant: boolean;
  n: number;
}

export interface EventStudy {
  symbol: string;
  threshold: number;
  sessions: number;
  events: Array<{ date: string; move: number; residual: number }>;
  self: PeerReaction | null;
  peers: PeerReaction[];
}

/** "charts" is the per-symbol chart page at /app/chart/:symbol; "markets" is /app/markets/:category. */
export type ActiveTab = "dashboard" | "screener" | "charts" | "markets" | "movers" | "portfolio" | "signals";

/** Where a screener row's numbers came from. "simulated" is never real market data. */
export type ScreenerSource = "live" | "partial" | "simulated";

/**
 * One stock in the Screener (`/api/screener`). Every metric is null when no source
 * covered it. Percentages are in percent units (5 = 5%).
 */
export interface ScreenerRow {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  market: "US" | "IN";
  currency: string;
  source: ScreenerSource;

  // Price & size
  price: number | null;
  chg: number | null;
  mktCap: number | null;
  mktCapUsd: number | null;
  volume: number | null;
  avgVolume: number | null;
  relVolume: number | null;
  turnoverUsd: number | null;

  // Valuation
  pe: number | null;
  fwdPe: number | null;
  pb: number | null;
  divYield: number | null;
  eps: number | null;
  epsGrowth: number | null;
  analyst: number | null;

  // Performance
  perfW1: number | null;
  perfM1: number | null;
  perfM3: number | null;
  perfM6: number | null;
  perfYtd: number | null;
  perfY1: number | null;

  // Technicals
  rsi: number | null;
  sma50Dist: number | null;
  sma200Dist: number | null;
  high52: number | null;
  low52: number | null;
  fromHigh52: number | null;
  fromLow52: number | null;
  macdCross: boolean | null;
  goldenCross: boolean | null;

  // Risk
  beta: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  sharpe: number | null;

  // Factor scores, 0–100 percentile within the stock's market
  scoreValue: number | null;
  scoreMomentum: number | null;
  scoreStability: number | null;
  scoreGrowth: number | null;
  scoreComposite: number | null;

  /** Up to 64 closes over the past year, oldest first, for sparklines. */
  spark: number[];
}

export interface ScreenerResponse {
  rows: ScreenerRow[];
  /** "building" while the first load is still filling in. */
  status: "building" | "ready";
  progress: number;
  mode: "live" | "simulated";
  updatedAt: string;
  universe: number;
  coverage: { quotes: number; history: number };
  usdInr: number;
}
