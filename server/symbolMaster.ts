/**
 * The symbol master: lookup and search over every listed US and Indian stock
 * (about 11,000: NASDAQ, NYSE, NYSE American, NSE and BSE-only listings).
 *
 * Prices are never prefetched for this list. A stock's quote and history are fetched
 * from Yahoo when someone opens it (see getTicker in apiClients.ts and getLiveHistory).
 *
 * Ids: the hand-picked dashboard and screener lists keep their ids. Everything else uses
 * the ticker without its exchange suffix (AAPL, MRF, 543396), and when that is taken by
 * another stock, the full Yahoo symbol for Indian listings (HAL.NS) or `<ticker>.US`.
 *
 * Listings newer than the committed snapshot are picked up from NASDAQ Trader's and NSE's
 * own files once a day (refreshListings), and saved to server/data/symbol-additions.json.
 */
import { UNIVERSE, type UniverseEntry, type Market } from "./universe";
import { SCREENER_UNIVERSE, masterId } from "./screenerUniverse";
import {
  snapshotRows,
  snapshotDate,
  readAdditions,
  writeAdditions,
  notCommonStock,
  cleanUsName,
  type MasterRow,
} from "./symbolData";

export interface SymbolEntry extends UniverseEntry {
  exchange: string;
  industry: string;
  tier: number;
  capUsdM: number | null;
}

/** Shape returned to the universal search. */
export interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  market: Market;
  sector: string;
  industry: string;
  exchange: string;
}

interface Indexed {
  entry: SymbolEntry;
  idU: string;
  stemU: string;
  nameU: string;
  /** Start offsets of each word in nameU, for word-prefix matching. */
  words: string[];
  rank: number;
}

const NAME_NOISE = /\b(LIMITED|LTD|INC|CORP|CORPORATION|COMPANY|CO|PLC|HOLDINGS?|GROUP|THE)\b\.?/g;
const normalize = (s: string) => s.toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

let index: Indexed[] = [];
let byKey = new Map<string, SymbolEntry>();
let additionsAt: string | null = null;
let built = false;

function rankOf(e: SymbolEntry): number {
  // Bigger companies first; within a tier, US caps break ties and NSE beats BSE.
  return e.tier * 1e7 + Math.min(e.capUsdM ?? 0, 9e6) + (e.exchange === "BSE" ? 0 : 1);
}

function build() {
  const curated = new Map<string, { id: string; sector: string; name: string }>();
  for (const e of [...UNIVERSE, ...SCREENER_UNIVERSE]) {
    if (!curated.has(e.symbol)) curated.set(e.symbol, { id: e.id, sector: e.sector, name: e.name });
  }
  const additions = readAdditions();
  additionsAt = additions.generatedAt;

  const seen = new Set<string>();
  const rows: MasterRow[] = [];
  for (const r of [...snapshotRows(), ...additions.rows]) {
    if (seen.has(r.symbol)) continue;
    seen.add(r.symbol);
    rows.push(r);
  }
  // Curated stocks that the snapshot somehow lacks still need to be searchable.
  for (const e of [...UNIVERSE, ...SCREENER_UNIVERSE]) {
    if (seen.has(e.symbol)) continue;
    seen.add(e.symbol);
    rows.push({
      symbol: e.symbol,
      name: e.name,
      exchange: e.market === "IN" ? "NSE" : "US",
      sector: e.sector,
      industry: "industry" in e ? (e as any).industry : "",
      tier: -1,
      capUsdM: null,
      market: e.market,
    });
  }

  const ids = new Set([...curated.values()].map((c) => c.id));
  const entries: SymbolEntry[] = [];
  // Curated ids first, then the rest by size so the bigger company keeps the plain ticker.
  const ordered = [...rows].sort((a, b) => {
    const ca = curated.has(a.symbol) ? 1 : 0;
    const cb = curated.has(b.symbol) ? 1 : 0;
    return cb - ca || b.tier - a.tier || (b.capUsdM ?? 0) - (a.capUsdM ?? 0) || (a.market === "US" ? -1 : 1) - (b.market === "US" ? -1 : 1);
  });
  for (const r of ordered) {
    const c = curated.get(r.symbol);
    let id: string;
    if (c) id = c.id;
    else {
      id = masterId(r, (x) => ids.has(x));
      ids.add(id);
    }
    entries.push({
      id,
      symbol: r.symbol,
      name: r.name,
      sector: r.sector || c?.sector || "Unclassified",
      market: r.market,
      exchange: r.exchange,
      industry: r.industry,
      tier: r.tier,
      capUsdM: r.capUsdM,
    });
  }

  const keyMap = new Map<string, SymbolEntry>();
  for (const e of entries) keyMap.set(e.symbol.toUpperCase(), e);
  for (const e of entries) keyMap.set(e.id.toUpperCase(), e); // ids win over symbols
  byKey = keyMap;

  index = entries
    .map((entry) => {
      const nameU = normalize(entry.name);
      return {
        entry,
        idU: entry.id.toUpperCase(),
        stemU: entry.symbol.toUpperCase().replace(/\.(NS|BO)$/, ""),
        nameU,
        words: nameU.split(" "),
        rank: rankOf(entry),
      };
    })
    .sort((a, b) => b.rank - a.rank);
  built = true;
}

