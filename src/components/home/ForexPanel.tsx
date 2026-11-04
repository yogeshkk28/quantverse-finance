import React, { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useJson, Quote, AreaSpark, fmtPrice, fmtSigned, SeeAll, Skeleton } from "./ui";

/** Rupee crosses and the majors: one pair charted over 3 months, the rest as a ticking list. */
export default function ForexPanel({ focus, onFocus }: { focus: string; onFocus: (symbol: string) => void }) {
  const data = useJson<{ pairs: Quote[] }>("/api/forex", 120_000);
  const pairs = (data?.pairs ?? []).filter((p) => p.available);
  const [pick, setPick] = useState("USDINR=X");
  const head = pairs.find((p) => p.symbol === pick) ?? pairs[0];
  const points = head?.spark?.map((c, i) => ({ t: head.sparkTimes?.[i] ?? i, c })) ?? [];
  const up = points.length > 1 ? points[points.length - 1].c >= points[0].c : true;
  const stroke = up ? "var(--lq-up)" : "var(--lq-down)";
  const span = points.length > 1 ? (points[points.length - 1].c / points[0].c - 1) * 100 : null;

  const choose = (s: string) => {
    setPick(s);
    onFocus(s);
  };

  return (
    <section id="forex" className="lq-panel lq-rise p-6 md:p-7 flex flex-col gap-5 min-w-0" aria-labelledby="fx-h" style={{ "--lq-i": 5 } as React.CSSProperties}>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
        <span className="lq-marker" aria-hidden="true" />
        <h2 id="fx-h" className="lq-h2">
          Forex
        </h2>
        <span className="lq-lbl">Mon–Fri · 24h</span>
        <span className="ml-auto">
          <SeeAll href="/app/markets/forex">All currencies</SeeAll>
        </span>
      </div>

      {data === undefined ? (
        <Skeleton className="h-[380px]" />
      ) : !head ? (
        <p className="m-0 py-6 text-center text-[13px] text-lq-muted">Currency rates are unavailable right now.</p>
      ) : (
        <>
          <div className="lq-card p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="font-serif text-[22px] text-lq-text leading-none">{head.short}</span>
                  <span className="lq-lbl text-[10px]">{head.name}</span>
                </span>
                <span className="lq-num text-[30px] leading-none text-lq-text">{fmtPrice(head.price, 4)}</span>
              </div>
              <span className={`lq-num text-[14px] pb-0.5 ${(head.changePct ?? 0) >= 0 ? "lq-up" : "lq-down"}`}>{fmtSigned(head.changePct, 2, "%")} today</span>
              <span className="ml-auto lq-num text-[12px] text-lq-muted pb-0.5">
                3 months <span className={span == null ? "" : span >= 0 ? "lq-up" : "lq-down"}>{fmtSigned(span, 2, "%")}</span>
              </span>
            </div>
            <div className="h-[170px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                  <defs>
                    <linearGradient id="fxFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={["auto", "auto"]} hide />
                  <Tooltip
                    contentStyle={{ background: "var(--lq-surface-2)", border: "1px solid var(--lq-line-2)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "var(--lq-muted)" }}
                    itemStyle={{ color: "var(--lq-text)" }}
                    labelFormatter={(t) => new Date(Number(t) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    formatter={(v: number) => [fmtPrice(v, 4), head.short]}
                  />
                  <Area type="linear" dataKey="c" stroke={stroke} strokeWidth={1.6} fill="url(#fxFill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <ul className="m-0 p-0 list-none flex flex-col" aria-label="Currency pairs">
            {pairs.map((p) => {
              const on = p.symbol === head.symbol;
              return (
                <li key={p.symbol}>
                  <button
                    type="button"
                    onClick={() => choose(p.symbol)}
                    aria-pressed={on}
                    className={`w-full grid grid-cols-[1fr_auto_72px] sm:grid-cols-[1fr_88px_auto_72px] items-center gap-4 px-3 py-3 rounded-lg text-left border transition-colors ${
                      on || focus === p.symbol ? "border-lq-gold-line bg-lq-surface-2" : "border-transparent hover:bg-lq-surface-2"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[14px] text-lq-text">{p.short}</span>
                      <span className="block text-[11px] text-lq-muted truncate">{p.name}</span>
                    </span>
                    <span className="hidden sm:block">
                      <AreaSpark values={(p.spark ?? []).slice(-22)} height={24} strokeWidth={1.3} />
                    </span>
                    <span className="lq-num text-[14px] text-right">{fmtPrice(p.price, 4)}</span>
                    <span className={`lq-num text-[12px] text-right ${(p.changePct ?? 0) >= 0 ? "lq-up" : "lq-down"}`}>{fmtSigned(p.changePct, 2, "%")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
