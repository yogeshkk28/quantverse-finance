import { Router, Request, Response } from "express";
import { getYahooChart, mapLimit, round, cached } from "./marketData";
import { fetchFredSeries } from "./apiClients";
import { config } from "./config";
import { UNIVERSE, CURRENCY } from "./universe";

/**
 * Markets menu pages: one list per asset class (stocks, crypto, forex, futures,
 * indices, government bonds). Quotes come from the same delayed Yahoo daily chart
 * endpoint as the rest of the app; non-US government bond yields come from FRED
 * (monthly OECD series) when FRED_API is set.
 *
 * The catalog below is also what the universal search uses for non-stock results.
 */

export type MarketCategory = "stocks" | "crypto" | "forex" | "futures" | "indices" | "bonds";
export const MARKET_CATEGORIES: MarketCategory[] = ["stocks", "crypto", "forex", "futures", "indices", "bonds"];

export interface Instrument {
  /** Yahoo symbol, also the id the chart page receives (except stocks, which use the app id). */
  symbol: string;
  name: string;
  /** Short display code, e.g. "GOLD" or "USD/INR". */
  short: string;
  category: MarketCategory;
  group: string;
  /** Unit line under the price, e.g. "USD / barrel". */
  unit?: string;
  /** Prefix for the price, e.g. "$". Empty for yields and FX rates. */
  currency?: string;
  /** Monthly FRED series id for bonds Yahoo doesn't carry. */
  fred?: string;
  /** Extra words that should match in search (e.g. "nifty", "oil"). */
  keywords?: string;
}

const I = (
  category: MarketCategory,
  group: string,
  symbol: string,
  short: string,
  name: string,
  extra: Partial<Instrument> = {}
): Instrument => ({ category, group, symbol, short, name, ...extra });

