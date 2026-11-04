import { Router, Request, Response } from "express";
import { UNIVERSE, type Market } from "./universe";
import { SCREENER_UNIVERSE } from "./screenerUniverse";
import { CATALOG, type MarketCategory } from "./markets";

/**
 * Universal search behind the header search bar.
 *
 * GET /api/search?q=<text>&limit=N&market=US|IN
 * → { results: [{ id, symbol, name, market, sector, exchange, kind }] }
 *
 * Stocks currently come from the tracked universe plus the Screener list. When
 * the full US/India symbol master lands, swap `stockCandidates()` for its search.
 * Non-stock instruments (indices, futures, forex, crypto, bonds) come from the
 * Markets catalog so "gold" or "nifty" also find something to chart.
 */

export type SearchKind = "stock" | Exclude<MarketCategory, "stocks">;

export interface SearchResult {
  /** Passed to /app/chart/:id. */
  id: string;
  /** Yahoo symbol. */
  symbol: string;
  name: string;
  market: Market | "GLOBAL";
  sector: string;
  exchange: string;
  kind: SearchKind;
}

interface Candidate extends SearchResult {
  /** Display code that should match like a ticker (e.g. "GOLD", "USD/INR"). */
  short: string;
  keywords: string;
  /** Lower ranks first among equal match quality. */
  order: number;
}

let stockCache: Candidate[] | null = null;
function stockCandidates(): Candidate[] {
  if (stockCache) return stockCache;
  const seen = new Set<string>();
  const out: Candidate[] = [];
  // Tracked universe first (it's the most-traded set), then the Screener's larger list.
  for (const u of [...UNIVERSE, ...SCREENER_UNIVERSE]) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    out.push({
      id: u.id,
      symbol: u.symbol,
      name: u.name,
      market: u.market,
      sector: u.sector,
      exchange: u.market === "US" ? "US" : u.symbol.endsWith(".BO") ? "BSE" : "NSE",
      kind: "stock",
      short: u.id,
      keywords: "industry" in u ? String((u as { industry?: string }).industry ?? "") : "",
      order: out.length,
    });
  }
  stockCache = out;
  return out;
}

const KIND_EXCHANGE: Record<SearchKind, string> = {
  stock: "",
  indices: "Index",
  futures: "Futures",
  forex: "Forex",
  crypto: "Crypto",
  bonds: "Bond",
};

const instrumentCandidates: Candidate[] = CATALOG.filter((c) => !c.fred).map((c, i) => {
  const kind = c.category as SearchKind;
  return {
    id: c.symbol,
    symbol: c.symbol,
    name: c.name,
    market: c.group === "India" || c.short.includes("INR") ? "IN" : c.group === "United States" ? "US" : "GLOBAL",
    sector: c.group,
    exchange: KIND_EXCHANGE[kind],
    kind,
    short: c.short,
    keywords: `${c.short.replace("/", "")} ${c.keywords ?? ""}`,
    order: 10_000 + i,
  };
});

/** 0 = exact ticker … 5 = loose substring; null = no match. */
function score(c: Candidate, q: string): number | null {
  const id = c.id.toLowerCase();
  const short = c.short.toLowerCase();
  const name = c.name.toLowerCase();
  if (id === q || short === q) return 0;
  if (id.startsWith(q) || short.startsWith(q)) return 1;
  const words = name.split(/[\s.,&()/-]+/);
  if (name.startsWith(q)) return 2;
  if (words.some((w) => w.startsWith(q))) return 3;
  if (c.keywords.toLowerCase().split(/\s+/).some((w) => w && w.startsWith(q))) return 3;
  if (name.includes(q) || id.includes(q)) return 4;
  return null;
}

export function searchAll(query: string, limit = 12, market?: Market): SearchResult[] {
  const q = query.trim().toLowerCase().replace(/^\$/, "");
  if (!q) return [];
  const pool = [...stockCandidates(), ...instrumentCandidates];
  const hits: Array<{ c: Candidate; s: number }> = [];
  for (const c of pool) {
    if (market && c.market !== market) continue;
    const s = score(c, q);
    if (s !== null) hits.push({ c, s });
  }
  hits.sort((a, b) => a.s - b.s || a.c.order - b.c.order);
  return hits.slice(0, limit).map(({ c }) => {
    const { keywords: _k, order: _o, short: _s, ...result } = c;
    return result;
  });
}

const router = Router();

router.get("/api/search", (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").slice(0, 64);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "12"), 10) || 12, 1), 50);
  const m = String(req.query.market ?? "").toUpperCase();
  const market = m === "US" || m === "IN" ? (m as Market) : undefined;
  res.json({ query: q, results: searchAll(q, limit, market) });
});

export default router;
