import { Ticker } from "../src/types";

// Static high-fidelity quantitative mock ticker database matching front-end schemas
export const tickers: Ticker[] = [
  { id: "NVDA", name: "NVIDIA Corporation", price: 875.28, chg: 2.45, volSurge: 1.8, pe: 74.2, mktCap: "2.18T", mktCapValue: 2180000000000, rsi: 72.4, roe: 38.5, sector: "Technology", beta: 1.62, macdCross: true },
  { id: "AMD", name: "Advanced Micro Devices", price: 164.50, chg: -1.20, volSurge: 0.9, pe: 315.8, mktCap: "265B", mktCapValue: 265000000000, rsi: 48.2, roe: 1.2, sector: "Technology", beta: 1.45, macdCross: false },
  { id: "PLTR", name: "Palantir Technologies", price: 24.18, chg: 5.80, volSurge: 2.4, pe: 68.5, mktCap: "53.4B", mktCapValue: 53400000000, rsi: 61.0, roe: 8.7, sector: "Technology", beta: 1.15, macdCross: true },
  { id: "SNOW", name: "Snowflake Inc.", price: 158.20, chg: -0.45, volSurge: 1.1, pe: 145.2, mktCap: "52.1B", mktCapValue: 52100000000, rsi: 35.8, roe: -4.3, sector: "Technology", beta: 1.12, macdCross: false },
  { id: "CRWD", name: "CrowdStrike Holdings", price: 310.45, chg: 1.15, volSurge: 1.0, pe: 780.2, mktCap: "74.8B", mktCapValue: 74800000000, rsi: 58.4, roe: 4.8, sector: "Technology", beta: 1.30, macdCross: true },
  { id: "AAPL", name: "Apple Inc.", price: 182.52, chg: 0.85, volSurge: 1.2, pe: 28.1, mktCap: "2.85T", mktCapValue: 2850000000000, rsi: 52.1, roe: 154.3, sector: "Technology", beta: 1.05, macdCross: false },
  { id: "MSFT", name: "Microsoft Corporation", price: 421.90, chg: 1.62, volSurge: 1.1, pe: 36.4, mktCap: "3.13T", mktCapValue: 3130000000000, rsi: 62.5, roe: 38.1, sector: "Technology", beta: 0.98, macdCross: true },
  { id: "AMZN", name: "Amazon.com Inc.", price: 178.15, chg: 1.02, volSurge: 1.3, pe: 41.2, mktCap: "1.85T", mktCapValue: 1850000000000, rsi: 55.4, roe: 20.3, sector: "Consumer", beta: 1.18, macdCross: true },
  { id: "GOOGL", name: "Alphabet Inc.", price: 148.48, chg: -0.92, volSurge: 0.8, pe: 25.1, mktCap: "1.84T", mktCapValue: 1840000000000, rsi: 49.3, roe: 24.1, sector: "Technology", beta: 1.10, macdCross: false },
  { id: "META", name: "Meta Platforms Inc.", price: 505.12, chg: 3.42, volSurge: 1.5, pe: 32.8, mktCap: "1.28T", mktCapValue: 1280000000000, rsi: 68.2, roe: 29.5, sector: "Technology", beta: 1.22, macdCross: true },
  { id: "TSLA", name: "Tesla Inc.", price: 175.34, chg: -2.15, volSurge: 1.4, pe: 58.6, mktCap: "558B", mktCapValue: 558000000000, rsi: 34.2, roe: 12.8, sector: "Consumer", beta: 1.54, macdCross: false },
  { id: "JPM", name: "JPMorgan Chase & Co.", price: 195.58, chg: 0.45, volSurge: 1.0, pe: 11.8, mktCap: "562B", mktCapValue: 562000000000, rsi: 53.4, roe: 16.2, sector: "Financials", beta: 0.85, macdCross: false },
  { id: "GS", name: "The Goldman Sachs Group", price: 405.12, chg: 0.78, volSurge: 1.1, pe: 15.2, mktCap: "135B", mktCapValue: 135000000000, rsi: 56.1, roe: 10.1, sector: "Financials", beta: 1.12, macdCross: true },
  { id: "LLY", name: "Eli Lilly & Co.", price: 762.45, chg: 1.85, volSurge: 1.16, pe: 118.2, mktCap: "724B", mktCapValue: 724000000000, rsi: 74.3, roe: 45.2, sector: "Healthcare", beta: 0.72, macdCross: true },
  { id: "XOM", name: "Exxon Mobil Corp.", price: 115.30, chg: -0.65, volSurge: 0.9, pe: 12.4, mktCap: "458B", mktCapValue: 458000000000, rsi: 44.8, roe: 18.5, sector: "Energy", beta: 0.80, macdCross: false },
  { id: "KO", name: "The Coca-Cola Co.", price: 60.12, chg: 0.12, volSurge: 0.8, pe: 24.5, mktCap: "258B", mktCapValue: 258000000000, rsi: 50.2, roe: 42.1, sector: "Consumer", beta: 0.58, macdCross: false },
  { id: "RELIANCE", name: "Reliance Industries Limited", price: 2954.20, chg: 1.46, volSurge: 1.25, pe: 28.4, mktCap: "19.8T", mktCapValue: 1980000000000, rsi: 65.4, roe: 16.4, sector: "Energy", beta: 0.95, macdCross: true }
];

