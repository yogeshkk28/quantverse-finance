import React, { useEffect, useMemo, useState } from "react";
import { PanelHead, ChipGroup, Change, Sparkline, Empty, fmtNum, fmtCompact } from "./parts";

interface Row {
  id: string;
  name: string;
  market: "US" | "IN";
  exchange: string;
  currency: string;
  price: number;
  changePct: number;
  volume: number;
  value: number;
  relVol: number | null;
  spark: number[];
}

const REGIONS = ["All", "US", "India"] as const;
const LISTS = ["Most active", "Top gainers", "Top losers", "Unusual volume"] as const;
const RANK = ["By shares", "By value"] as const;

/** Highest-volume names in the tracked universe, ranked live from daily candles. */
export default function MostActivePanel({ onSelect, onOpenScreener }: { onSelect: (id: string) => void; onOpenScreener: () => void }) {
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("All");
  const [list, setList] = useState<(typeof LISTS)[number]>("Most active");
  const [rank, setRank] = useState<(typeof RANK)[number]>("By value");
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    const m = region === "All" ? "ALL" : region === "US" ? "US" : "IN";
    fetch(`/api/most-active?market=${m}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setRows(Array.isArray(d.rows) ? d.rows : []))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [region]);

  const sorted = useMemo(() => {
    const xs = [...(rows ?? [])];
    if (list === "Top gainers") xs.sort((a, b) => b.changePct - a.changePct);
    else if (list === "Top losers") xs.sort((a, b) => a.changePct - b.changePct);
    else if (list === "Unusual volume") xs.sort((a, b) => (b.relVol ?? 0) - (a.relVol ?? 0));
    // Shares can't be compared across currencies, so "By value" is the fair cross-market ranking.
    else if (rank === "By shares") xs.sort((a, b) => b.volume - a.volume);
    else xs.sort((a, b) => b.value / fx(b) - a.value / fx(a));
    return xs.slice(0, 10);
  }, [rows, list, rank]);

  return (
    <section className="lq-panel lq-rise p-5 md:p-6 flex flex-col gap-4 min-w-0" aria-labelledby="vol-h" style={{ "--lq-i": 4 } as React.CSSProperties}>
      <PanelHead
        id="vol-h"
        title="Highest volume"
        aside={
          <button type="button" onClick={onOpenScreener} className="text-[13px] text-lq-gold hover:text-lq-gold-soft">
            Open in Screener
          </button>
        }
      />
      <div className="flex flex-wrap gap-3 items-center">
        <ChipGroup label="Region" options={REGIONS} value={region} onChange={setRegion} />
        {list === "Most active" && <ChipGroup label="Rank by" options={RANK} value={rank} onChange={setRank} />}
      </div>
      <div role="tablist" aria-label="List" className="flex gap-1 border-b border-lq-line overflow-x-auto">
        {LISTS.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={list === l}
            onClick={() => setList(l)}
            className={`px-3 py-2.5 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
              list === l ? "border-lq-gold text-lq-text" : "border-transparent text-lq-muted hover:text-lq-text"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {rows === null ? (
        <Empty>Loading volume…</Empty>
      ) : sorted.length === 0 ? (
        <Empty>Volume data is unavailable right now.</Empty>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="lq-table text-[13px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Symbol</th>
                <th>Exch</th>
                <th className="text-right">Last</th>
                <th className="text-right">Chg %</th>
                <th className="text-right">Volume</th>
                <th>Rel. vol (20D)</th>
                <th>5D</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.id} className="hover:bg-lq-surface-2 cursor-pointer" onClick={() => onSelect(r.id)}>
                  <td className="lq-num text-lq-muted">{String(i + 1).padStart(2, "0")}</td>
                  <td>
                    <button type="button" onClick={() => onSelect(r.id)} className="text-left">
                      <span className="block font-medium text-lq-text">{r.id}</span>
                      <span className="block text-[11px] text-lq-muted max-w-[180px] truncate">{r.name}</span>
                    </button>
                  </td>
                  <td>
                    <span className="lq-lbl">{r.exchange}</span>
                  </td>
                  <td className="lq-num text-right">
                    {r.currency}
                    {fmtNum(r.price)}
                  </td>
                  <td className="text-right">
                    <Change pct={r.changePct} />
                  </td>
                  <td className="lq-num text-right">{fmtCompact(r.volume)}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className="w-16 h-1.5 rounded-full bg-lq-line overflow-hidden">
                        <span className="block h-full bg-lq-gold" style={{ width: `${Math.min(100, ((r.relVol ?? 0) / 3) * 100)}%` }} />
                      </span>
                      <span className="lq-num text-[12px] text-lq-text-2">{r.relVol != null ? `${r.relVol.toFixed(1)}x` : "—"}</span>
                    </span>
                  </td>
                  <td>
                    <Sparkline values={r.spark} width={64} height={20} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-lq-muted m-0">Ranked across the tracked universe from the latest daily session. Delayed data.</p>
    </section>
  );
}

/** Rough USD conversion so INR traded value ranks fairly against USD. Only used for ordering. */
function fx(r: Row) {
  return r.currency === "₹" ? 84 : 1;
}