function ensure() {
  if (!built) build();
}

/**
 * Resolve an id or symbol to a stock: "MRF", "MRF.NS", "NSE:MRF", "BSE:500290", "AAPL", "BRK.B".
 * Returns undefined for anything that isn't a listed US or Indian stock.
 */
export function findSymbol(idOrSymbol: string): SymbolEntry | undefined {
  ensure();
  const key = idOrSymbol.trim().toUpperCase();
  if (!key) return undefined;
  const hit = byKey.get(key);
  if (hit) return hit;
  const prefixed = key.match(/^(NSE|BSE|NASDAQ|NYSE|US):(.+)$/);
  if (prefixed) {
    const [, ex, t] = prefixed;
    if (ex === "NSE") return byKey.get(`${t}.NS`);
    if (ex === "BSE") return byKey.get(`${t}.BO`) ?? byKey.get(`${t}.NS`);
    return byKey.get(t.replace(".", "-"));
  }
  if (key.includes(".") && !/\.(NS|BO|US)$/.test(key)) return byKey.get(key.replace(".", "-")); // BRK.B
  return undefined;
}

function score(x: Indexed, q: string, qn: string, qWords: string[]): number {
  if (x.idU === q || x.stemU === q) return 1000;
  if (qn && x.nameU === qn) return 950;
  let s = 0;
  if (x.idU.startsWith(q) || x.stemU.startsWith(q)) s = 800;
  if (qn && x.nameU.startsWith(qn)) s = Math.max(s, 700);
  else if (qWords.length && qWords.every((w) => x.words.some((n) => n.startsWith(w)))) s = Math.max(s, 600);
  else if (qn.length >= 3 && x.nameU.includes(qn)) s = Math.max(s, 400);
  else if (q.length >= 2 && x.stemU.includes(q)) s = Math.max(s, 300);
  return s;
}

/**
 * Search every listed US and Indian stock by ticker or company name.
 * Ranking: exact ticker, ticker prefix, name prefix, every word matching a name word,
 * then substrings; larger companies first within each band.
 */
export function searchSymbols(query: string, limit = 20, market?: Market): SearchResult[] {
  ensure();
  const q = query.trim().toUpperCase().replace(/^(NSE|BSE|NASDAQ|NYSE):/, "");
  if (!q) return [];
  const qn = normalize(q);
  const qWords = qn.replace(NAME_NOISE, " ").split(" ").filter(Boolean);
  const max = Math.max(1, Math.min(100, limit));
  const hits: { x: Indexed; s: number }[] = [];
  for (const x of index) {
    if (market && x.entry.market !== market) continue;
    const s = score(x, q, qn, qWords);
    if (s > 0) hits.push({ x, s });
  }
  hits.sort((a, b) => b.s - a.s || b.x.rank - a.x.rank);
  return hits.slice(0, max).map(({ x: { entry: e } }) => ({
    id: e.id,
    symbol: e.symbol,
    name: e.name,
    market: e.market,
    sector: e.sector,
    industry: e.industry,
    exchange: e.exchange,
  }));
}

export function symbolStats() {
  ensure();
  const byExchange: Record<string, number> = {};
  for (const x of index) byExchange[x.entry.exchange] = (byExchange[x.entry.exchange] || 0) + 1;
  return {
    total: index.length,
    us: index.filter((x) => x.entry.market === "US").length,
    india: index.filter((x) => x.entry.market === "IN").length,
    byExchange,
    snapshotAt: snapshotDate(),
    additionsAt,
  };
}

// -------------------------------------------------------------------------
// Daily top-up from the exchanges' own listing files
// -------------------------------------------------------------------------

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DAY_MS = 24 * 60 * 60_000;

async function text(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA, ...headers }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const US_EXCHANGE: Record<string, string> = { N: "NYSE", A: "NYSE American", P: "NYSE Arca", Z: "Cboe", V: "IEX" };

