/**
 * Builds server/symbols/master.json: every listed common stock on NASDAQ, NYSE and
 * NYSE American, plus every active NSE and BSE equity.
 *
 *   npm run symbols:build
 *
 * Sources (all free, no key):
 *  - US listings with market cap: github.com/rreichel3/US-Stock-Symbols (a daily mirror
 *    of nasdaq.com's stock screener export for NASDAQ, NYSE and AMEX).
 *  - Sector, industry, ISIN and India listings: github.com/JerBouma/FinanceDatabase
 *    (MIT), which covers NSE (.NS) and BSE (.BO) with GICS-style sectors.
 *  - NSE's own EQUITY_L.csv when reachable, to pick up listings newer than the above.
 *
 * The server also tops this list up at runtime from the exchanges' own files
 * (see server/symbolMaster.ts), so a rebuild is only needed to refresh sectors and caps.
 */
import fs from "node:fs";
import path from "node:path";
import Bunzip from "seek-bzip";
import { cleanUsName, notCommonStock } from "../server/symbolData";

const OUT = path.join(process.cwd(), "server", "symbols", "master.json");
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36" };

const US_SOURCES: [file: string, exchange: string][] = [
  ["nasdaq/nasdaq_full_tickers.json", "NASDAQ"],
  ["nyse/nyse_full_tickers.json", "NYSE"],
  ["amex/amex_full_tickers.json", "NYSE American"],
];
const US_BASE = "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/";
const FD_URL = "https://raw.githubusercontent.com/JerBouma/FinanceDatabase/main/compression/equities.bz2";
const NSE_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";

/** Size tiers, largest first: 5 Mega, 4 Large, 3 Mid, 2 Small, 1 Micro, 0 Nano, -1 unknown. */
const TIER_BY_LABEL: Record<string, number> = {
  "Mega Cap": 5, "Large Cap": 4, "Mid Cap": 3, "Small Cap": 2, "Micro Cap": 1, "Nano Cap": 0,
};
function tierFromUsd(cap: number | null): number {
  if (!cap || cap <= 0) return -1;
  if (cap >= 200e9) return 5;
  if (cap >= 10e9) return 4;
  if (cap >= 2e9) return 3;
  if (cap >= 300e6) return 2;
  if (cap >= 50e6) return 1;
  return 0;
}

const SECTOR_NAMES: Record<string, string> = {
  "Information Technology": "Technology",
  "Communication Services": "Communication",
  "Health Care": "Healthcare",
  Finance: "Financials",
  Telecommunications: "Communication",
  "Basic Materials": "Materials",
  Miscellaneous: "",
};
const sectorName = (s: string) => SECTOR_NAMES[s] ?? s;

/** Minimal RFC 4180 CSV parser (handles quoted fields with commas, quotes and newlines). */
function* parseCsv(text: string): Generator<string[]> {
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); yield row; row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); yield row; }
}

/** CSV rows as objects, keeping only the columns asked for (or all) and rows that pass `keep`. */
function records(text: string, keep: (r: Record<string, string>) => boolean = () => true, only?: string[]): Record<string, string>[] {
  const it = parseCsv(text);
  const cols = (it.next().value ?? []).map((h: string) => h.trim());
  const idx = cols.map((c, i) => [c, i] as const).filter(([c]) => !only || only.includes(c));
  const out: Record<string, string>[] = [];
  for (const r of it) {
    if (r.length < cols.length - 1) continue;
    const rec = Object.fromEntries(idx.map(([c, i]) => [c, (r[i] ?? "").trim()]));
    if (keep(rec)) out.push(rec);
  }
  return out;
}

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(120_000), ...init });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}



type Row = [symbol: string, name: string, exchange: string, sector: string, industry: string, tier: number, capUsdM: number | null];

