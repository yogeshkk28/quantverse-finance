import React from "react";
import { useJson, Quote, AreaSpark, RangeBar, fmtPrice, fmtSigned, asOfLabel, Skeleton } from "./ui";

const REGION_LABEL: Record<string, string> = { US: "United States", IN: "India" };

/**
 * The headline indices as large cards: price, day move, 30-session trend,
 * day and 52-week range. Selecting a card drives the chart and the dossier.
 */
export default function IndexDeck({ selected, onSelect }: { selected: string; onSelect: (symbol: string) => void }) {
  const data = useJson<{ indices: Quote[] }>("/api/index-cards", 120_000);
  const list = data?.indices ?? [];

  return (
    <section aria-labelledby="deck-h" className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span className="lq-marker" aria-hidden="true" />
        <h2 id="deck-h" className="lq-h2">
          Benchmarks
        </h2>
        <span className="text-[13px] text-lq-muted">United States and India · delayed daily data</span>
      </div>
      <div role="list" className="grid gap-4 grid-flow-col auto-cols-[82%] overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {data === undefined
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} role="listitem" className="lq-panel p-5 flex flex-col gap-4 min-h-[232px]">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-14 w-full" />
              </div>
            ))
          : list.map((q, i) => <IndexCard key={q.symbol} q={q} i={i} on={selected === q.symbol} onSelect={onSelect} />)}
      </div>
      {data === null && <p className="m-0 text-[13px] text-lq-muted">Index data is unavailable right now.</p>}
    </section>
  );
}

function IndexCard({ q, i, on, onSelect }: { q: Quote; i: number; on: boolean; onSelect: (s: string) => void }) {
  const up = (q.changePct ?? 0) >= 0;
  const base = q.spark && q.spark.length > 1 ? q.spark[0] : undefined;
  const trend = q.spark && base ? ((q.spark[q.spark.length - 1] / base - 1) * 100) : null;
  return (
    <div role="listitem" className="lq-rise snap-start" style={{ "--lq-i": i } as React.CSSProperties}>
      <button
        type="button"
        onClick={() => onSelect(q.symbol)}
        aria-pressed={on}
        aria-label={`${q.name}${q.available ? `, ${fmtPrice(q.price)}, ${fmtSigned(q.changePct, 2, "%")} today` : ", unavailable"}`}
        className={`lq-panel group w-full h-full text-left p-5 flex flex-col gap-3 overflow-hidden transition-[border-color,transform] duration-200 hover:-translate-y-0.5 ${
          on ? "!border-lq-gold shadow-[0_0_0_1px_var(--lq-gold-line),0_18px_50px_rgba(212,175,55,0.08)]" : "hover:border-lq-line-2"
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -right-10 -top-12 w-40 h-40 rounded-full blur-2xl transition-opacity ${on ? "opacity-100" : "opacity-50 group-hover:opacity-80"}`}
          style={{ background: `radial-gradient(closest-side, ${up ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)"}, transparent)` }}
        />
        <span className="flex items-center justify-between gap-2">
          <span className="flex flex-col min-w-0">
            <span className="font-serif text-[20px] leading-tight text-lq-text truncate">{q.name}</span>
            <span className="lq-lbl text-[10px] mt-0.5">
              {q.short} · {REGION_LABEL[q.region] ?? q.region}
            </span>
          </span>
          <span className={`lq-num text-[11px] px-2 py-1 rounded-md whitespace-nowrap flex-none ${up ? "bg-[rgba(74,222,128,0.1)] lq-up" : "bg-[rgba(248,113,113,0.1)] lq-down"}`}>
            {q.available ? `${up ? "▲" : "▼"} ${Math.abs(q.changePct ?? 0).toFixed(2)}%` : "—"}
          </span>
        </span>

        <span className="flex items-baseline gap-2 flex-wrap">
          <span className="lq-num text-[26px] leading-none text-lq-text tracking-tight">
            {q.available ? `${q.currency}${fmtPrice(q.price, 2)}` : "—"}
          </span>
          {q.available && <span className={`lq-num text-[12px] ${up ? "lq-up" : "lq-down"}`}>{fmtSigned(q.change)}</span>}
        </span>

        <span className="-mx-1 block">
          <AreaSpark values={q.spark ?? []} height={58} baseline={base} label={`${q.name} last 30 sessions`} />
        </span>
        <span className="flex justify-between text-[11px] -mt-1">
          <span className="text-lq-muted">30 sessions</span>
          <span className={`lq-num ${trend == null ? "text-lq-muted" : trend >= 0 ? "lq-up" : "lq-down"}`}>{fmtSigned(trend, 2, "%")}</span>
        </span>

        <span className="grid grid-cols-2 gap-3 pt-2 border-t border-lq-line-soft">
          <RangeBar label="Day" low={q.dayLow} high={q.dayHigh} value={q.price} digits={0} />
          <RangeBar label="52 week" low={q.low52} high={q.high52} value={q.price} digits={0} />
        </span>
        {q.asOf && <span className="lq-num text-[10px] text-lq-muted">As of {asOfLabel(q.asOf)}</span>}
      </button>
    </div>
  );
}
