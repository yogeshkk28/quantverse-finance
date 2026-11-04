import React from "react";
import { Droplet, Droplets, Flame, Coins, Cable, Sparkle } from "lucide-react";
import { useJson, Quote, AreaSpark, RangeBar, fmtPrice, fmtSigned, SeeAll, Skeleton } from "./ui";

const ICON: Record<string, { Icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  "CL=F": { Icon: Droplet, tint: "#c9cbd6" },
  "NG=F": { Icon: Flame, tint: "#7cc4ff" },
  "GC=F": { Icon: Coins, tint: "#d4af37" },
  "HG=F": { Icon: Cable, tint: "#d98a5f" },
  "BZ=F": { Icon: Droplets, tint: "#a3a7b7" },
  "SI=F": { Icon: Sparkle, tint: "#e5e7eb" },
};
const HEADLINE = ["CL=F", "NG=F", "GC=F", "HG=F"];

/**
 * Energy and metals futures up front, so the macro inputs behind a holding
 * (oil for refiners, gas for utilities, copper for miners) are visible on arrival.
 * Linked stocks you hold in the paper portfolio are highlighted.
 */
export default function FuturesPanel({
  held,
  focus,
  onFocus,
}: {
  held: Set<string>;
  focus: string;
  onFocus: (symbol: string) => void;
}) {
  const data = useJson<{ futures: Quote[] }>("/api/futures", 120_000);
  const all = data?.futures ?? [];
  const headline = HEADLINE.map((s) => all.find((f) => f.symbol === s)).filter((f): f is Quote => !!f);
  const more = all.filter((f) => !HEADLINE.includes(f.symbol));

  return (
    <section id="futures" className="lq-panel lq-rise p-6 md:p-7 flex flex-col gap-5 min-w-0" aria-labelledby="fut-h" style={{ "--lq-i": 3 } as React.CSSProperties}>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
        <span className="lq-marker" aria-hidden="true" />
        <h2 id="fut-h" className="lq-h2">
          Commodity futures
        </h2>
        <span className="text-[13px] text-lq-muted">Front month · the raw inputs behind energy, metals and miners</span>
        <span className="ml-auto">
          <SeeAll href="/app/markets/futures">See all futures</SeeAll>
        </span>
      </div>

      {data === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {HEADLINE.map((s) => (
            <Skeleton key={s} className="h-[250px]" />
          ))}
        </div>
      ) : headline.length === 0 ? (
        <p className="m-0 py-6 text-center text-[13px] text-lq-muted">Futures prices are unavailable right now.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {headline.map((f) => (
            <FutureTile key={f.symbol} f={f} held={held} on={focus === f.symbol} onFocus={onFocus} />
          ))}
        </div>
      )}

      {more.length > 0 && (
        <ul className="m-0 p-0 list-none grid gap-3 sm:grid-cols-2">
          {more.map((f) => {
            const { Icon, tint } = ICON[f.symbol] ?? ICON["CL=F"];
            const up = (f.changePct ?? 0) >= 0;
            return (
              <li key={f.symbol}>
                <button
                  type="button"
                  onClick={() => onFocus(f.symbol)}
                  aria-pressed={focus === f.symbol}
                  className={`lq-card w-full px-4 py-3 grid grid-cols-[32px_1fr_auto_auto] items-center gap-3 text-left transition-colors ${
                    focus === f.symbol ? "!border-lq-gold" : "hover:border-lq-line-2"
                  }`}
                >
                  <span className="w-8 h-8 rounded-full grid place-items-center bg-lq-bg-2 border border-lq-line" style={{ color: tint }}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] text-lq-text truncate">{f.name}</span>
                    <span className="lq-num text-[10px] text-lq-muted">
                      {f.short} · {f.exchange}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="lq-num text-[14px] block">{f.available ? `${f.currency}${fmtPrice(f.price)}` : "—"}</span>
                    <span className="text-[10px] text-lq-muted">{f.unit}</span>
                  </span>
                  <span className={`lq-num text-[12px] w-[68px] text-right ${up ? "lq-up" : "lq-down"}`}>{f.available ? fmtSigned(f.changePct, 2, "%") : "—"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="m-0 text-[11px] text-lq-muted">Continuous front-month contracts from public delayed data. Linked stocks are examples of companies whose costs or revenue track the commodity.</p>
    </section>
  );
}

function FutureTile({ f, held, on, onFocus }: { f: Quote; held: Set<string>; on: boolean; onFocus: (s: string) => void }) {
  const { Icon, tint } = ICON[f.symbol] ?? ICON["CL=F"];
  const up = (f.changePct ?? 0) >= 0;
  const linkedHeld = (f.linked ?? []).filter((t) => held.has(t));
  return (
    <article
      className={`lq-card p-5 flex flex-col gap-3 min-w-0 transition-colors ${on ? "!border-lq-gold" : "hover:border-lq-line-2"}`}
      aria-label={f.name}
    >
      <button type="button" onClick={() => onFocus(f.symbol)} aria-pressed={on} className="flex flex-col gap-3 text-left">
        <span className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full grid place-items-center border border-lq-line-2 bg-lq-bg-2 flex-none" style={{ color: tint, boxShadow: `0 0 24px ${tint}22` }}>
            <Icon className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] text-lq-text font-medium truncate">{f.name}</span>
            <span className="flex items-center gap-1.5 mt-1">
              <span className="lq-num text-[10px] px-1.5 py-0.5 rounded bg-lq-bg-2 border border-lq-line text-lq-text-2">{f.short} · front</span>
              <span className="lq-lbl text-[10px]">{f.exchange}</span>
            </span>
          </span>
        </span>
        <span className="flex items-end justify-between gap-2">
          <span>
            <span className="lq-num text-[24px] leading-none text-lq-text block">{f.available ? fmtPrice(f.price) : "—"}</span>
            <span className="text-[11px] text-lq-muted">USD {f.unit}</span>
          </span>
          <span className="text-right">
            <span className={`lq-num text-[14px] block ${up ? "lq-up" : "lq-down"}`}>{f.available ? fmtSigned(f.changePct, 2, "%") : "—"}</span>
            <span className={`lq-num text-[11px] ${up ? "lq-up" : "lq-down"}`}>{f.available ? fmtSigned(f.change, f.price && f.price < 20 ? 3 : 2) : ""}</span>
          </span>
        </span>
        <span className="-mx-1 block">
          <AreaSpark values={f.spark ?? []} height={44} baseline={f.spark?.[0]} label={`${f.name}, last 30 sessions`} />
        </span>
        <RangeBar label="52 week" low={f.low52} high={f.high52} value={f.price} />
      </button>
      {f.linked && f.linked.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-lq-line-soft">
          <span className="lq-lbl text-[10px] mr-1">Moves</span>
          {f.linked.map((t) => (
            <span
              key={t}
              title={held.has(t) ? "In your paper portfolio" : undefined}
              className={`lq-num text-[10px] px-1.5 py-0.5 rounded border ${held.has(t) ? "border-lq-gold text-lq-gold-soft bg-[rgba(212,175,55,0.1)]" : "border-lq-line text-lq-muted"}`}
            >
              {t}
            </span>
          ))}
          {linkedHeld.length > 0 && <span className="text-[10px] text-lq-gold ml-auto">You hold {linkedHeld.length}</span>}
        </div>
      )}
    </article>
  );
}