async function main() {
  console.log("Downloading FinanceDatabase equities (≈18 MB)…");
  const bz = Buffer.from(await (await get(FD_URL)).arrayBuffer());
  const usExchanges = new Set(["NMS", "NGM", "NCM", "NYQ", "ASE", "PCX", "BTS"]);
  const fd = records(
    Bunzip.decode(bz).toString("utf8"),
    (r) => r.delisted !== "True" && (/\.(NS|BO)$/.test(r.symbol) || usExchanges.has(r.exchange)),
    ["symbol", "name", "sector", "industry", "exchange", "market_cap", "isin", "delisted"]
  );
  const fdBySymbol = new Map(fd.map((r) => [r.symbol, r]));
  console.log(`  ${fd.length} active rows`);

  const rows: Row[] = [];
  const seen = new Set<string>();

  // ---- United States
  for (const [file, exchange] of US_SOURCES) {
    const list: any[] = await (await get(US_BASE + file)).json();
    let kept = 0;
    for (const x of list) {
      const raw = String(x.symbol || "").trim();
      if (!raw || /[\^~$]/.test(raw)) continue; // preferreds and odd classes
      const symbol = raw.replace("/", "-"); // BRK/B -> BRK-B, Yahoo style
      const listedName = String(x.name || "");
      if (notCommonStock(listedName)) continue;
      if (seen.has(symbol)) continue;
      const info = fdBySymbol.get(symbol);
      const cap = Number(x.marketCap) || null;
      const name = info?.name || cleanUsName(listedName) || symbol;
      const sector = sectorName(info?.sector || x.sector || "");
      const industry = info?.industry || x.industry || "";
      rows.push([symbol, name, exchange, sector, industry, tierFromUsd(cap), cap ? Math.round(cap / 1e6) : null]);
      seen.add(symbol);
      kept++;
    }
    console.log(`  ${exchange}: ${kept} of ${list.length}`);
  }

  // ---- India: NSE first, then BSE listings that aren't also on NSE (matched by ISIN)
  const nse = fd.filter((r) => r.symbol.endsWith(".NS"));
  const bse = fd.filter((r) => r.symbol.endsWith(".BO"));
  const nseIsins = new Set(nse.map((r) => r.isin).filter(Boolean));
  const nseNames = new Set(nse.map((r) => r.name.toLowerCase()));

  const indiaRow = (r: Record<string, string>, exchange: string): Row => [
    r.symbol, r.name || r.symbol, exchange, sectorName(r.sector || ""), r.industry || "", TIER_BY_LABEL[r.market_cap] ?? -1, null,
  ];
  for (const r of nse) if (!seen.has(r.symbol)) { rows.push(indiaRow(r, "NSE")); seen.add(r.symbol); }
  let bseOnly = 0;
  for (const r of bse) {
    if (r.isin ? nseIsins.has(r.isin) : nseNames.has(r.name.toLowerCase())) continue;
    if (seen.has(r.symbol)) continue;
    rows.push(indiaRow(r, "BSE"));
    seen.add(r.symbol);
    bseOnly++;
  }
  console.log(`  NSE: ${nse.length}, BSE-only: ${bseOnly}`);

  // ---- NSE's own list, for anything listed since the database snapshot
  try {
    const csv = records(await (await get(NSE_URL, { headers: { ...UA, Accept: "text/csv,*/*", Referer: "https://www.nseindia.com/" } })).text());
    let added = 0;
    for (const r of csv) {
      const symbol = `${r.SYMBOL}.NS`;
      if (!r.SYMBOL || seen.has(symbol) || !["EQ", "BE", "BZ", "SM", "ST"].includes(r.SERIES)) continue;
      rows.push([symbol, r["NAME OF COMPANY"] || r.SYMBOL, "NSE", "", "", -1, null]);
      seen.add(symbol);
      added++;
    }
    console.log(`  NSE EQUITY_L: +${added} new listings`);
  } catch (err) {
    console.warn(`  NSE EQUITY_L unreachable (${(err as Error).message}); skipped`);
  }

  rows.sort((a, b) => a[0].localeCompare(b[0]));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const doc = {
    generatedAt: new Date().toISOString(),
    sources: [US_BASE, FD_URL, NSE_URL],
    columns: ["symbol", "name", "exchange", "sector", "industry", "tier", "capUsdM"],
    rows,
  };
  // One row per line keeps diffs readable.
  const body = `{\n"generatedAt": ${JSON.stringify(doc.generatedAt)},\n"sources": ${JSON.stringify(doc.sources)},\n"columns": ${JSON.stringify(doc.columns)},\n"rows": [\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n}\n`;
  fs.writeFileSync(OUT, body);
  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r[2]] = (m[r[2]] || 0) + 1), m), {});
  console.log(`Wrote ${rows.length} symbols to ${path.relative(process.cwd(), OUT)}`, counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
