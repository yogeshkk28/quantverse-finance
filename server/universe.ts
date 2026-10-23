/**
 * The single list of stocks Lumina tracks. Add or remove symbols here;
 * every endpoint (stocks, history, correlation web, sentiment breadth) reads from it.
 *
 * `id` is what the UI shows and routes use. `symbol` is the Yahoo Finance symbol
 * (NSE stocks carry the ".NS" suffix).
 */
export type Market = "US" | "IN";

export interface UniverseEntry {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  market: Market;
}

export const UNIVERSE: UniverseEntry[] = [
  // United States
  { id: "NVDA", symbol: "NVDA", name: "NVIDIA Corporation", sector: "Technology", market: "US" },
  { id: "AMD", symbol: "AMD", name: "Advanced Micro Devices", sector: "Technology", market: "US" },
  { id: "PLTR", symbol: "PLTR", name: "Palantir Technologies", sector: "Technology", market: "US" },
  { id: "SNOW", symbol: "SNOW", name: "Snowflake Inc.", sector: "Technology", market: "US" },
  { id: "CRWD", symbol: "CRWD", name: "CrowdStrike Holdings", sector: "Technology", market: "US" },
  { id: "AAPL", symbol: "AAPL", name: "Apple Inc.", sector: "Technology", market: "US" },
  { id: "MSFT", symbol: "MSFT", name: "Microsoft Corporation", sector: "Technology", market: "US" },
  { id: "AMZN", symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer", market: "US" },
  { id: "GOOGL", symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology", market: "US" },
  { id: "META", symbol: "META", name: "Meta Platforms Inc.", sector: "Technology", market: "US" },
  { id: "TSLA", symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer", market: "US" },
  { id: "JPM", symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials", market: "US" },
  { id: "GS", symbol: "GS", name: "The Goldman Sachs Group", sector: "Financials", market: "US" },
  { id: "LLY", symbol: "LLY", name: "Eli Lilly & Co.", sector: "Healthcare", market: "US" },
  { id: "XOM", symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy", market: "US" },
  { id: "KO", symbol: "KO", name: "The Coca-Cola Co.", sector: "Consumer", market: "US" },

  // India (NSE)
  { id: "RELIANCE", symbol: "RELIANCE.NS", name: "Reliance Industries", sector: "Energy", market: "IN" },
  { id: "TCS", symbol: "TCS.NS", name: "Tata Consultancy Services", sector: "Technology", market: "IN" },
  { id: "INFY", symbol: "INFY.NS", name: "Infosys", sector: "Technology", market: "IN" },
  { id: "HDFCBANK", symbol: "HDFCBANK.NS", name: "HDFC Bank", sector: "Financials", market: "IN" },
  { id: "ICICIBANK", symbol: "ICICIBANK.NS", name: "ICICI Bank", sector: "Financials", market: "IN" },
  { id: "SBIN", symbol: "SBIN.NS", name: "State Bank of India", sector: "Financials", market: "IN" },
  { id: "BHARTIARTL", symbol: "BHARTIARTL.NS", name: "Bharti Airtel", sector: "Communication", market: "IN" },
  { id: "ITC", symbol: "ITC.NS", name: "ITC Limited", sector: "Consumer", market: "IN" },
  { id: "LT", symbol: "LT.NS", name: "Larsen & Toubro", sector: "Industrials", market: "IN" },
  { id: "HINDUNILVR", symbol: "HINDUNILVR.NS", name: "Hindustan Unilever", sector: "Consumer", market: "IN" },
];

/** Benchmark index per market, used for beta and sentiment momentum. */
export const BENCHMARK: Record<Market, string> = { US: "^GSPC", IN: "^NSEI" };

export const CURRENCY: Record<Market, string> = { US: "$", IN: "₹" };

export function findEntry(idOrSymbol: string): UniverseEntry | undefined {
  const key = idOrSymbol.toUpperCase();
  return UNIVERSE.find((u) => u.id === key || u.symbol === key);
}
