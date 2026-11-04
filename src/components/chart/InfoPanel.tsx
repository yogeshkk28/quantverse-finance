/**
 * Right-hand panel on the chart page: quote, ranges, key stats, performance, a technical
 * read of the current chart, classic pivot levels, price alerts and paper trading.
 */
import React, { useMemo, useState } from "react";
import { BellPlus, Trash2 } from "lucide-react";
import type { Ticker } from "../../types";
import { Bar, technicalSummary } from "./indicators";
import { formatPrice, formatVolume } from "./ChartCanvas";

export interface QuoteInfo {
  name: string;
  exchange: string;
  symbol: string;
  currencySymbol: string;
  price: number;
  previousClose: number;
  dayHigh: number | null;
  dayLow: number | null;
  dayVolume: number | null;
  high52: number | null;
  low52: number | null;
  source: "yahoo" | "sample";
  asOf: string;
}

interface Props {
  quote: QuoteInfo;
  daily: Bar[];
  chartBars: Bar[];
  intervalLabel: string;
  digits: number;
  ticker?: Ticker;
  alerts: number[];
  onAddAlert: (price: number) => void;
  onRemoveAlert: (price: number) => void;
  onTrade: (side: "buy" | "sell") => void;
}

function RangeBar({ low, high, value, label, fmt }: { low: number; high: number; value: number; label: string; fmt: (v: number) => string }) {
  const pct = high > low ? Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100)) : 50;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px] font-mono text-lq-muted">
        <span>{fmt(low)}</span>
        <span className="lq-lbl text-[10px]">{label}</span>
        <span>{fmt(high)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-lq-line">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-lq-down/60 via-lq-gold/50 to-lq-up/60" style={{ width: `${pct}%` }} />
        <div className="absolute -top-1 w-0.5 h-3.5 bg-lq-text rounded" style={{ left: `calc(${pct}% - 1px)` }} />
      </div>
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="px-4 py-3.5 border-b border-lq-line flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="lq-lbl m-0">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function InfoPanel({ quote, daily, chartBars, intervalLabel, digits, ticker, alerts, onAddAlert, onRemoveAlert, onTrade }: Props) {
  const fmt = (v: number) => formatPrice(v, digits);
  const cs = quote.currencySymbol;
  const ch = quote.price - quote.previousClose;
  const pct = quote.previousClose ? (ch / quote.previousClose) * 100 : 0;
  const up = ch >= 0;
  const [alertInput, setAlertInput] = useState("");

  const stats = useMemo(() => {
    const n = daily.length;
    if (n < 2) return null;
    const last = daily[n - 1];
    const prev = daily[n - 2];
    const vols = daily.slice(-31, -1).map((b) => b.volume);
    const avgVol = vols.length ? vols.reduce((s, v) => s + v, 0) / vols.length : null;
    const perfAt = (k: number) => (n > k ? (last.close / daily[n - 1 - k].close - 1) * 100 : null);
    const yStart = new Date(Date.UTC(new Date(last.time * 1000).getUTCFullYear(), 0, 1)).getTime() / 1000;
    const firstOfYear = daily.findIndex((b) => b.time >= yStart);
    const ytdBase = firstOfYear > 0 ? daily[firstOfYear - 1].close : null;
    // Classic floor pivots from the previous completed session
    const P = (prev.high + prev.low + prev.close) / 3;
    const pivots = [
      { k: "R3", v: prev.high + 2 * (P - prev.low) },
      { k: "R2", v: P + (prev.high - prev.low) },
      { k: "R1", v: 2 * P - prev.low },
      { k: "P", v: P },
      { k: "S1", v: 2 * P - prev.high },
      { k: "S2", v: P - (prev.high - prev.low) },
      { k: "S3", v: prev.low - 2 * (prev.high - P) },
    ];
    const year = daily.slice(-252);
    return {
      open: last.open,
      avgVol,
      relVol: avgVol ? last.volume / avgVol : null,
      high52: Math.max(...year.map((b) => b.high)),
      low52: Math.min(...year.map((b) => b.low)),
      perf: [
        { k: "1W", v: perfAt(5) },
        { k: "1M", v: perfAt(21) },
        { k: "3M", v: perfAt(63) },
        { k: "6M", v: perfAt(126) },
        { k: "YTD", v: ytdBase ? (last.close / ytdBase - 1) * 100 : null },
        { k: "1Y", v: perfAt(252) },
      ],
      pivots,
    };
  }, [daily]);

  const tech = useMemo(() => technicalSummary(chartBars), [chartBars]);
  const buys = tech.signals.filter((s) => s.vote > 0).length;
  const sells = tech.signals.filter((s) => s.vote < 0).length;
  const neutral = tech.signals.length - buys - sells;
  const verdict = tech.score > 0.5 ? "Strong buy" : tech.score > 0.15 ? "Buy" : tech.score < -0.5 ? "Strong sell" : tech.score < -0.15 ? "Sell" : "Neutral";
  const verdictCol = tech.score > 0.15 ? "text-lq-up" : tech.score < -0.15 ? "text-lq-down" : "text-lq-text-2";
  const [showSignals, setShowSignals] = useState(false);

  const dayLow = quote.dayLow ?? daily[daily.length - 1]?.low;
  const dayHigh = quote.dayHigh ?? daily[daily.length - 1]?.high;
  const low52 = quote.low52 ?? stats?.low52;
  const high52 = quote.high52 ?? stats?.high52;

  return (
    <div className="flex flex-col">
      {/* Quote */}
      <section className="px-4 pt-4 pb-3.5 border-b border-lq-line">
        <div className="flex items-center gap-2 text-[12px] text-lq-muted">
          <span className="truncate">{quote.name}</span>
          {quote.exchange && <span className="lq-tag shrink-0">{quote.exchange}</span>}
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="font-mono text-[28px] leading-none text-lq-text tabular-nums">{cs}{fmt(quote.price)}</span>
        </div>
        <div className={`font-mono text-[13px] mt-1.5 tabular-nums ${up ? "text-lq-up" : "text-lq-down"}`}>
          {up ? "▲" : "▼"} {up ? "+" : ""}{fmt(ch)} ({up ? "+" : ""}{pct.toFixed(2)}%)
        </div>
        <div className="text-[11px] text-lq-muted mt-1.5">
          {quote.source === "sample" ? "Sample data: live feed unavailable" : `Delayed · as of ${new Date(quote.asOf).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3.5">
          <button type="button" onClick={() => onTrade("buy")} className="rounded-lg py-2 text-[12px] font-semibold uppercase tracking-wider bg-lq-up/15 text-lq-up border border-lq-up/30 hover:bg-lq-up/25 transition-colors">
            Buy
          </button>
          <button type="button" onClick={() => onTrade("sell")} className="rounded-lg py-2 text-[12px] font-semibold uppercase tracking-wider bg-lq-down/15 text-lq-down border border-lq-down/30 hover:bg-lq-down/25 transition-colors">
            Sell
          </button>
        </div>
      </section>

      {/* Ranges */}
      <Section title="Ranges">
        {dayLow != null && dayHigh != null && <RangeBar low={dayLow} high={dayHigh} value={quote.price} label="Day" fmt={fmt} />}
        {low52 != null && high52 != null && <RangeBar low={low52} high={high52} value={quote.price} label="52 week" fmt={fmt} />}
      </Section>

      {/* Key stats */}
      <Section title="Key stats">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 m-0 text-[12px]">
          {[
            ["Open", stats ? fmt(stats.open) : "—"],
            ["Prev close", fmt(quote.previousClose)],
            ["Volume", quote.dayVolume != null ? formatVolume(quote.dayVolume) : daily.length ? formatVolume(daily[daily.length - 1].volume) : "—"],
            ["Avg vol 30D", stats?.avgVol ? formatVolume(stats.avgVol) : "—"],
            ["Rel volume", stats?.relVol ? `${stats.relVol.toFixed(2)}x` : "—"],
            ["Mkt cap", ticker?.mktCap ?? "—"],
            ["P/E", ticker?.pe != null ? ticker.pe.toFixed(1) : "—"],
            ["Beta 1Y", ticker?.beta != null ? String(ticker.beta) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-lq-muted">{k}</dt>
              <dd className="m-0 font-mono text-lq-text tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Performance */}
      {stats && (
        <Section title="Performance">
          <div className="grid grid-cols-3 gap-1.5">
            {stats.perf.map(({ k, v }) => (
              <div key={k} className={`rounded-md px-2 py-1.5 text-center border ${v === null ? "border-lq-line" : v >= 0 ? "border-lq-up/25 bg-lq-up/[0.06]" : "border-lq-down/25 bg-lq-down/[0.06]"}`}>
                <div className="text-[10px] text-lq-muted font-mono">{k}</div>
                <div className={`text-[12px] font-mono tabular-nums ${v === null ? "text-lq-muted" : v >= 0 ? "text-lq-up" : "text-lq-down"}`}>
                  {v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Technical read */}
      {tech.signals.length > 0 && (
        <Section
          title={`Technicals · ${intervalLabel}`}
          right={
            <button type="button" className="text-[11px] text-lq-muted hover:text-lq-gold" onClick={() => setShowSignals(!showSignals)}>
              {showSignals ? "Hide" : "Details"}
            </button>
          }
        >
          <div className="flex items-center gap-3">
            <div className={`text-[15px] font-medium ${verdictCol}`}>{verdict}</div>
            <div className="flex-1 flex h-1.5 rounded-full overflow-hidden bg-lq-line">
              <div className="bg-lq-down/80" style={{ width: `${(sells / tech.signals.length) * 100}%` }} />
              <div className="bg-lq-muted/40" style={{ width: `${(neutral / tech.signals.length) * 100}%` }} />
              <div className="bg-lq-up/80" style={{ width: `${(buys / tech.signals.length) * 100}%` }} />
            </div>
          </div>
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-lq-down">Sell {sells}</span>
            <span className="text-lq-muted">Neutral {neutral}</span>
            <span className="text-lq-up">Buy {buys}</span>
          </div>
          {showSignals && (
            <ul className="m-0 p-0 list-none flex flex-col gap-1 text-[12px]">
              {tech.signals.map((s) => (
                <li key={s.name} className="flex justify-between">
                  <span className="text-lq-text-2">{s.name}</span>
                  <span className="font-mono text-lq-muted tabular-nums">
                    {s.value} <span className={s.vote > 0 ? "text-lq-up" : s.vote < 0 ? "text-lq-down" : "text-lq-muted"}>{s.vote > 0 ? "Buy" : s.vote < 0 ? "Sell" : "Neutral"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-lq-muted m-0">A count of common signals on this chart's bars. Not advice.</p>
        </Section>
      )}

      {/* Pivots */}
      {stats && (
        <Section title="Pivot levels · classic">
          <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {stats.pivots.map(({ k, v }) => {
              const dist = ((v - quote.price) / quote.price) * 100;
              const near = Math.abs(dist) < 0.5;
              return (
                <li key={k} className={`flex items-center justify-between text-[12px] rounded px-1.5 py-0.5 ${near ? "bg-lq-gold/10" : ""}`}>
                  <span className={`font-mono w-7 ${k.startsWith("R") ? "text-lq-down" : k.startsWith("S") ? "text-lq-up" : "text-lq-gold"}`}>{k}</span>
                  <span className="font-mono text-lq-text tabular-nums flex-1 text-right">{fmt(v)}</span>
                  <span className="font-mono text-lq-muted tabular-nums w-16 text-right">{dist >= 0 ? "+" : ""}{dist.toFixed(2)}%</span>
                  <button type="button" title="Alert at this level" onClick={() => onAddAlert(Number(v.toFixed(digits)))} className="ml-2 text-lq-muted hover:text-lq-gold">
                    <BellPlus className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Alerts */}
      <Section title="Price alerts">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = parseFloat(alertInput);
            if (isFinite(v) && v > 0) {
              onAddAlert(v);
              setAlertInput("");
            }
          }}
        >
          <input
            value={alertInput}
            onChange={(e) => setAlertInput(e.target.value)}
            inputMode="decimal"
            placeholder={`e.g. ${fmt(quote.price * 1.02)}`}
            className="flex-1 min-w-0 bg-lq-bg-2 border border-lq-line rounded-md px-2.5 py-1.5 text-[12px] font-mono text-lq-text placeholder:text-lq-muted/70"
          />
          <button type="submit" className="lq-btn lq-btn--ghost !py-1.5 !px-3 text-[12px]">Add</button>
        </form>
        {alerts.length === 0 ? (
          <p className="text-[11px] text-lq-muted m-0">Alt + click on the chart, or the bell on a pivot, also sets one. You get a notice when price crosses it.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {[...alerts].sort((a, b) => b - a).map((a) => (
              <li key={a} className="flex items-center justify-between text-[12px]">
                <span className="font-mono text-lq-gold tabular-nums">{cs}{fmt(a)}</span>
                <span className="font-mono text-lq-muted tabular-nums">{a >= quote.price ? "▲" : "▼"} {(((a - quote.price) / quote.price) * 100).toFixed(2)}%</span>
                <button type="button" aria-label="Remove alert" onClick={() => onRemoveAlert(a)} className="text-lq-muted hover:text-lq-down">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
