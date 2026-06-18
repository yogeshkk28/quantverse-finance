import type { MarketIndex, Stock, FearGreedData, NewsArticle, CandleData } from '../types';

function generateSparkline(base: number, volatility: number, points = 20): number[] {
  const data: number[] = [];
  let current = base;
  for (let i = 0; i < points; i++) {
    current += (Math.random() - 0.48) * volatility;
    data.push(parseFloat(current.toFixed(2)));
  }
  return data;
}

export const mockMarketIndices: MarketIndex[] = [
  { name: 'Nifty 50', symbol: '^NSEI', price: 24532.15, change: 312.40, changePercent: 1.29, sparkline: generateSparkline(24532, 50) },
  { name: 'Sensex', symbol: '^BSESN', price: 80842.30, change: 1024.55, changePercent: 1.28, sparkline: generateSparkline(80842, 100) },
  { name: 'S&P 500', symbol: '^GSPC', price: 5432.18, change: -18.32, changePercent: -0.34, sparkline: generateSparkline(5432, 15) },
  { name: 'Gold (XAUUSD)', symbol: 'XAUUSD', price: 2345.60, change: 12.40, changePercent: 0.53, sparkline: generateSparkline(2345, 8) },
  { name: 'Bitcoin', symbol: 'BTC-USD', price: 68432.10, change: -1256.30, changePercent: -1.80, sparkline: generateSparkline(68432, 500) },
];

export const mockTopGainers: Stock[] = [
  { symbol: 'TATAMOTORS', name: 'Tata Motors', price: 982.35, change: 52.15, changePercent: 5.60, volume: 23450000, pe: 8.2, marketCap: 'Large', rsi: 72 },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', price: 3124.50, change: 145.30, changePercent: 4.87, volume: 18200000, pe: 95.4, marketCap: 'Large', rsi: 68 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', price: 7456.20, change: 312.40, changePercent: 4.37, volume: 8900000, pe: 32.1, marketCap: 'Large', rsi: 65 },
  { symbol: 'HINDALCO', name: 'Hindalco Industries', price: 623.80, change: 24.60, changePercent: 4.11, volume: 15600000, pe: 15.3, marketCap: 'Mid', rsi: 61 },
  { symbol: 'TATASTEEL', name: 'Tata Steel', price: 168.45, change: 6.25, changePercent: 3.85, volume: 34200000, pe: 12.8, marketCap: 'Large', rsi: 59 },
];