export const CATALOG: Instrument[] = [
  // Indices
  I("indices", "United States", "^GSPC", "SPX", "S&P 500", { keywords: "spx us500" }),
  I("indices", "United States", "^NDX", "NDX", "Nasdaq 100", { keywords: "nasdaq tech" }),
  I("indices", "United States", "^IXIC", "IXIC", "Nasdaq Composite", { keywords: "nasdaq" }),
  I("indices", "United States", "^DJI", "DJI", "Dow Jones Industrial Average", { keywords: "dow" }),
  I("indices", "United States", "^RUT", "RUT", "Russell 2000", { keywords: "small caps" }),
  I("indices", "United States", "^VIX", "VIX", "CBOE Volatility Index", { keywords: "fear volatility" }),
  I("indices", "India", "^NSEI", "NIFTY", "Nifty 50", { keywords: "nse nifty50" }),
  I("indices", "India", "^BSESN", "SENSEX", "BSE Sensex", { keywords: "bse sensex" }),
  I("indices", "India", "^NSEBANK", "BANKNIFTY", "Nifty Bank", { keywords: "bank nifty" }),
  I("indices", "India", "^CNXIT", "NIFTYIT", "Nifty IT", { keywords: "it tech" }),
  I("indices", "India", "^INDIAVIX", "INDIAVIX", "India VIX", { keywords: "volatility fear" }),
  I("indices", "Global", "^N225", "N225", "Nikkei 225", { keywords: "japan" }),
  I("indices", "Global", "^FTSE", "FTSE", "FTSE 100", { keywords: "uk london" }),
  I("indices", "Global", "^GDAXI", "DAX", "DAX 40", { keywords: "germany" }),
  I("indices", "Global", "^HSI", "HSI", "Hang Seng", { keywords: "hong kong" }),

  // Futures (front month, continuous)
  I("futures", "Energy", "CL=F", "CRUDE", "WTI Crude Oil", { unit: "USD / barrel", currency: "$", keywords: "oil wti cl1" }),
  I("futures", "Energy", "BZ=F", "BRENT", "Brent Crude Oil", { unit: "USD / barrel", currency: "$", keywords: "oil brent" }),
  I("futures", "Energy", "NG=F", "NATGAS", "Natural Gas", { unit: "USD / MMBtu", currency: "$", keywords: "gas ng1" }),
  I("futures", "Energy", "RB=F", "GASOLINE", "RBOB Gasoline", { unit: "USD / gallon", currency: "$", keywords: "petrol" }),
  I("futures", "Metals", "GC=F", "GOLD", "Gold", { unit: "USD / troy oz", currency: "$", keywords: "gc1 bullion" }),
  I("futures", "Metals", "SI=F", "SILVER", "Silver", { unit: "USD / troy oz", currency: "$" }),
  I("futures", "Metals", "HG=F", "COPPER", "Copper", { unit: "USD / lb", currency: "$", keywords: "hg1" }),
  I("futures", "Metals", "PL=F", "PLATINUM", "Platinum", { unit: "USD / troy oz", currency: "$" }),
  I("futures", "Agriculture", "ZC=F", "CORN", "Corn", { unit: "US¢ / bushel" }),
  I("futures", "Agriculture", "ZW=F", "WHEAT", "Wheat", { unit: "US¢ / bushel" }),
  I("futures", "Agriculture", "ZS=F", "SOYBEAN", "Soybeans", { unit: "US¢ / bushel" }),
  I("futures", "Equity index", "ES=F", "ES", "E-mini S&P 500", { unit: "index points", keywords: "s&p futures" }),
  I("futures", "Equity index", "NQ=F", "NQ", "E-mini Nasdaq 100", { unit: "index points", keywords: "nasdaq futures" }),
  I("futures", "Equity index", "YM=F", "YM", "E-mini Dow", { unit: "index points", keywords: "dow futures" }),

  // Forex
  I("forex", "Rupee pairs", "USDINR=X", "USD/INR", "US Dollar / Indian Rupee", { keywords: "rupee dollar" }),
  I("forex", "Rupee pairs", "EURINR=X", "EUR/INR", "Euro / Indian Rupee", { keywords: "rupee euro" }),
  I("forex", "Rupee pairs", "GBPINR=X", "GBP/INR", "British Pound / Indian Rupee", { keywords: "rupee pound" }),
  I("forex", "Rupee pairs", "JPYINR=X", "JPY/INR", "Japanese Yen / Indian Rupee", { keywords: "rupee yen" }),
  I("forex", "Majors", "EURUSD=X", "EUR/USD", "Euro / US Dollar", { keywords: "euro" }),
  I("forex", "Majors", "GBPUSD=X", "GBP/USD", "British Pound / US Dollar", { keywords: "cable pound" }),
  I("forex", "Majors", "USDJPY=X", "USD/JPY", "US Dollar / Japanese Yen", { keywords: "yen" }),
  I("forex", "Majors", "USDCHF=X", "USD/CHF", "US Dollar / Swiss Franc", { keywords: "franc" }),
  I("forex", "Majors", "AUDUSD=X", "AUD/USD", "Australian Dollar / US Dollar", { keywords: "aussie" }),
  I("forex", "Majors", "USDCAD=X", "USD/CAD", "US Dollar / Canadian Dollar", { keywords: "loonie" }),
  I("forex", "Dollar", "DX-Y.NYB", "DXY", "US Dollar Index", { keywords: "dollar index dxy" }),

  // Crypto
  I("crypto", "Large caps", "BTC-USD", "BTC", "Bitcoin", { currency: "$" }),
  I("crypto", "Large caps", "ETH-USD", "ETH", "Ethereum", { currency: "$" }),
  I("crypto", "Large caps", "SOL-USD", "SOL", "Solana", { currency: "$" }),
  I("crypto", "Large caps", "BNB-USD", "BNB", "BNB", { currency: "$" }),
  I("crypto", "Large caps", "XRP-USD", "XRP", "XRP", { currency: "$", keywords: "ripple" }),
  I("crypto", "Large caps", "ADA-USD", "ADA", "Cardano", { currency: "$" }),
  I("crypto", "Large caps", "DOGE-USD", "DOGE", "Dogecoin", { currency: "$" }),
  I("crypto", "Large caps", "AVAX-USD", "AVAX", "Avalanche", { currency: "$" }),
  I("crypto", "Large caps", "DOT-USD", "DOT", "Polkadot", { currency: "$" }),
  I("crypto", "Large caps", "LINK-USD", "LINK", "Chainlink", { currency: "$" }),
  I("crypto", "Large caps", "LTC-USD", "LTC", "Litecoin", { currency: "$" }),
  I("crypto", "Stablecoins", "USDT-USD", "USDT", "Tether", { currency: "$" }),
  I("crypto", "Stablecoins", "USDC-USD", "USDC", "USD Coin", { currency: "$" }),

  // Government bonds
  I("bonds", "US Treasury yields", "^IRX", "US3M", "US 13-week T-bill yield", { unit: "%", keywords: "treasury bill" }),
  I("bonds", "US Treasury yields", "^FVX", "US5Y", "US 5-year Treasury yield", { unit: "%", keywords: "treasury note" }),
  I("bonds", "US Treasury yields", "^TNX", "US10Y", "US 10-year Treasury yield", { unit: "%", keywords: "treasury note ten year" }),
  I("bonds", "US Treasury yields", "^TYX", "US30Y", "US 30-year Treasury yield", { unit: "%", keywords: "treasury bond long" }),
  I("bonds", "Treasury futures", "ZT=F", "ZT", "2-year T-Note futures", { unit: "price" }),
  I("bonds", "Treasury futures", "ZF=F", "ZF", "5-year T-Note futures", { unit: "price" }),
  I("bonds", "Treasury futures", "ZN=F", "ZN", "10-year T-Note futures", { unit: "price" }),
  I("bonds", "Treasury futures", "ZB=F", "ZB", "30-year T-Bond futures", { unit: "price" }),
  I("bonds", "Global 10-year yields (monthly)", "IN10Y", "IN10Y", "India 10-year government bond yield", {
    unit: "%",
    fred: "INDIRLTLT01STM",
    keywords: "g-sec gsec india bond",
  }),
  I("bonds", "Global 10-year yields (monthly)", "DE10Y", "DE10Y", "Germany 10-year Bund yield", { unit: "%", fred: "IRLTLT01DEM156N", keywords: "bund" }),
  I("bonds", "Global 10-year yields (monthly)", "GB10Y", "GB10Y", "UK 10-year Gilt yield", { unit: "%", fred: "IRLTLT01GBM156N", keywords: "gilt" }),
  I("bonds", "Global 10-year yields (monthly)", "JP10Y", "JP10Y", "Japan 10-year JGB yield", { unit: "%", fred: "IRLTLT01JPM156N", keywords: "jgb" }),
];

