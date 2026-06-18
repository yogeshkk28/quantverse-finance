import type { MarketIndex, Stock, FearGreedData, NewsArticle, CandleData } from '../types';

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
const COINGECKO_KEY = import.meta.env.VITE_COINGECKO_API_KEY;
const ALPHA_VANTAGE_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;
const NEWSDATA_KEY = import.meta.env.VITE_NEWSDATA_API_KEY;

const finnhubBase = 'https://finnhub.io/api/v1';

// Indian stock symbols for Finnhub (need .NS suffix)
export const INDIAN_SYMBOLS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Energy' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy', sector: 'IT' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Banking' },
  { symbol: 'INFY.NS', name: 'Infosys', sector: 'IT' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', sector: 'Banking' },
  { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', sector: 'FMCG' },
  { symbol: 'ITC.NS', name: 'ITC Limited', sector: 'FMCG' },
  { symbol: 'SBIN.NS', name: 'State Bank of India', sector: 'Banking' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', sector: 'Telecom' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro', sector: 'Infrastructure' },
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', sector: 'Auto' },
  { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', sector: 'Auto' },
  { symbol: 'SUNPHARMA.NS', name: 'Sun Pharma', sector: 'Pharma' },
  { symbol: 'WIPRO.NS', name: 'Wipro', sector: 'IT' },
  { symbol: 'HCLTECH.NS', name: 'HCL Technologies', sector: 'IT' },
  { symbol: 'ASIANPAINT.NS', name: 'Asian Paints', sector: 'Consumer' },
  { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', sector: 'Financial Services' },
  { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', sector: 'Infrastructure' },
  { symbol: 'TATASTEEL.NS', name: 'Tata Steel', sector: 'Mining' },
  { symbol: 'POWERGRID.NS', name: 'Power Grid Corp', sector: 'Power' },
];

const INDEX_SYMBOLS = [
  { symbol: '^NSEI', name: 'Nifty 50' },
  { symbol: '^BSESN', name: 'Sensex' },
  { symbol: '^GSPC', name: 'S&P 500' },
];

interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // change percent
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // previous close
  v: number; // volume
}

// Fetch quote from Finnhub
export async function fetchQuote(symbol: string): Promise<FinnhubQuote | null> {
  try {
    const res = await fetch(`${finnhubBase}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.c === 0 && data.d === null) return null;
    return data as FinnhubQuote;
  } catch {
    return null;
  }
}

// Fetch market indices for ticker bar
export async function fetchMarketIndices(): Promise<MarketIndex[]> {
  const results: MarketIndex[] = [];

  // Fetch index quotes in parallel
  const indexPromises = INDEX_SYMBOLS.map(async ({ symbol, name }) => {
    const quote = await fetchQuote(symbol);
    if (quote) {
      results.push({
        name,
        symbol,
        price: quote.c,
        change: quote.d,
        changePercent: quote.dp,
        sparkline: generateSparkline(quote.c, Math.abs(quote.d) * 2 + 5),
      });
    }
  });

  // Fetch Bitcoin
  const btcPromise = async () => {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=${COINGECKO_KEY}`);
      if (res.ok) {
        const data = await res.json();
        if (data.bitcoin) {
          results.push({
            name: 'Bitcoin',
            symbol: 'BTC-USD',
            price: data.bitcoin.usd,
            change: data.bitcoin.usd_24h_change ? (data.bitcoin.usd * data.bitcoin.usd_24h_change / 100) : 0,
            changePercent: data.bitcoin.usd_24h_change ?? 0,
            sparkline: generateSparkline(data.bitcoin.usd, 500),
          });
        }
      }
    } catch { /* ignore */ }
  };

  // Fetch Gold
  const goldPromise = async () => {
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${ALPHA_VANTAGE_KEY}`);
      if (res.ok) {
        const data = await res.json();
        const rate = data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
        if (rate) {
          const price = parseFloat(rate);
          results.push({
            name: 'Gold (XAUUSD)',
            symbol: 'XAUUSD',
            price,
            change: price * 0.003,
            changePercent: 0.3,
            sparkline: generateSparkline(price, 8),
          });
        }
      }
    } catch { /* ignore */ }
  };

  await Promise.all([...indexPromises, btcPromise(), goldPromise()]);
  return results;
}

// Fetch top gainers/losers from Indian stocks
export async function fetchIndianStocks(): Promise<Stock[]> {
  const stocks: Stock[] = [];
  const chunkSize = 5;

  for (let i = 0; i < INDIAN_SYMBOLS.length; i += chunkSize) {
    const chunk = INDIAN_SYMBOLS.slice(i, i + chunkSize);
    const promises = chunk.map(async ({ symbol, name, sector }) => {
      const quote = await fetchQuote(symbol);
      if (quote && quote.c > 0) {
        stocks.push({
          symbol: symbol.replace('.NS', ''),
          name,
          price: quote.c,
          change: quote.d,
          changePercent: quote.dp,
          volume: quote.v ?? 0,
          sector,
        });
      }
    });
    await Promise.all(promises);
  }

  return stocks;
}

// Fetch candle data from Finnhub
export async function fetchCandles(symbol: string, resolution: string, from: number, to: number): Promise<CandleData[]> {
  try {
    const nsSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    const res = await fetch(`${finnhubBase}/stock/candle?symbol=${encodeURIComponent(nsSymbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.s !== 'ok' || !data.t) return [];

    const result: CandleData[] = [];
    for (let i = 0; i < data.t.length; i++) {
      result.push({
        time: data.t[i],
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i] ?? 0,
      });
    }
    return result;
  } catch {
    return [];
  }
}

// Fetch Fear & Greed Index
export async function fetchFearGreed(): Promise<FearGreedData | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/');
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data[0]) {
      return {
        value: parseInt(data.data[0].value),
        valueClassification: data.data[0].value_classification,
        timestamp: data.data[0].timestamp,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Fetch news from NewsData.io
export async function fetchNews(): Promise<NewsArticle[]> {
  try {
    const res = await fetch(`https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=stock%20market%20finance%20india&language=en&category=business`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results) return [];

    return data.results.slice(0, 6).map((r: Record<string, unknown>) => ({
      title: r.title || '',
      source: r.source_id || 'Unknown',
      url: r.link || '#',
      imageUrl: r.image_url || 'https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?auto=compress&cs=tinysrgb&w=400',
      publishedAt: r.pubDate || new Date().toISOString(),
      timeAgo: formatTimeAgo(r.pubDate as string),
    }));
  } catch {
    return [];
  }
}

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

// Sparkline helper
function generateSparkline(base: number, volatility: number, points = 20): number[] {
  const data: number[] = [];
  let current = base;
  for (let i = 0; i < points; i++) {
    current += (Math.random() - 0.48) * volatility;
    data.push(parseFloat(current.toFixed(2)));
  }
  return data;
}

// Fallback mock data when APIs fail
export const fallbackIndices: MarketIndex[] = [
  { name: 'Nifty 50', symbol: '^NSEI', price: 24532.15, change: 312.40, changePercent: 1.29, sparkline: generateSparkline(24532, 50) },
  { name: 'Sensex', symbol: '^BSESN', price: 80842.30, change: 1024.55, changePercent: 1.28, sparkline: generateSparkline(80842, 100) },
  { name: 'S&P 500', symbol: '^GSPC', price: 5432.18, change: -18.32, changePercent: -0.34, sparkline: generateSparkline(5432, 15) },
  { name: 'Gold (XAUUSD)', symbol: 'XAUUSD', price: 2345.60, change: 12.40, changePercent: 0.53, sparkline: generateSparkline(2345, 8) },
  { name: 'Bitcoin', symbol: 'BTC-USD', price: 68432.10, change: -1256.30, changePercent: -1.80, sparkline: generateSparkline(68432, 500) },
];

export const fallbackFearGreed: FearGreedData = { value: 58, valueClassification: 'Greed', timestamp: new Date().toISOString() };

export const fallbackNews: NewsArticle[] = [
  { title: 'RBI Holds Key Rates Steady, Signals Easing Bias Ahead', source: 'Economic Times', url: '#', imageUrl: 'https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '2h ago' },
  { title: 'FII Inflows Surge to 6-Month High as Fed Pivot Boosts Sentiment', source: 'Moneycontrol', url: '#', imageUrl: 'https://images.pexels.com/photos/259024/pexels-photo-259024.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '3h ago' },
  { title: 'Nifty IT Index Hits All-Time High on Strong Guidance', source: 'LiveMint', url: '#', imageUrl: 'https://images.pexels.com/photos/1181299/pexels-photo-1181299.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '4h ago' },
  { title: 'Gold Prices Ease as Dollar Recovers', source: 'Bloomberg Quint', url: '#', imageUrl: 'https://images.pexels.com/photos/258744/pexels-photo-258744.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '5h ago' },
  { title: 'Adani Group Stocks Rally on Debt Reduction Plan', source: 'NDTV Profit', url: '#', imageUrl: 'https://images.pexels.com/photos/534215/pexels-photo-534215.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '6h ago' },
  { title: 'Bitcoin Struggles Below $70K as Regulatory Concerns Weigh', source: 'CoinDesk', url: '#', imageUrl: 'https://images.pexels.com/photos/844700/pexels-photo-844700.jpeg?auto=compress&cs=tinysrgb&w=400', publishedAt: new Date().toISOString(), timeAgo: '7h ago' },
];
