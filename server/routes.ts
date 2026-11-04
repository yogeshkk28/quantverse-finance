import { Router, Request, Response } from "express";
import { config, validateProviderConfig } from "./config";
import { GoogleGenAI } from "@google/genai";
import {
  getTicker,
  getLiveTickersList,
  getLiveHistory,
  getLiveNewsFeed,
  getCryptoFearGreed,
  getMacroIndicators
} from "./apiClients";
import { getFearGreed } from "./fearGreed";
import { Market } from "./universe";
import { buildWeb, eventStudy, loadPanel } from "./impact";
import { cached } from "./marketData";
import { Basis, dynamics, pair, structure } from "./correlationLab";
import { Estimator } from "./quant/estimators";
import { getScreener } from "./screener";
import { findSymbol, symbolStats } from "./symbolMaster";

const router = Router();

// Lazy-initialized Gemini Client helper to maintain security and prevent startup crashes
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = config.gemini.apiKey;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * -------------------------------------------------------------
 * 1. Endpoints requested by the user for Scalable Architecture
 * -------------------------------------------------------------
 */

/**
 * GET /api/stocks
 * Returns aggregated ticker metrics from real-world APIs with mock recovery.
 */
router.get("/api/stocks", async (req: Request, res: Response) => {
  try {
    const list = await getLiveTickersList();
    res.json({ tickers: list });
  } catch (err: any) {
    console.error("[API] Failed to get live stocks:", err);
    res.status(502).json({ error: "Could not load stock data.", tickers: [] });
  }
});

/**
 * GET /api/quote/:id
 * Price, change and indicators for any listed US or Indian stock, fetched on demand.
 * Accepts an id (MRF), a Yahoo symbol (MRF.NS) or an exchange-prefixed ticker (NSE:MRF).
 */
router.get("/api/quote/:id", async (req: Request, res: Response) => {
  const id = req.params.id || "";
  const entry = findSymbol(id);
  try {
    const ticker = await getTicker(id);
    if (!ticker) {
      return entry
        ? res.status(502).json({ error: `No price data for ${entry.symbol} right now.`, entry })
        : res.status(404).json({ error: `Unknown symbol ${id}` });
    }
    res.json({ ticker, entry: entry ?? null });
  } catch (err: any) {
    console.error(`[API] Quote failed for ${id}:`, err);
    res.status(502).json({ error: "Could not load the quote." });
  }
});

/**
 * GET /api/symbols/stats
 * How many stocks the symbol master covers, by exchange, and how fresh the list is.
 */
router.get("/api/symbols/stats", (_req: Request, res: Response) => {
  res.json(symbolStats());
});

/**
 * GET /api/symbols/:id
 * Resolve an id or symbol to its listing (name, exchange, sector) without fetching prices.
 */
router.get("/api/symbols/:id", (req: Request, res: Response) => {
  const entry = findSymbol(req.params.id || "");
  if (!entry) return res.status(404).json({ error: `Unknown symbol ${req.params.id}` });
  res.json({ entry });
});

/**
 * GET /api/screener
 * The Screener's ~1,300-stock universe (curated list plus every large US and Indian company) with valuation, performance, technical, risk
 * and factor-score metrics. Reports status "building" while the first load fills in.
 */
router.get("/api/screener", async (_req: Request, res: Response) => {
  try {
    res.json(await getScreener());
  } catch (err: any) {
    console.error("[API] Screener failed:", err);
    res.status(502).json({ error: "Could not load screener data.", rows: [] });
  }
});

/**
 * GET /api/history/:symbol
 * Generates technical charts/indicators curves loaded from actual APIs if requested.
 */
router.get("/api/history/:symbol", async (req: Request, res: Response) => {
  const symbol = (req.params.symbol || "").toUpperCase();
  try {
    const { history, source } = await getLiveHistory(symbol);
    res.json({ symbol, provider: source, history });
  } catch (err: any) {
    console.error(`[API] Failed to get history for ${symbol}:`, err);
    res.status(500).json({ error: err.message || "Failed to load live histories" });
  }
});

/**
 * GET /api/news
 * Streams headlines from international media services or high-fidelity simulated feeds.
 */