export const CATEGORY_META: Record<MarketCategory, { title: string; blurb: string }> = {
  stocks: { title: "Stocks", blurb: "US and Indian equities from the tracked universe. Use search for any listed company." },
  crypto: { title: "Crypto", blurb: "Large-cap coins and stablecoins, quoted in US dollars. Trades around the clock." },
  forex: { title: "Forex", blurb: "Rupee crosses, the major pairs and the dollar index." },
  futures: { title: "Futures", blurb: "Front-month energy, metals, agriculture and equity-index contracts." },
  indices: { title: "Indices", blurb: "Benchmarks for the US, India and other major markets." },
  bonds: { title: "Government bonds", blurb: "US Treasury yields and futures, plus 10-year yields for India and other large economies." },
};

export interface MarketRow {
  /** What the chart page and links receive. */
  id: string;
  symbol: string;
  short: string;
  name: string;
  group: string;
  unit?: string;
  currency?: string;
  available: boolean;
  price?: number;
  change?: number;
  changePct?: number;
  spark?: number[];
  asOf?: string;
  /** "daily" for Yahoo quotes, "monthly" for FRED series. */
  frequency?: "daily" | "monthly";
  /** Whether the chart page can open this row. */
  chartable: boolean;
}

const digitsFor = (price: number) => (price < 1 ? 5 : price < 10 ? 4 : 2);

async function quoteYahoo(inst: { symbol: string }): Promise<Omit<MarketRow, "id" | "short" | "name" | "group" | "chartable"> & { symbol: string }> {
  const chart = await getYahooChart(inst.symbol, "3mo");
  if (!chart) return { symbol: inst.symbol, available: false };
  const change = chart.price - chart.previousClose;
  const d = digitsFor(chart.price);
  return {
    symbol: inst.symbol,
    available: true,
    price: round(chart.price, d),
    change: round(change, d),
    changePct: chart.previousClose ? round((change / chart.previousClose) * 100) : 0,
    spark: chart.candles.slice(-30).map((c) => round(c.close, d)),
    asOf: chart.asOf,
    frequency: "daily",
  };
}

async function quoteFred(inst: Instrument): Promise<Partial<MarketRow>> {
  const key = config.fred.apiKey;
  if (!key || !inst.fred) return { available: false };
  const obs = await fetchFredSeries(inst.fred, key, "lin", 24);
  if (!obs || obs.length === 0) return { available: false };
  const values = obs.map((o: any) => parseFloat(o.value)).filter((v: number) => Number.isFinite(v));
  if (values.length === 0) return { available: false };
  const [latest, prev] = values;
  return {
    available: true,
    price: round(latest, 3),
    change: prev != null ? round(latest - prev, 3) : undefined,
    changePct: prev ? round(((latest - prev) / prev) * 100) : undefined,
    spark: values.slice().reverse(),
    asOf: obs[0].date,
    frequency: "monthly",
  };
}

async function loadCategory(category: MarketCategory): Promise<MarketRow[]> {
  if (category === "stocks") {
    return mapLimit(UNIVERSE, 4, async (u) => {
      const q = await quoteYahoo(u);
      return {
        ...q,
        id: u.id,
        short: u.id,
        name: u.name,
        group: u.market === "US" ? "United States" : "India (NSE)",
        currency: CURRENCY[u.market],
        chartable: true,
      };
    });
  }
  const items = CATALOG.filter((c) => c.category === category);
  return mapLimit(items, 4, async (inst) => {
    const q = inst.fred ? await quoteFred(inst) : await quoteYahoo(inst);
    return {
      available: false,
      ...q,
      id: inst.symbol,
      symbol: inst.symbol,
      short: inst.short,
      name: inst.name,
      group: inst.group,
      unit: inst.unit,
      currency: inst.currency,
      // FRED-only series have no daily candles for the chart page.
      chartable: !inst.fred,
    };
  });
}

const router = Router();

// GET /api/markets/:category  (stocks | crypto | forex | futures | indices | bonds)
router.get("/api/markets/:category", async (req: Request, res: Response) => {
  const category = String(req.params.category).toLowerCase() as MarketCategory;
  if (!MARKET_CATEGORIES.includes(category)) return res.status(404).json({ error: "Unknown market" });
  try {
    const rows = await cached(`markets:${category}`, 60_000, () => loadCategory(category));
    res.json({ category, ...CATEGORY_META[category], rows });
  } catch (err) {
    console.error(`[Markets] ${category} failed:`, err);
    res.status(502).json({ category, ...CATEGORY_META[category], rows: [], error: "Could not load market data." });
  }
});

export default router;
