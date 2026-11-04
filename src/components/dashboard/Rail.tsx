import React, { useEffect, useMemo, useState } from "react";
import { Ticker } from "../../types";
import { PanelHead, Change, Empty, fmtNum } from "./parts";

type Portfolio = { cash: number; positions: { [id: string]: { qty: number; avgCost: number } } };

/** Paper account summary: virtual cash, holdings value and unrealised P&L. */
export function PaperAccount({ portfolio, tickers, onOpen }: { portfolio: Portfolio; tickers: Ticker[]; onOpen: () => void }) {
  const ids = Object.keys(portfolio.positions);
  let value = 0;
  let cost = 0;
  for (const id of ids) {
    const p = portfolio.positions[id];
    const t = tickers.find((x) => x.id === id);
    value += p.qty * (t?.price ?? p.avgCost);
    cost += p.qty * p.avgCost;
  }
  const pnl = value - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : null;

  return (
    <section className="lq-panel lq-rise p-5 flex flex-col gap-3" aria-labelledby="acct-h" style={{ "--lq-i": 2 } as React.CSSProperties}>
      <PanelHead id="acct-h" title="Paper account" size="h3" marker={false} aside={<span className="lq-tag">Virtual money</span>} />
      <div className="flex flex-col gap-1">
        <span className="lq-lbl">Equity</span>
        <span className="lq-num text-[26px] leading-none">${fmtNum(portfolio.cash + value)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 m-0 text-[12px]">
        <div className="lq-card p-2.5">
          <dt className="lq-lbl">Cash</dt>
          <dd className="lq-num m-0 mt-1">${fmtNum(portfolio.cash)}</dd>
        </div>
        <div className="lq-card p-2.5">
          <dt className="lq-lbl">Open P&amp;L</dt>
          <dd className="m-0 mt-1">
            <Change pct={pnlPct} />
          </dd>
        </div>
      </dl>
      <p className="text-[11px] text-lq-muted m-0">
        {ids.length} open position{ids.length === 1 ? "" : "s"}. Mixed currencies are summed at face value.
      </p>
      <button type="button" className="lq-btn lq-btn--ghost" onClick={onOpen}>
        Open paper portfolio
      </button>
    </section>
  );
}

const WATCH_KEY = "lumina_quant_watchlist";
const DEFAULT_WATCH = ["NVDA", "AAPL", "MSFT", "RELIANCE", "TCS", "HDFCBANK"];

/** Watchlist of tracked symbols, saved on this device. */
export function Watchlist({ tickers, onSelect }: { tickers: Ticker[]; onSelect: (id: string) => void }) {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const xs = JSON.parse(localStorage.getItem(WATCH_KEY) || "null");
      return Array.isArray(xs) ? xs : DEFAULT_WATCH;
    } catch {
      return DEFAULT_WATCH;
    }
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(WATCH_KEY, JSON.stringify(ids));
    } catch {}
  }, [ids]);

  const rows = ids.map((id) => ({ id, t: tickers.find((x) => x.id === id) }));
  const addable = tickers.filter((t) => !ids.includes(t.id));

  return (
    <section className="lq-panel lq-rise p-5 flex flex-col gap-2" aria-labelledby="wl-h" style={{ "--lq-i": 3 } as React.CSSProperties}>
      <PanelHead id="wl-h" title="Watchlist" size="h3" marker={false} />
      {rows.length === 0 && <Empty>Your watchlist is empty.</Empty>}
      <ul className="m-0 p-0 list-none flex flex-col">
        {rows.map(({ id, t }) => (
          <li key={id} className="group flex items-center gap-2 border-b border-lq-line-soft last:border-0">
            <button type="button" onClick={() => onSelect(id)} className="flex-1 grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2.5 text-left">
              <span className="text-[13px] font-medium">{id}</span>
              <span className="lq-num text-[13px] text-lq-text-2">{t ? `${t.currency}${fmtNum(t.price)}` : "—"}</span>
              <Change pct={t?.chg} className="text-[12px] w-[72px] text-right" />
            </button>
            <button
              type="button"
              onClick={() => setIds((xs) => xs.filter((x) => x !== id))}
              aria-label={`Remove ${id} from watchlist`}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-lq-muted hover:text-lq-text text-[16px] px-1"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <label className="flex flex-col gap-1.5">
          <span className="lq-lbl">Add symbol</span>
          <select
            className="lq-input"
            autoFocus
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) setIds((xs) => [...xs, e.target.value]);
              setAdding(false);
            }}
            onBlur={() => setAdding(false)}
          >
            <option value="" disabled>
              Choose…
            </option>
            {addable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <button type="button" className="lq-btn lq-btn--ghost mt-1" onClick={() => setAdding(true)} disabled={addable.length === 0}>
          + Add symbol
        </button>
      )}
    </section>
  );
}

interface Signal {
  id: string;
  tickerId: string;
  type: "BULL" | "BEAR" | "VOL";
  text: string;
}

/** Signals read straight off each ticker's real indicator values. Sample data is skipped. */
function buildSignals(tickers: Ticker[]): Signal[] {
  const out: Signal[] = [];
  for (const t of tickers) {
    if (t.source === "mock") continue;
    if (t.macdCross) out.push({ id: `${t.id}-macd`, tickerId: t.id, type: "BULL", text: `MACD crossed above its signal line in the last 5 sessions.` });
    if (t.rsi >= 70) out.push({ id: `${t.id}-rsi`, tickerId: t.id, type: "BEAR", text: `RSI(14) at ${t.rsi.toFixed(0)}, overbought.` });
    else if (t.rsi <= 30) out.push({ id: `${t.id}-rsi`, tickerId: t.id, type: "BULL", text: `RSI(14) at ${t.rsi.toFixed(0)}, oversold.` });
    if (t.volSurge >= 1.5) out.push({ id: `${t.id}-vol`, tickerId: t.id, type: "VOL", text: `Volume ${t.volSurge.toFixed(1)}x its 20-day average.` });
  }
  return out.slice(0, 8);
}

export function SignalsPanel({ tickers, onSelect }: { tickers: Ticker[]; onSelect: (id: string) => void }) {
  const signals = useMemo(() => buildSignals(tickers), [tickers]);
  return (
    <section className="lq-panel lq-rise p-5 flex flex-col gap-2" aria-labelledby="sig-h" style={{ "--lq-i": 4 } as React.CSSProperties}>
      <PanelHead id="sig-h" title="Indicator signals" size="h3" marker={false} />
      {signals.length === 0 && <Empty>No RSI, MACD or volume signals across live tickers right now.</Empty>}
      <ul className="m-0 p-0 list-none flex flex-col gap-2 max-h-[340px] overflow-y-auto">
        {signals.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onSelect(s.tickerId)} className="lq-card w-full text-left p-3 flex gap-3 items-start hover:border-lq-line-2">
              <span
                className={`lq-num text-[10px] px-1.5 py-1 rounded flex-none ${
                  s.type === "BULL" ? "bg-lq-up/15 lq-up" : s.type === "BEAR" ? "bg-lq-down/15 lq-down" : "bg-lq-gold/15 text-lq-gold"
                }`}
              >
                {s.type === "BULL" ? "▲ BULL" : s.type === "BEAR" ? "▼ BEAR" : "VOL"}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium">{s.tickerId}</span>
                <span className="text-[12px] text-lq-text-2 leading-snug">{s.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-lq-muted m-0">Indicator readings from daily closes, not trade advice.</p>
    </section>
  );
}
