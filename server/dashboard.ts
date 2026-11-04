import { Router, Request, Response } from "express";
import { getYahooChart, mapLimit, round, cached } from "./marketData";
import { UNIVERSE, CURRENCY } from "./universe";

/**
 * Data for the Event Horizon dashboard sections: major index charts, crypto and
 * the most-active list. Everything comes from the Yahoo daily chart endpoint
 * that the rest of the app already uses (delayed, cached 5 minutes).
 */
const router = Router();

export const MAJOR_INDICES = [
  { symbol: "^GSPC", label: "S&P 500", currency: "$" },
  { symbol: "^NDX", label: "Nasdaq 100", currency: "$" },
  { symbol: "^DJI", label: "Dow Jones", currency: "$" },
  { symbol: "^NSEI", label: "Nifty 50", currency: "₹" },
  { symbol: "^BSESN", label: "Sensex", currency: "₹" },
  { symbol: "^N225", label: "Nikkei 225", currency: "¥" },
  { symbol: "^FTSE", label: "FTSE 100", currency: "£" },
  { symbol: "^GDAXI", label: "DAX", currency: "€" },
  { symbol: "^HSI", label: "Hang Seng", currency: "HK$" },
];

const COINS = [
  { symbol: "BTC-USD", id: "BTC", name: "Bitcoin" },
  { symbol: "ETH-USD", id: "ETH", name: "Ethereum" },
  { symbol: "SOL-USD", id: "SOL", name: "Solana" },
  { symbol: "BNB-USD", id: "BNB", name: "BNB" },
  { symbol: "XRP-USD", id: "XRP", name: "XRP" },
];

/** Range chip → Yahoo range to fetch and how many trailing sessions to keep. */
const RANGES: Record<string, { fetch: "5d" | "3mo" | "1y" | "2y"; keep: number | "ytd" }> = {
  "5D": { fetch: "5d", keep: 5 },
  "1M": { fetch: "3mo", keep: 22 },
  "3M": { fetch: "3mo", keep: 66 },
  "6M": { fetch: "1y", keep: 126 },
  YTD: { fetch: "1y", keep: "ytd" },
  "1Y": { fetch: "1y", keep: 252 },
  "2Y": { fetch: "2y", keep: 520 },
};

// GET /api/index-chart?symbol=^GSPC&range=1M
router.get("/api/index-chart", async (req: Request, res: Response) => {
  const symbol = String(req.query.symbol || "^GSPC");
  const rangeKey = String(req.query.range || "3M").toUpperCase();
  const meta = MAJOR_INDICES.find((m) => m.symbol === symbol);
  const range = RANGES[rangeKey];
  if (!meta || !range) return res.status(400).json({ error: "Unknown index or range" });

  const [chart, year] = await Promise.all([getYahooChart(symbol, range.fetch), getYahooChart(symbol, "1y")]);
  if (!chart) return res.json({ ...meta, available: false });

  let candles = chart.candles;
  if (range.keep === "ytd") {
    const jan1 = Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000;
    candles = candles.filter((c) => c.time >= jan1);
  } else {
    candles = candles.slice(-range.keep);
  }
  const last = chart.candles[chart.candles.length - 1];
  const yearCloses = (year?.candles ?? chart.candles).slice(-252);
  const change = chart.price - chart.previousClose;

  res.json({
    ...meta,
    available: true,
    asOf: chart.asOf,
    price: round(chart.price),
    change: round(change),
    changePct: round((change / chart.previousClose) * 100),
    stats: {
      open: round(last.open),
      high: round(last.high),
      low: round(last.low),
      prevClose: round(chart.previousClose),
      low52: round(Math.min(...yearCloses.map((c) => c.low))),
      high52: round(Math.max(...yearCloses.map((c) => c.high))),
    },
    points: candles.map((c) => ({ t: c.time, c: round(c.close) })),
  });
});

// GET /api/crypto: five large coins with a 30-day sparkline.
router.get("/api/crypto", async (_req: Request, res: Response) => {
  const coins = await cached("dash:crypto", 60_000, () =>
    mapLimit(COINS, 3, async (coin) => {
      const chart = await getYahooChart(coin.symbol, "3mo");
      if (!chart) return { ...coin, available: false as const };
      const change = chart.price - chart.previousClose;
      const last30 = chart.candles.slice(-30).map((c) => round(c.close, 4));
      return {
        ...coin,
        available: true as const,
        price: round(chart.price, chart.price < 10 ? 4 : 2),
        changePct: round((change / chart.previousClose) * 100),
        change30Pct: last30.length > 1 ? round(((last30[last30.length - 1] - last30[0]) / last30[0]) * 100) : null,
        volume: chart.candles[chart.candles.length - 1].volume,
        spark: last30,
        asOf: chart.asOf,
      };
    })
  );
  res.json({ coins });
});

// GET /api/most-active?market=ALL|US|IN
// The tracked universe ranked by today's share volume and traded value,
// with relative volume against the 20-session average and a 5-session sparkline.
router.get("/api/most-active", async (req: Request, res: Response) => {
  const market = String(req.query.market || "ALL").toUpperCase();
  const entries = UNIVERSE.filter((u) => market === "ALL" || u.market === market);
  const rows = await mapLimit(entries, 4, async (u) => {
    const chart = await getYahooChart(u.symbol, "2y");
    if (!chart || chart.candles.length < 21) return null;
    const cs = chart.candles;
    const last = cs[cs.length - 1];
    const prior = cs.slice(-21, -1);
    const avgVol = prior.reduce((s, c) => s + c.volume, 0) / prior.length;
    const change = chart.price - chart.previousClose;
    return {
      id: u.id,
      name: u.name,
      market: u.market,
      exchange: u.market === "US" ? "US" : "NSE",
      currency: CURRENCY[u.market],
      price: round(chart.price),
      changePct: round((change / chart.previousClose) * 100),
      volume: last.volume,
      value: last.volume * chart.price,
      relVol: avgVol > 0 ? round(last.volume / avgVol, 2) : null,
      spark: cs.slice(-5).map((c) => round(c.close)),
      asOf: chart.asOf,
    };
  });
  res.json({ rows: rows.filter((r) => r !== null) });
});

export default router;
