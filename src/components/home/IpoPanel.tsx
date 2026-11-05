import React, { useState } from "react";
import { useJson, Skeleton } from "./ui";

interface Ipo {
  name: string;
  symbol: string | null;
  market: "US" | "IN";
  exchange: string;
  board: string;
  status: "upcoming" | "open" | "listed";
  openDate: string | null;
  closeDate: string | null;
  priceBand: string | null;
  size: string | null;
}
interface Feed {
  available: boolean;
  reason?: string;
  source?: string;
  items: Ipo[];
}

const MARKETS = [
  { key: "IN", label: "India" },
  { key: "US", label: "United States" },
] as const;
const STAGES = [
  { key: "upcoming", label: "Upcoming" },
  { key: "open", label: "Open now" },
  { key: "listed", label: "Recently listed" },
] as const;

function fmtDate(s: string | null) {
  if (!s) return "TBA";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Upcoming, open and recent IPOs for India (NSE mainboard and SME) and the US. */
export default function IpoPanel() {
  const data = useJson<{ US: Feed; IN: Feed }>("/api/ipos");
  const [market, setMarket] = useState<"IN" | "US">("IN");
  const [stage, setStage] = useState<Ipo["status"]>("upcoming");
  const feed = data?.[market];
  const rows = (feed?.items ?? []).filter((i) => i.status === stage);
  const count = (s: Ipo["status"]) => (feed?.items ?? []).filter((i) => i.status === s).length;

  return (
    <section id="ipo" className="lq-panel lq-rise p-5 flex flex-col gap-3 min-w-0" aria-labelledby="ipo-h">
      <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
        <h2 id="ipo-h" className="m-0 text-[17px] font-semibold text-lq-text">
          IPO calendar
        </h2>
        <div role="group" aria-label="Market" className="ml-auto flex gap-1">
          {MARKETS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={market === m.key}
              onClick={() => setMarket(m.key)}
              className={`px-2 py-1 rounded-md text-[11px] ${market === m.key ? "bg-lq-surface-2 text-lq-text border border-lq-line-2" : "text-lq-muted hover:text-lq-text border border-transparent"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tablist" aria-label="IPO stage" className="flex gap-1 border-b border-lq-line">
        {STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={stage === s.key}
            onClick={() => setStage(s.key)}
            className={`px-2.5 py-2 text-[12px] whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              stage === s.key ? "border-lq-gold text-lq-text" : "border-transparent text-lq-muted hover:text-lq-text"
            }`}
          >
            {s.label}
            {feed?.available && <span className="lq-num text-[10px] text-lq-muted">{count(s.key)}</span>}
          </button>
        ))}
      </div>

      {data === undefined ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[64px]" />
          ))}
        </div>
      ) : !feed?.available ? (
        <div className="lq-card p-5 flex flex-col gap-1">
          <p className="m-0 text-[14px] text-lq-text">The {market === "IN" ? "Indian" : "US"} IPO calendar isn't available.</p>
          <p className="m-0 text-[12px] text-lq-muted">{feed?.reason ?? "The server couldn't load it."} Nothing is shown until real data loads.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="m-0 py-8 text-center text-[13px] text-lq-muted">No {STAGES.find((s) => s.key === stage)!.label.toLowerCase()} IPOs in this window.</p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col max-h-[360px] overflow-y-auto pr-1">
          {rows.map((i) => (
            <li key={`${i.name}-${i.openDate}`} className="border-b border-lq-line-soft last:border-0 px-1 py-2.5 grid grid-cols-[52px_1fr_auto] items-center gap-4">
              <span className="flex flex-col items-center justify-center rounded-lg border border-lq-line-2 bg-lq-surface-2 py-1">
                <span className="lq-lbl text-[9px] text-lq-gold">{fmtDate(i.openDate).split(" ")[0]}</span>
                <span className="lq-num text-[16px] text-lq-text leading-none">{fmtDate(i.openDate).split(" ")[1] ?? "—"}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] text-lq-text truncate">{i.name}</span>
                <span className="flex items-center gap-2 mt-0.5 text-[11px] text-lq-muted">
                  {i.symbol && <span className="lq-num text-lq-text-2">{i.symbol}</span>}
                  <span>{i.exchange}</span>
                  <span className={`px-1.5 rounded border ${i.board === "SME" ? "border-lq-gold-deep text-lq-gold-soft" : "border-lq-line"}`}>{i.board}</span>
                  {i.closeDate && i.closeDate !== i.openDate && <span>closes {fmtDate(i.closeDate)}</span>}
                </span>
              </span>
              <span className="text-right">
                <span className="lq-num text-[13px] block text-lq-text-2">{i.priceBand ?? "Price TBA"}</span>
                <span className="lq-num text-[11px] text-lq-muted">{i.size ?? ""}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-[11px] text-lq-muted">
        {feed?.source ? `Source: ${feed.source}.` : ""} Listing dates and price bands can change; check the offer document before applying.
      </p>
    </section>
  );
}
