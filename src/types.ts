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

export type ActiveTab = "dashboard" | "screener" | "charts" | "portfolio" | "signals";