/** NASDAQ Trader's pipe-delimited symbol directory (nasdaqlisted.txt, otherlisted.txt). */
export function parseNasdaqTrader(body: string, file: "nasdaq" | "other"): MasterRow[] {
  const lines = body.split(/\r?\n/).filter((l) => l && !l.startsWith("File Creation Time"));
  const head = lines.shift()?.split("|") ?? [];
  const col = (name: string) => head.indexOf(name);
  const iSym = col(file === "nasdaq" ? "Symbol" : "ACT Symbol");
  const iName = col("Security Name");
  const iEtf = col("ETF");
  const iTest = col("Test Issue");
  const iEx = col("Exchange");
  const out: MasterRow[] = [];
  for (const line of lines) {
    const f = line.split("|");
    const raw = f[iSym]?.trim();
    const name = f[iName]?.trim() ?? "";
    if (!raw || /[$=^~+]/.test(raw) || f[iEtf] === "Y" || f[iTest] === "Y" || notCommonStock(name)) continue;
    out.push({
      symbol: raw.replace(".", "-"),
      name: cleanUsName(name.replace(/\s+-\s+/, " ")) || raw,
      exchange: file === "nasdaq" ? "NASDAQ" : US_EXCHANGE[f[iEx]] ?? "NYSE",
      sector: "",
      industry: "",
      tier: -1,
      capUsdM: null,
      market: "US",
    });
  }
  return out;
}

/** NSE's EQUITY_L.csv: SYMBOL, NAME OF COMPANY, SERIES, ... */
export function parseNseEquityList(body: string): MasterRow[] {
  const lines = body.split(/\r?\n/).filter(Boolean);
  const head = (lines.shift() ?? "").split(",").map((h) => h.trim());
  const iSym = head.indexOf("SYMBOL");
  const iName = head.indexOf("NAME OF COMPANY");
  const iSeries = head.indexOf("SERIES");
  const out: MasterRow[] = [];
  for (const line of lines) {
    // Company names can contain commas inside quotes.
    const f = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((v) => v.replace(/,$/, "").replace(/^"|"$/g, "").trim()) ?? [];
    const sym = f[iSym];
    if (!sym || !["EQ", "BE", "BZ", "SM", "ST"].includes(f[iSeries])) continue;
    out.push({ symbol: `${sym}.NS`, name: f[iName] || sym, exchange: "NSE", sector: "", industry: "", tier: -1, capUsdM: null, market: "IN" });
  }
  return out;
}

let refreshing: Promise<number> | null = null;

/**
 * Fetch the exchanges' current listings and add any symbol the snapshot doesn't have.
 * Safe to call often: it does nothing if it ran in the last day (unless forced) and never throws.
 */
export function refreshListings(force = false): Promise<number> {
  if (refreshing) return refreshing;
  ensure();
  const last = additionsAt ? Date.parse(additionsAt) : 0;
  if (!force && Date.now() - last < DAY_MS) return Promise.resolve(0);

  refreshing = (async () => {
    const found: MasterRow[] = [];
    const sources: [string, () => Promise<MasterRow[]>][] = [
      ["NASDAQ", async () => parseNasdaqTrader(await text("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"), "nasdaq")],
      ["NYSE/other", async () => parseNasdaqTrader(await text("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"), "other")],
      [
        "NSE",
        async () =>
          parseNseEquityList(
            await text("https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv", { Accept: "text/csv,*/*", Referer: "https://www.nseindia.com/" })
          ),
      ],
    ];
    let reached = 0;
    for (const [label, load] of sources) {
      try {
        const rows = await load();
        reached++;
        for (const r of rows) if (!byKey.has(r.symbol.toUpperCase())) found.push(r);
      } catch (err: any) {
        console.warn(`[Symbols] ${label} listing file unreachable (${err?.message ?? err}); using the snapshot.`);
      }
    }
    if (!reached) return 0;
    // Keep earlier additions that are still not in the snapshot.
    const previous = readAdditions().rows.filter((r) => !found.some((f) => f.symbol === r.symbol));
    const snapshotSymbols = new Set(snapshotRows().map((r) => r.symbol));
    const merged = [...previous, ...found].filter((r) => !snapshotSymbols.has(r.symbol));
    try {
      writeAdditions(merged);
    } catch (err: any) {
      console.warn("[Symbols] Could not save new listings:", err?.message ?? err);
    }
    build();
    if (found.length) console.log(`[Symbols] Added ${found.length} new listings; ${index.length} stocks searchable.`);
    return found.length;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Run the top-up shortly after start and then daily, without holding the process open. */
export function scheduleListingRefresh() {
  const start = setTimeout(() => void refreshListings(), 15_000);
  const daily = setInterval(() => void refreshListings(), DAY_MS);
  start.unref?.();
  daily.unref?.();
}
