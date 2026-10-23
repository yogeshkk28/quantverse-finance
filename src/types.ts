export interface Ticker {
  id: string;
  name: string;
  price: number;
  chg: number;
  volSurge: number;
  pe: number;
  mktCap: string;
  mktCapValue: number;
  rsi: number;
  roe: number;
  sector: string;
  beta: number;
  macdCross: boolean;
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