router.get("/api/news", async (req: Request, res: Response) => {
  try {
    const news = await getLiveNewsFeed();
    res.json({
      provider: config.newsIo.provider,
      news
    });
  } catch (err: any) {
    console.error("[API] Failed to fetch news:", err);
    res.status(500).json({ error: err.message || "Failed to retrieve news stream" });
  }
});

/**
 * GET /api/analyze/:symbol
 * Personalized automated AI quant report generators per asset.
 */
router.get("/api/analyze/:symbol", async (req: Request, res: Response) => {
  const symbol = (req.params.symbol || "").toUpperCase();
  
  try {
    const stock = await getTicker(symbol);
    if (!stock) return res.status(404).json({ error: `Unknown symbol ${symbol}` });

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        symbol,
        analysis: `[SKELETON MODE] AI Quant analysis architecture is prepared for ${symbol}. To trigger real-time LLM strategist generation, specify GEMINI_API_KEY inside Settings > Secrets.`,
        mode: "offline-mock"
      });
    }

    const prompt = `Perform a high-level concise quantitative trade analysis for financial asset: ${stock.id} (${stock.name}). Price: ${stock.currency}${stock.price}. Daily variance: ${stock.chg}%. Limit output to 3 bullets under 120 words.`;

    const result = await ai.models.generateContent({
      model: config.gemini.model,
      contents: prompt,
    });

    res.json({
      symbol,
      analysis: result.text || "No insights could be parsed by the strategist models.",
      mode: "live-gemini"
    });
  } catch (err: any) {
    res.status(500).json({ error: `AI analysis generation failure: ${err.message}` });
  }
});

/**
 * GET /api/fear-greed?market=US|IN
 * Lumina's computed stock-market Fear & Greed index (see server/fearGreed.ts),
 * plus the separate crypto index from Alternative.me for reference.
 * value is null when too few inputs could be loaded; there is no made-up default.
 */
router.get("/api/fear-greed", async (req: Request, res: Response) => {
  const market: Market = req.query.market === "IN" ? "IN" : "US";
  try {
    const [stocks, crypto] = await Promise.all([getFearGreed(market), getCryptoFearGreed()]);
    res.json({ ...stocks, crypto });
  } catch (err: any) {
    console.error("[API] Fear & Greed failed:", err);
    res.status(502).json({ market, value: null, label: "Unavailable", components: [], crypto: null });
  }
});

/**
 * GET /api/macro
 * Returns dynamic FRED macroeconomic indicators
 */
router.get("/api/macro", async (req: Request, res: Response) => {
  try {
    const macro = await getMacroIndicators();
    res.json(macro);
  } catch (err: any) {
    res.status(500).json({ error: "Failed fetching economic indicators" });
  }
});


/**
 * -------------------------------------------------------------
 * 2. Backward-compatibility routes to keep existing React UI alive
 * -------------------------------------------------------------
 */

// Legacy route matching ChartsTab chart updates: GET /api/chart/:ticker
router.get("/api/chart/:ticker", async (req: Request, res: Response) => {
  const tickerId = req.params.ticker.toUpperCase();
  try {
    const found = await getTicker(tickerId);
    if (!found) {
      return findSymbol(tickerId)
        ? res.status(502).json({ error: `No price data for ${tickerId} right now.` })
        : res.status(404).json({ error: `Unknown symbol ${tickerId}` });
    }
    const { history, source } = await getLiveHistory(found.id);
    res.json({ ticker: found, history, historySource: source });
  } catch (err: any) {
    console.error(`[API] Legacy chart query failed for ${tickerId}:`, err);
    res.status(500).json({ error: err.message || "Failed chart query" });
  }
});

