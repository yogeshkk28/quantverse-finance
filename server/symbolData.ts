/**
 * Raw rows of the symbol master: every listed common stock on NASDAQ, NYSE and NYSE American,
 * every active NSE equity, and BSE equities that aren't also on NSE.
 *
 * `server/symbols/master.json` is the snapshot committed to the repo (rebuild it with
 * `npm run symbols:build`). `server/data/symbol-additions.json` holds listings the server
 * found later in the exchanges' own files (see refreshListings in symbolMaster.ts).
 *
 * This module has no imports from the rest of the server so any module can use it at load time.
 */
import fs from "node:fs";
import path from "node:path";

export type MasterMarket = "US" | "IN";

export interface MasterRow {
  /** Yahoo Finance symbol: AAPL, BRK-B, MRF.NS, 543396.BO */
  symbol: string;
  name: string;
  /** NASDAQ, NYSE, NYSE American, NYSE Arca, Cboe, NSE or BSE */
  exchange: string;
  sector: string;
  industry: string;
  /** Size tier, 5 Mega, 4 Large, 3 Mid, 2 Small, 1 Micro, 0 Nano, -1 unknown */
  tier: number;
  /** Market cap in USD millions (US listings only) */
  capUsdM: number | null;
  market: MasterMarket;
}

export const MASTER_FILE = path.join(process.cwd(), "server", "symbols", "master.json");
export const ADDITIONS_FILE = path.join(process.cwd(), "server", "data", "symbol-additions.json");

type RawRow = [string, string, string, string, string, number, number | null];

export const marketOfExchange = (exchange: string): MasterMarket => (exchange === "NSE" || exchange === "BSE" ? "IN" : "US");

function toRow(r: RawRow): MasterRow {
  return { symbol: r[0], name: r[1], exchange: r[2], sector: r[3], industry: r[4], tier: r[5], capUsdM: r[6], market: marketOfExchange(r[2]) };
}

function readRows(file: string): { rows: MasterRow[]; generatedAt: string | null } {
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    return { rows: (doc.rows as RawRow[]).map(toRow), generatedAt: doc.generatedAt ?? null };
  } catch (err: any) {
    if (err?.code !== "ENOENT") console.warn(`[Symbols] Could not read ${path.relative(process.cwd(), file)}:`, err?.message ?? err);
    return { rows: [], generatedAt: null };
  }
}

let snapshot: { rows: MasterRow[]; generatedAt: string | null } | null = null;

/** The committed snapshot, read once. */
export function snapshotRows(): MasterRow[] {
  if (!snapshot) {
    snapshot = readRows(MASTER_FILE);
    if (!snapshot.rows.length) console.warn("[Symbols] server/symbols/master.json is missing or empty; search covers the tracked lists only.");
  }
  return snapshot.rows;
}

export function snapshotDate(): string | null {
  snapshotRows();
  return snapshot!.generatedAt;
}

/** Listings found since the snapshot, with when they were fetched. */
export function readAdditions(): { rows: MasterRow[]; generatedAt: string | null } {
  return readRows(ADDITIONS_FILE);
}

export function writeAdditions(rows: MasterRow[]) {
  const raw: RawRow[] = rows.map((r) => [r.symbol, r.name, r.exchange, r.sector, r.industry, r.tier, r.capUsdM]);
  fs.mkdirSync(path.dirname(ADDITIONS_FILE), { recursive: true });
  fs.writeFileSync(ADDITIONS_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), rows: raw }));
}

/** Warrants, rights, SPAC units, preferreds and listed debt; keeps LP units, trust units and ADSs. */
export function notCommonStock(name: string): boolean {
  if (/%|\b(warrants?|rights?|preferred|preference|debentures?|notes?|bonds?|subordinated|CorTS|STRATS)\b/i.test(name)) return true;
  return /\bunits?\b/i.test(name) && !/common units|limited partner|partnership units|beneficial (interest|unit)|depositary|class a units/i.test(name);
}

/** "Agilent Technologies Inc. Common Stock" -> "Agilent Technologies Inc." */
export function cleanUsName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/\s*(Class [A-Z] )?(Common Stock|Common Shares|Ordinary Shares|Subordinate Voting Shares|Common Units|Units representing.*|Shares of Beneficial Interest|American Depositary Shares.*|American Depository Shares.*|ADS.*|New)(\s*\(.*\))?\s*$/i, "")
    .replace(/[\s,]+$/, "")
    .trim();
}