export const mockTopLosers: Stock[] = [
  { symbol: 'DRREDDY', name: "Dr. Reddy's", price: 5632.10, change: -245.30, changePercent: -4.17, volume: 4500000, pe: 22.1, marketCap: 'Large', rsi: 28 },
  { symbol: 'CIPLA', name: 'Cipla', price: 1456.70, change: -52.40, changePercent: -3.47, volume: 7800000, pe: 28.5, marketCap: 'Large', rsi: 32 },
  { symbol: 'DIVISLAB', name: "Divi's Lab", price: 3890.20, change: -118.60, changePercent: -2.96, volume: 3200000, pe: 45.2, marketCap: 'Mid', rsi: 35 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', price: 1824.35, change: -48.20, changePercent: -2.57, volume: 9100000, pe: 35.8, marketCap: 'Large', rsi: 38 },
  { symbol: 'WIPRO', name: 'Wipro', price: 456.80, change: -10.35, changePercent: -2.22, volume: 12400000, pe: 22.4, marketCap: 'Large', rsi: 41 },
];

export const mockFearGreed: FearGreedData = {
  value: 58,
  valueClassification: 'Greed',
  timestamp: new Date().toISOString(),
};

export const mockNews: NewsArticle[] = [
  { title: 'RBI Holds Key Rates Steady, Signals Easing Bias Ahead', source: 'Economic Times', url: '#', imageUrl: 'https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '2h ago' },
  { title: 'FII Inflows Surge to 6-Month High as Fed Pivot Boosts Sentiment', source: 'Moneycontrol', url: '#', imageUrl: 'https://images.pexels.com/photos/259024/pexels-photo-259024.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '3h ago' },
  { title: 'Nifty IT Index Hits All-Time High on Strong TCS, Infosys Guidance', source: 'LiveMint', url: '#', imageUrl: 'https://images.pexels.com/photos/1181299/pexels-photo-1181299.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '4h ago' },
  { title: 'Gold Prices Ease as Dollar Recovers; Silver Holds Steady', source: 'Bloomberg Quint', url: '#', imageUrl: 'https://images.pexels.com/photos/258744/pexels-photo-258744.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '5h ago' },
  { title: 'Adani Group Stocks Rally on Debt Reduction Plan Update', source: 'NDTV Profit', url: '#', imageUrl: 'https://images.pexels.com/photos/534215/pexels-photo-534215.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '6h ago' },
  { title: 'Bitcoin Struggles Below $70K as Regulatory Concerns Weigh', source: 'CoinDesk', url: '#', imageUrl: 'https://images.pexels.com/photos/844700/pexels-photo-844700.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '7h ago' },
];

export const allMockStocks: Stock[] = [
  ...mockTopGainers,
  ...mockTopLosers,
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2945.60, change: 32.15, changePercent: 1.11, volume: 18500000, pe: 27.8, marketCap: 'Large', roe: 12.4, debtToEquity: 0.42, revenueGrowth: 14.2, rsi: 55, macdSignal: 'bullish', emaAbove: 'EMA20', sector: 'Energy', high52w: 3024.90 },
  { symbol: 'TCS', name: 'Tata Consultancy', price: 4125.30, change: 58.40, changePercent: 1.44, volume: 6200000, pe: 31.2, marketCap: 'Large', roe: 48.6, debtToEquity: 0.08, revenueGrowth: 8.5, rsi: 62, macdSignal: 'bullish', emaAbove: 'EMA50', sector: 'IT', high52w: 4230.00 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1682.45, change: -12.30, changePercent: -0.73, volume: 14200000, pe: 19.8, marketCap: 'Large', roe: 16.2, debtToEquity: 5.8, revenueGrowth: 22.1, rsi: 44, macdSignal: 'bearish', emaAbove: 'EMA200', sector: 'Banking', high52w: 1795.00 },
  { symbol: 'INFY', name: 'Infosys', price: 1856.20, change: 28.50, changePercent: 1.56, volume: 9800000, pe: 28.4, marketCap: 'Large', roe: 32.8, debtToEquity: 0.1, revenueGrowth: 7.2, rsi: 63, macdSignal: 'bullish', emaAbove: 'EMA20', sector: 'IT', high52w: 1920.00 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 1245.80, change: 18.60, changePercent: 1.52, volume: 16800000, pe: 18.2, marketCap: 'Large', roe: 18.4, debtToEquity: 4.2, revenueGrowth: 18.6, rsi: 61, macdSignal: 'bullish', emaAbove: 'EMA50', sector: 'Banking', high52w: 1310.00 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', price: 1562.30, change: 22.10, changePercent: 1.43, volume: 7200000, pe: 72.5, marketCap: 'Large', roe: 8.6, debtToEquity: 1.2, revenueGrowth: 24.8, rsi: 58, macdSignal: 'bullish', emaAbove: 'EMA20', sector: 'Telecom', high52w: 1640.00 },
  { symbol: 'LT', name: 'Larsen & Toubro', price: 3542.60, change: 45.80, changePercent: 1.31, volume: 4500000, pe: 34.6, marketCap: 'Large', roe: 12.8, debtToEquity: 0.68, revenueGrowth: 18.4, rsi: 56, macdSignal: 'bullish', emaAbove: 'EMA50', sector: 'Infrastructure', high52w: 3620.00 },
  { symbol: 'HCLTECH', name: 'HCL Technologies', price: 1685.40, change: -15.20, changePercent: -0.89, volume: 5600000, pe: 26.2, marketCap: 'Large', roe: 22.4, debtToEquity: 0.12, revenueGrowth: 6.8, rsi: 42, macdSignal: 'bearish', emaAbove: 'EMA200', sector: 'IT', high52w: 1750.00 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', price: 2890.15, change: -38.60, changePercent: -1.32, volume: 3200000, pe: 55.8, marketCap: 'Mid', roe: 24.6, debtToEquity: 0.22, revenueGrowth: 4.2, rsi: 35, macdSignal: 'bearish', emaAbove: 'EMA200', sector: 'Consumer', high52w: 3150.00 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', price: 12456.80, change: 186.40, changePercent: 1.52, volume: 1800000, pe: 30.4, marketCap: 'Large', roe: 15.2, debtToEquity: 0.04, revenueGrowth: 22.6, rsi: 64, macdSignal: 'bullish', emaAbove: 'EMA20', sector: 'Auto', high52w: 12800.00 },
  { symbol: 'POWERGRID', name: 'Power Grid Corp', price: 324.60, change: 8.40, changePercent: 2.65, volume: 22000000, pe: 17.8, marketCap: 'Large', roe: 22.4, debtToEquity: 2.8, revenueGrowth: 10.2, rsi: 67, macdSignal: 'bullish', emaAbove: 'EMA20', sector: 'Power', high52w: 340.00 },
  { symbol: 'COALINDIA', name: 'Coal India', price: 482.30, change: 14.20, changePercent: 3.04, volume: 18500000, pe: 8.2, marketCap: 'Large', roe: 32.6, debtToEquity: 0.12, revenueGrowth: 8.4, rsi: 70, macdSignal: 'bullish', emaAbove: 'EMA20', sector: 'Mining', high52w: 510.00 },
  { symbol: 'PIDILITIND', name: 'Pidilite Industries', price: 2845.60, change: -42.30, changePercent: -1.47, volume: 2100000, pe: 82.4, marketCap: 'Mid', roe: 18.6, debtToEquity: 0.06, revenueGrowth: 6.2, rsi: 33, macdSignal: 'bearish', emaAbove: 'EMA200', sector: 'Consumer', high52w: 3100.00 },
  { symbol: 'DABUR', name: 'Dabur India', price: 542.80, change: 6.40, changePercent: 1.19, volume: 5800000, pe: 52.6, marketCap: 'Mid', roe: 20.8, debtToEquity: 0.04, revenueGrowth: 5.8, rsi: 52, macdSignal: 'any', emaAbove: 'EMA50', sector: 'FMCG', high52w: 580.00 },
];

export const mockSectors = ['Energy', 'IT', 'Banking', 'Telecom', 'Infrastructure', 'Consumer', 'Auto', 'Power', 'Mining', 'FMCG', 'Pharma', 'Financial Services'];

function generateCandleData(basePrice: number, days: number, volatility: number): CandleData[] {
  const data: CandleData[] = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;

  for (let i = days; i >= 0; i--) {
    const time = now - i * daySeconds;
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    price += change;
    const close = price;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(Math.random() * 20000000) + 5000000;
    data.push({ time, open: parseFloat(open.toFixed(2)), high: parseFloat(high.toFixed(2)), low: parseFloat(low.toFixed(2)), close: parseFloat(close.toFixed(2)), volume });
  }
  return data;
}

export function getMockCandleData(symbol: string, timeframe: string): CandleData[] {
  const stock = allMockStocks.find(s => s.symbol === symbol);
  const basePrice = stock?.price ?? 1000;
  const volatilityMap: Record<string, number> = { '1D': 5, '1W': 15, '1M': 30, '3M': 50, '1Y': 80 };
  const daysMap: Record<string, number> = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };
  return generateCandleData(basePrice, daysMap[timeframe] ?? 30, volatilityMap[timeframe] ?? 30);
}