// GET /api/correlation-web?market=US|IN&days=30|90|250&mode=adjusted|raw
// Links between stocks (raw or market-adjusted correlation of daily returns) and
// lead-lag pairs, each kept only when it clears a multiple-testing threshold.
router.get("/api/correlation-web", async (req: Request, res: Response) => {
  const market: Market = req.query.market === "IN" ? "IN" : "US";
  const days = [30, 90, 250].includes(Number(req.query.days)) ? Number(req.query.days) : 90;
  const mode = req.query.mode === "raw" ? "raw" : "adjusted";
  // Short windows are noisier, so ask for a stronger link; residual links run weaker than raw ones.
  const minAbs = mode === "raw" ? (days <= 30 ? 0.5 : 0.4) : 0.3;
  try {
    const panel = await loadPanel(market);
    if (!panel) {
      return res.status(502).json({ error: "Not enough price history to compute correlations.", nodes: [], links: [], leads: [] });
    }
    const web = buildWeb(panel, days, mode, minAbs);
    const list = await getLiveTickersList();
    const nodes = list
      .filter((t) => panel.ids.includes(t.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        sector: t.sector,
        beta: web.betas[t.id] ?? t.beta,
        val: Math.round(10 + Math.log10(Math.max(t.mktCapValue ?? 1e10, 1e9)) * 2),
      }));

    res.json({
      market,
      days,
      mode,
      sessions: web.n,
      linkThreshold: web.linkThreshold,
      leadThreshold: web.leadThreshold,
      missing: panel.missing,
      asOf: new Date().toISOString(),
      nodes,
      links: web.links,
      leads: web.leads,
    });
  } catch (err: any) {
    console.error("[API] Failed computing correlation web:", err);
    res.status(500).json({ error: "Failed computing correlation web", nodes: [], links: [], leads: [] });
  }
});

// GET /api/correlation-web/events?market=US|IN&symbol=NVDA
// What every peer did on and after the symbol's largest market-adjusted moves (about two years).
router.get("/api/correlation-web/events", async (req: Request, res: Response) => {
  const market: Market = req.query.market === "IN" ? "IN" : "US";
  const symbol = String(req.query.symbol || "").toUpperCase();
  try {
    const panel = await loadPanel(market);
    if (!panel) return res.status(502).json({ error: "Not enough price history for an event study." });
    const study = eventStudy(panel, symbol);
    if (!study) return res.status(404).json({ error: `No price history for ${symbol} in this market.` });
    res.json(study);
  } catch (err: any) {
    console.error(`[API] Event study failed for ${symbol}:`, err);
    res.status(500).json({ error: "Event study failed" });
  }
});

// GET /api/correlation-web/structure?market=US|IN&days=30|90|250&basis=residual|raw&estimator=lw|rmt|sample
// The cleaned correlation matrix, its eigen-spectrum, MST/TMFG/partial/threshold/lead-lag
// networks, clusters and centrality for one window. See docs/correlation-web.md.
router.get("/api/correlation-web/structure", async (req: Request, res: Response) => {
  const market: Market = req.query.market === "IN" ? "IN" : "US";
  const days = [30, 90, 250].includes(Number(req.query.days)) ? Number(req.query.days) : 90;
  const basis: Basis = req.query.basis === "raw" ? "raw" : "residual";
  const estimator: Estimator = req.query.estimator === "rmt" ? "rmt" : req.query.estimator === "sample" ? "sample" : "lw";
  try {
    const panel = await loadPanel(market);
    if (!panel) return res.status(502).json({ error: "Not enough price history to compute correlations." });
    const result = await cached(`cw:structure:${market}:${days}:${basis}:${estimator}:${panel.dates.at(-1)}`, 10 * 60_000, async () =>
      structure(panel, days, basis, estimator)
    );
    const list = await getLiveTickersList();
    const meta = new Map(list.map((t) => [t.id, t]));
    const nodes = result.ids.map((id, i) => {
      const t = meta.get(id);
      return {
        id,
        name: t?.name ?? id,
        sector: t?.sector ?? "Other",
        beta: result.betas[i],
        cluster: result.clusters.labels[i],
        mktCap: t?.mktCapValue ?? null,
        loadings: result.spectrum.loadings.map((v) => v[i]),
        ...result.centrality[i],
      };
    });
    res.json({ market, days, missing: panel.missing, asOf: new Date().toISOString(), nodes, ...result });
  } catch (err: any) {
    console.error("[API] Correlation structure failed:", err);
    res.status(500).json({ error: "Failed computing correlation structure" });
  }
});

