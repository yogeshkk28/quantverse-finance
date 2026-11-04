import type { LucideIcon } from "lucide-react";
import { BarChart3, Bitcoin, CandlestickChart, Coins, Filter, Landmark, LineChart, Network, Repeat, Gauge } from "lucide-react";

/** URL of the dedicated chart page for a stock id or instrument symbol (e.g. NVDA, MRF, ^NSEI, GC=F). */
export const chartPath = (symbol: string) => `/app/chart/${encodeURIComponent(symbol)}`;

export type MarketCategory = "stocks" | "crypto" | "forex" | "futures" | "indices" | "bonds";

export interface NavItem {
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Route, or "chart" for the last-viewed chart. */
  to: string;
  /** Tab id this item corresponds to, for highlighting. */
  match?: string;
}

export const MARKET_ITEMS: Array<NavItem & { category: MarketCategory }> = [
  { category: "stocks", label: "Stocks", hint: "US and Indian equities", icon: BarChart3, to: "/app/markets/stocks" },
  { category: "crypto", label: "Crypto", hint: "Bitcoin, Ether and large caps", icon: Bitcoin, to: "/app/markets/crypto" },
  { category: "forex", label: "Forex", hint: "Rupee crosses and majors", icon: Repeat, to: "/app/markets/forex" },
  { category: "futures", label: "Futures", hint: "Oil, gas, gold, copper and more", icon: Coins, to: "/app/markets/futures" },
  { category: "indices", label: "Indices", hint: "S&P 500, Nifty, Sensex, Nasdaq", icon: Gauge, to: "/app/markets/indices" },
  { category: "bonds", label: "Government bonds", hint: "Treasury and G-sec yields", icon: Landmark, to: "/app/markets/bonds" },
];

/** The tool suite dropdown. Named "Quant Lab" rather than "Products". */
export const LAB_LABEL = "Quant Lab";

export const LAB_ITEMS: NavItem[] = [
  {
    label: "Advanced Charts",
    hint: "Candles, overlays and indicators for any symbol",
    icon: CandlestickChart,
    to: "chart",
    match: "charts",
  },
  {
    label: "Stock Screener",
    hint: "Filter US and Indian stocks by value, momentum and risk",
    icon: Filter,
    to: "/app/screener",
    match: "screener",
  },
  {
    label: "Correlation Web",
    hint: "See which stocks move together and who leads",
    icon: Network,
    to: "/app/signals",
    match: "signals",
  },
];

export const PORTFOLIO_ITEM: NavItem = {
  label: "Portfolio",
  hint: "Your paper positions",
  icon: LineChart,
  to: "/app/portfolio",
  match: "portfolio",
};

const LAST_CHART_KEY = "lq:last-chart";

export function rememberChart(symbol: string) {
  try {
    localStorage.setItem(LAST_CHART_KEY, symbol);
  } catch {
    /* storage unavailable */
  }
}

export function lastChart(): string {
  try {
    return localStorage.getItem(LAST_CHART_KEY) || "NVDA";
  } catch {
    return "NVDA";
  }
}
