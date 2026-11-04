import React, { useState } from "react";
import QuoteList, { ListRow } from "./QuoteList";
import { useJson, Quote } from "./ui";
import { fmtCompact } from "../dashboard/parts";

const SHORT_UNIT: Record<string, string> = {
  "per barrel": "/bbl",
  "per MMBtu": "/MMBtu",
  "per troy oz": "/oz",
  "per pound": "/lb",
};

const fromQuote = (q: Quote, extra: Partial<ListRow> = {}): ListRow => ({
  key: q.symbol,
  chart: q.symbol,
  name: q.name,
  code: q.short,
  price: q.available ? q.price : null,
  changePct: q.available ? q.changePct : null,
  ...extra,
});

export function IndicesList() {
  const d = useJson<{ indices: Quote[] }>("/api/index-cards", 120_000);
  return (
    <QuoteList
      id="idx-list"
      title="Major indices"
      loading={d === undefined}
      rows={(d?.indices ?? []).map((q) => fromQuote(q, { unit: "pts" }))}
      seeAll={{ href: "/app/markets/indices", label: "See all indices" }}
    />
  );
}

export function FuturesList({ held }: { held: Set<string> }) {
  const d = useJson<{ futures: Quote[] }>("/api/futures", 120_000);
  return (
    <QuoteList
      id="fut-list"
      title="Futures"
      aside={<span className="lq-lbl text-[10px]">Front month · USD</span>}
      loading={d === undefined}
      rows={(d?.futures ?? []).map((q) => {
        const mine = (q.linked ?? []).filter((t) => held.has(t));
        return fromQuote(q, { unit: SHORT_UNIT[q.unit ?? ""] ?? q.unit, mark: mine.length ? `Moves ${mine.join(", ")} you hold` : undefined });
      })}
      seeAll={{ href: "/app/markets/futures", label: "See all futures" }}
    />
  );
}

export function ForexList() {
  const d = useJson<{ pairs: Quote[] }>("/api/forex", 120_000);
  return (
    <QuoteList
      id="fx-list"
      title="Forex"
      loading={d === undefined}
      rows={(d?.pairs ?? []).map((q) => fromQuote(q))}
      seeAll={{ href: "/app/markets/forex", label: "See all currencies" }}
    />
  );
}

interface Coin {
  id: string;
  name: string;
  available: boolean;
  price?: number;
  changePct?: number;
}

export function CryptoList() {
  const d = useJson<{ coins: Coin[] }>("/api/crypto", 120_000);
  return (
    <QuoteList
      id="cry-list"
      title="Crypto"
      aside={<span className="lq-lbl text-[10px]">24/7</span>}
      loading={d === undefined}
      rows={(d?.coins ?? [])
        .filter((c) => c.available)
        .map((c) => ({ key: c.id, chart: `${c.id}-USD`, name: c.name, code: c.id, price: c.price, currency: "$", changePct: c.changePct }))}
      seeAll={{ href: "/app/markets/crypto", label: "See all crypto" }}
    />
  );
}

export interface MoverRow {
  id: string;
  name: string;
  market: "US" | "IN";
  sector: string;
  currency: string;
  price: number;
  changePct: number;
  volume: number | null;
  relVolume: number | null;
  valueUsd: number | null;
}
export interface MoversResponse {
  list: string;
  status: string;
  simulated: boolean;
  universe?: number;
  total: number;
  rows: MoverRow[];
}

export const MOVER_TITLES: Record<string, string> = { gainers: "Top gainers", losers: "Top losers", active: "Most active" };
const MARKETS = [
  { key: "ALL", label: "All" },
  { key: "US", label: "US" },
  { key: "IN", label: "India" },
] as const;

export function MarketToggle({ value, onChange }: { value: string; onChange: (v: "ALL" | "US" | "IN") => void }) {
  return (
    <div role="group" aria-label="Market" className="flex rounded-md border border-lq-line-2 overflow-hidden">
      {MARKETS.map((m) => (
        <button
          key={m.key}
          type="button"
          aria-pressed={value === m.key}
          onClick={() => onChange(m.key)}
          className={`px-2 py-1 text-[11px] transition-colors ${value === m.key ? "bg-lq-surface-2 text-lq-text" : "text-lq-muted hover:text-lq-text"}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export function MoversList({ list }: { list: "gainers" | "losers" | "active" }) {
  const [market, setMarket] = useState<"ALL" | "US" | "IN">("ALL");
  const d = useJson<MoversResponse>(`/api/movers?list=${list}&market=${market}&limit=10`, 120_000);
  return (
    <QuoteList
      id={`mv-${list}`}
      title={MOVER_TITLES[list]}
      aside={<MarketToggle value={market} onChange={setMarket} />}
      loading={d === undefined}
      empty={d?.status === "building" ? "Ranking stocks, one moment…" : "No movers right now."}
      rows={(d?.rows ?? []).map((r) => ({
        key: r.id,
        chart: r.id,
        name: r.name,
        code: r.id,
        price: r.price,
        currency: r.currency,
        changePct: r.changePct,
        note: list === "active" && r.valueUsd ? `$${fmtCompact(r.valueUsd)}` : undefined,
      }))}
      seeAll={{ href: `/app/movers/${list}${market !== "ALL" ? `?market=${market}` : ""}`, label: `See all ${MOVER_TITLES[list].toLowerCase().replace("top ", "")}` }}
      footnote={d?.simulated ? "Sample data" : undefined}
    />
  );
}