// Mock News list suitable for quantitative platforms
export const mockNews = [
  { id: "1", title: "NVIDIA surges on strong hyperscaler demand for next-gen silicon architectures.", category: "Technology", timestamp: "10 mins ago", influence: "HIGH (+3.4%)" },
  { id: "2", title: "Federal Reserve signals structural stabilization guidelines for lending benchmark ratios.", category: "Macroeconomics", timestamp: "25 mins ago", influence: "MODERATE" },
  { id: "3", title: "Crude supply models restrict energy margin spreads, testing Exxon index resistance.", category: "Energy", timestamp: "1 hour ago", influence: "NEGATIVE" },
  { id: "4", title: "Microsoft launches specialized cloud orchestration workflows powered by multi-tenant LLMs.", category: "Technology", timestamp: "2 hours ago", influence: "HIGH" },
  { id: "5", title: "Healthcare capital inflows signal risk-off rotation towards resilient biotech pipelines.", category: "Healthcare", timestamp: "3 hours ago", influence: "STABLE" }
];

// Dynamic chart historical generator matching existing layout mechanics
export function generateHistoricalData(price: number, seed: number) {
  const data = [];
  let currentPrice = price * 0.9;
  for (let i = 0; i < 30; i++) {
    const factor = 1 + (Math.sin(i * 0.5 + seed) * 0.02) + (Math.cos(i * 0.2) * 0.01);
    const open = Math.round(currentPrice * 100) / 100;
    const close = Math.round(currentPrice * factor * 100) / 100;
    const high = Math.round(Math.max(open, close) * (1 + Math.random() * 0.015) * 100) / 100;
    const low = Math.round(Math.min(open, close) * (1 - Math.random() * 0.015) * 100) / 100;
    const volume = Math.round((1000000 + Math.sin(i + seed) * 400000) * (Math.random() + 0.5));
    const rsiValue = Math.round(40 + Math.sin(i * 0.4 + seed) * 25 + Math.random() * 10);
    const macdLine = Math.sin(i * 0.3 + seed) * 5;
    const signalLine = Math.sin(i * 0.3 - 0.5 + seed) * 4.5;
    const macdHist = macdLine - signalLine;

    data.push({
      date: `Day ${i + 1}`,
      open,
      high,
      low,
      close,
      volume,
      rsi: rsiValue,
      macd: parseFloat(macdLine.toFixed(2)),
      signal: parseFloat(signalLine.toFixed(2)),
      histogram: parseFloat(macdHist.toFixed(2))
    });
    currentPrice = close;
  }
  return data;
}