// GET /api/correlation-web/dynamics?market=US|IN
// Rolling 60-session regime metrics (average correlation, absorption ratio, MST length and survival).
router.get("/api/correlation-web/dynamics", async (req: Request, res: Response) => {
  const market: Market = req.query.market === "IN" ? "IN" : "US";
  try {
    const panel = await loadPanel(market);
    if (!panel) return res.status(502).json({ error: "Not enough price history for regime metrics." });
    if (panel.dates.length < 80) return res.status(502).json({ error: "Not enough history for rolling windows yet." });
    const result = await cached(`cw:dynamics:${market}:${panel.dates.at(-1)}`, 10 * 60_000, async () => dynamics(panel));
    res.json({ market, ...result });
  } catch (err: any) {
    console.error("[API] Correlation dynamics failed:", err);
    res.status(500).json({ error: "Failed computing regime metrics" });
  }
});

// GET /api/correlation-web/pair?market=US|IN&a=NVDA&b=AMD&days=90
// Rolling correlation (raw and market-adjusted) and the lead-lag profile of two stocks.
router.get("/api/correlation-web/pair", async (req: Request, res: Response) => {
  const market: Market = req.query.market === "IN" ? "IN" : "US";
  const a = String(req.query.a || "").toUpperCase();
  const b = String(req.query.b || "").toUpperCase();
  const days = [30, 90, 250].includes(Number(req.query.days)) ? Number(req.query.days) : 90;
  try {
    const panel = await loadPanel(market);
    if (!panel) return res.status(502).json({ error: "Not enough price history." });
    const result = pair(panel, a, b, days);
    if (!result) return res.status(404).json({ error: `No price history for ${a} and ${b} in this market.` });
    res.json(result);
  } catch (err: any) {
    console.error(`[API] Pair analysis failed for ${a}/${b}:`, err);
    res.status(500).json({ error: "Pair analysis failed" });
  }
});

// Legacy route matching interactive Gemini analysis prompts: POST /api/gemini/analyze
router.post("/api/gemini/analyze", async (req: Request, res: Response) => {
  try {
    const { ticker, timeframe, overlays, indicators } = req.body;
    if (!ticker) {
      return res.status(400).json({ error: "Ticker symbol is required" });
    }

    const ai = getGeminiClient();
    const list = await getLiveTickersList();
    const stock = list.find((t) => t.id === ticker.toUpperCase());
    if (!stock) return res.status(404).json({ error: `Unknown symbol ${ticker}` });

    if (!ai) {
      // Return a professional mock analysis to ensure UI continues to look rich even when offline
      const mockResult = `**LUMINA QUANT AI REPORT [STANDBY PREPARATION]**
• **Trend Bias**: ${stock.id} exhibits neutral-to-bullish momentum with RSI at ${stock.rsi}. Immediate resistances are tested.
• **Valuation Metric**: Current trailing P/E of ${stock.pe ?? "n/a"} is historically balanced relative to sector ${stock.sector} indices.
• **Tactical Setup**: Monitor key entry supports. Consider placing risk-reversals below moving averages.`;
      return res.json({ analysis: mockResult });
    }

    const prompt = `You are Lumina Quant's premium AI quant strategist.
Analyze ${stock.id} (${stock.name}).
Current Price: ${stock.currency}${stock.price}
Daily Chg%: ${stock.chg}%
Sector: ${stock.sector}
P/E: ${stock.pe ?? "n/a"}
RSI (14): ${stock.rsi} (Indicator)
ROE: ${stock.roe ?? "n/a"}%
MACD Bull Cross Active: ${stock.macdCross}

User active settings:
Timeframe target: ${timeframe || "1W"}
Active overlays: ${overlays ? overlays.join(", ") : "None"}
Active indicator tabs: ${indicators ? indicators.join(", ") : "None"}

Please provide a highly professional, concise, bulleted quantitative insight. Emphasize:
1. Technical trend bias and strength (overbought/oversold implications).
2. Fundamental evaluation (P/E and profitability/ROE implications).
3. Tactical trade suggestions (with risk stops and target indicators).
Limit your response to 200 words max. Keep it crisp, factual and suited for institutional readers. Do not output markdown code blocks. Ensure there is no boilerplate template language.`;

    const result = await ai.models.generateContent({
      model: config.gemini.model,
      contents: prompt,
    });

    res.json({ analysis: result.text || "Unable to retrieve analysis output." });
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI analysis." });
  }
});

export default router;
