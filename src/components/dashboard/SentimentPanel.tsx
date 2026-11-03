import React, { useEffect, useState } from "react";
import { PanelHead, ChipGroup } from "./parts";

interface FearGreedData {
  market: "US" | "IN";
  value: number | null;
  label: string;
  components: { key: string; label: string; score: number; detail: string }[];
  crypto: { value: number; classification: string } | null;
}

interface MacroData {
  available: boolean;
  reason?: string;
  indicators: { series: string; label: string; value: number | null; date: string | null; unit: string }[];
}

const MARKETS = ["US", "India"] as const;

/** Lumina Fear & Greed (computed in server/fearGreed.ts) with its inputs. */
export function SentimentPanel() {
  const [market, setMarket] = useState<(typeof MARKETS)[number]>("US");
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/fear-greed?market=${market === "US" ? "US" : "IN"}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [market]);

  const v = data?.value ?? null;

  return (
    <section className="lq-panel lq-rise p-5 flex flex-col gap-4" aria-labelledby="fg-h" style={{ "--lq-i": 2 } as React.CSSProperties}>
      <PanelHead id="fg-h" title="Market sentiment" size="h3" marker={false} aside={<ChipGroup label="Market" options={MARKETS} value={market} onChange={setMarket} />} />
      <div className="flex items-center gap-4">
        <svg className="w-36 flex-none" viewBox="0 0 100 56" role="img" aria-label={v != null ? `Fear and Greed ${v} of 100, ${data?.label}` : "Fear and Greed unavailable"}>
          <defs>
            <linearGradient id="fgGrad" x1="0" x2="1">
              <stop offset="0" stopColor="#8A7425" />
              <stop offset="0.55" stopColor="#D4AF37" />
              <stop offset="1" stopColor="#F5E6CA" />
            </linearGradient>
          </defs>
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--lq-line-2)" strokeWidth="8" />
          {v != null && (
            <>
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#fgGrad)" strokeWidth="8" pathLength={100} strokeDasharray="100" strokeDashoffset={100 - v} />
              <g transform={`rotate(${(v / 100) * 180 - 90} 50 50)`}>
                <line x1="50" y1="50" x2="50" y2="18" stroke="var(--lq-gold-soft)" strokeWidth="2" strokeLinecap="round" />
              </g>
            </>
          )}
          <circle cx="50" cy="50" r="3.5" fill="var(--lq-bg)" stroke="var(--lq-gold)" strokeWidth="1.5" />
        </svg>
        <div className="flex flex-col gap-1">
          <span className="lq-num text-[34px] leading-none text-lq-gold-soft">{loading ? "…" : v ?? "—"}</span>
          <span className="lq-lbl">{loading ? "Loading" : data?.label ?? "Unavailable"}</span>
        </div>
      </div>
      {data && data.components.length > 0 && (
        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {data.components.map((c) => (
            <li key={c.key} title={c.detail} className="grid grid-cols-[110px_1fr_28px] items-center gap-2 text-[12px]">
              <span className="text-lq-muted truncate">{c.label}</span>
              <span className="h-1.5 rounded-full bg-lq-line overflow-hidden">
                <span className="block h-full rounded-full bg-lq-gold" style={{ width: `${c.score}%` }} />
              </span>
              <span className="lq-num text-right text-lq-text-2">{c.score}</span>
            </li>
          ))}
        </ul>
      )}
      {!loading && v == null && <p className="text-[12px] text-lq-muted m-0">Not enough market data loaded to compute the index right now.</p>}
      <p className="text-[11px] text-lq-muted m-0">Each input is ranked against its last 252 sessions.</p>
    </section>
  );
}

/** FRED macro readings. */
export function MacroPanel() {
  const [macro, setMacro] = useState<MacroData | null>(null);
  useEffect(() => {
    fetch("/api/macro")
      .then((r) => r.json())
      .then(setMacro)
      .catch(() => setMacro(null));
  }, []);

  const rows = macro?.indicators ?? [];

  return (
    <section className="lq-panel lq-rise p-5 flex flex-col gap-3" aria-labelledby="macro-h" style={{ "--lq-i": 3 } as React.CSSProperties}>
      <PanelHead id="macro-h" title="Macro pulse" size="h3" marker={false} aside={<span className="lq-lbl">FRED</span>} />
      {!macro?.available && <p className="text-[12px] text-lq-muted m-0">{macro?.reason ?? "Macro data unavailable."}</p>}
      <ul className="flex flex-col m-0 p-0 list-none">
        {rows.map((i) => (
          <li key={i.series} className="flex items-baseline justify-between gap-3 py-2 border-b border-lq-line-soft last:border-0">
            <span className="text-[13px] text-lq-text-2">{i.label}</span>
            <span className="flex items-baseline gap-2">
              <span className="lq-num text-[14px]">{i.value != null ? `${i.value}${i.unit}` : "—"}</span>
              {i.date && <span className="lq-num text-[11px] text-lq-muted">{i.date.slice(0, 7)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
