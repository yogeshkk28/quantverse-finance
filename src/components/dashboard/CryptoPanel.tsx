import React, { useEffect, useState } from "react";
import { PanelHead, Change, Sparkline, Empty, fmtNum, fmtCompact } from "./parts";

interface Coin {
  id: string;
  name: string;
  available: boolean;
  price?: number;
  changePct?: number;
  change30Pct?: number | null;
  volume?: number;
  spark?: number[];
}

/** Five large coins with 30-day trend, plus the crypto Fear & Greed reading. */
export default function CryptoPanel() {
  const [coins, setCoins] = useState<Coin[] | null>(null);
  const [fg, setFg] = useState<{ value: number; classification: string } | null>(null);
  const [active, setActive] = useState("BTC");

  useEffect(() => {
    fetch("/api/crypto")
      .then((r) => r.json())
      .then((d) => setCoins(Array.isArray(d.coins) ? d.coins : []))
      .catch(() => setCoins([]));
    fetch("/api/fear-greed?market=US")
      .then((r) => r.json())
      .then((d) => setFg(d.crypto ?? null))
      .catch(() => setFg(null));
  }, []);

  const live = (coins ?? []).filter((c) => c.available);
  const sel = live.find((c) => c.id === active) ?? live[0];

  return (
    <section id="crypto" className="lq-panel lq-rise p-5 md:p-6 flex flex-col gap-4 min-w-0" aria-labelledby="cry-h" style={{ "--lq-i": 5 } as React.CSSProperties}>
      <PanelHead id="cry-h" title="Crypto" aside={<span className="lq-lbl">24/7 market</span>} />
      {coins === null ? (
        <Empty>Loading coins…</Empty>
      ) : live.length === 0 ? (
        <Empty>Crypto prices are unavailable right now.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-2">
            {live.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                aria-pressed={sel?.id === c.id}
                className={`lq-card grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_80px] items-center gap-4 px-4 py-3 text-left transition-colors ${
                  sel?.id === c.id ? "!border-lq-gold" : "hover:border-lq-line-2"
                }`}
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <strong className="text-[14px]">{c.id}</strong>
                  <span className="text-[12px] text-lq-muted truncate">{c.name}</span>
                </span>
                <span className="lq-num text-[14px] text-right">${fmtNum(c.price ?? 0, (c.price ?? 0) < 10 ? 4 : 2)}</span>
                <Change pct={c.changePct} className="text-[12px] text-right" />
                <span className="hidden sm:block">
                  <Sparkline values={c.spark ?? []} width={80} height={24} />
                </span>
              </button>
            ))}
          </div>
          {sel && (
            <div className="flex flex-col gap-3">
              <div className="lq-card p-4 flex flex-col gap-2">
                <span className="lq-lbl">{sel.name} · 30 days</span>
                <Sparkline values={sel.spark ?? []} width={320} height={90} label={`${sel.name} 30-day price trend`} />
                <div className="flex justify-between text-[12px]">
                  <span className="text-lq-muted">30D change</span>
                  <Change pct={sel.change30Pct ?? null} />
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-lq-muted">Volume, last day</span>
                  <span className="lq-num">{sel.volume ? `$${fmtCompact(sel.volume)}` : "—"}</span>
                </div>
              </div>
              <div className="lq-card p-4 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="lq-lbl">Crypto Fear &amp; Greed</span>
                  <span className="text-[12px] text-lq-muted">alternative.me</span>
                </div>
                <div className="text-right">
                  <span className="lq-num text-[22px] text-lq-gold-soft block leading-none">{fg?.value ?? "—"}</span>
                  <span className="lq-lbl">{fg?.classification ?? "Unavailable"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
