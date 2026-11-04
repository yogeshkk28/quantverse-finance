import React from "react";
import { useJson, AreaSpark, fmtPrice, fmtSigned, SeeAll, Skeleton } from "./ui";
import { fmtCompact } from "../dashboard/parts";

interface Coin {
  id: string;
  symbol: string;
  name: string;
  available: boolean;
  price?: number;
  changePct?: number;
  change30Pct?: number | null;
  volume?: number;
  spark?: number[];
}

/** Large coins as a card grid, with the crypto Fear & Greed reading in the header. */
export default function CryptoGrid({ focus, onFocus }: { focus: string; onFocus: (symbol: string) => void }) {
  const data = useJson<{ coins: Coin[] }>("/api/crypto", 120_000);
  const fg = useJson<{ crypto: { value: number; classification: string } | null }>("/api/fear-greed?market=US");
  const coins = (data?.coins ?? []).filter((c) => c.available);
  const reading = fg?.crypto ?? null;

  return (
    <section id="crypto" className="lq-panel lq-rise p-6 md:p-7 flex flex-col gap-5 min-w-0" aria-labelledby="cry-h" style={{ "--lq-i": 6 } as React.CSSProperties}>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
        <span className="lq-marker" aria-hidden="true" />
        <h2 id="cry-h" className="lq-h2">
          Crypto
        </h2>
        <span className="lq-lbl">24/7</span>
        {reading && (
          <span className="flex items-center gap-2 lq-card px-2.5 py-1">
            <span className="lq-lbl text-[10px]">Fear &amp; Greed</span>
            <span className="lq-num text-[13px] text-lq-gold-soft">{reading.value}</span>
            <span className="text-[11px] text-lq-muted">{reading.classification}</span>
          </span>
        )}
        <span className="ml-auto">
          <SeeAll href="/app/markets/crypto">All crypto</SeeAll>
        </span>
      </div>

      {data === undefined ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[112px]" />
          ))}
        </div>
      ) : coins.length === 0 ? (
        <p className="m-0 py-6 text-center text-[13px] text-lq-muted">Crypto prices are unavailable right now.</p>
      ) : (
        <ul className="m-0 p-0 list-none grid gap-3 grid-cols-1 sm:grid-cols-2">
          {coins.map((c) => {
            const sym = `${c.id}-USD`;
            const on = focus === sym;
            const up = (c.changePct ?? 0) >= 0;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onFocus(sym)}
                  aria-pressed={on}
                  className={`lq-card w-full p-4 flex flex-col gap-2 text-left transition-colors ${on ? "!border-lq-gold" : "hover:border-lq-line-2"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full grid place-items-center bg-lq-bg-2 border border-lq-gold-line lq-num text-[10px] text-lq-gold-soft flex-none">
                      {c.id.slice(0, 4)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] text-lq-text">{c.name}</span>
                      <span className="lq-num text-[10px] text-lq-muted">{c.id} / USD</span>
                    </span>
                    <span className="text-right">
                      <span className="lq-num text-[15px] block text-lq-text">${fmtPrice(c.price)}</span>
                      <span className={`lq-num text-[12px] ${up ? "lq-up" : "lq-down"}`}>{fmtSigned(c.changePct, 2, "%")}</span>
                    </span>
                  </span>
                  <AreaSpark values={c.spark ?? []} height={34} baseline={c.spark?.[0]} strokeWidth={1.3} label={`${c.name}, 30 days`} />
                  <span className="flex justify-between text-[11px]">
                    <span className="text-lq-muted">
                      30D <span className={`lq-num ${(c.change30Pct ?? 0) >= 0 ? "lq-up" : "lq-down"}`}>{fmtSigned(c.change30Pct, 1, "%")}</span>
                    </span>
                    <span className="text-lq-muted">
                      Vol <span className="lq-num text-lq-text-2">{c.volume ? `$${fmtCompact(c.volume)}` : "—"}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
