export interface MarketIndex {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: number[];
}

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  pe?: number;
  marketCap?: string;
  roe?: number;
  debtToEquity?: number;
  revenueGrowth?: number;
  rsi?: number;
  macdSignal?: 'bullish' | 'bearish' | 'any';
  emaAbove?: string;
  sector?: string;
  high52w?: number;
}

export interface FearGreedData {
  value: number;
  valueClassification: string;
  timestamp: string;
}

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  imageUrl: string;
  publishedAt: string;
  timeAgo: string;
}

export interface PortfolioHolding {
  id?: string;
  user_id?: string;
  symbol: string;
  qty: number;
  buy_price: number;
  buy_date: string;
  sector: string;
  currentPrice?: number;
}

export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  bestPerformer: { symbol: string; pnl: number };
  worstPerformer: { symbol: string; pnl: number };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y';
export type MarketCapCategory = 'Small' | 'Mid' | 'Large' | 'Any';
