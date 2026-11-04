import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Category, INDICATORS, INDICATOR_BY_ID } from "./indicators";
import type { IndicatorInstance } from "./ChartCanvas";

function Modal({ title, onClose, children, width = "max-w-xl" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 backdrop-blur-sm px-4 pt-[10vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`w-full ${width} bg-lq-surface border border-lq-line-2 rounded-[14px] shadow-2xl flex flex-col max-h-[78vh]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-lq-line">
          <h2 className="lq-h3 m-0">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 text-lq-muted hover:text-lq-text">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const CATEGORIES: Array<Category | "All"> = ["All", "Moving averages", "Trend", "Momentum", "Volatility", "Volume"];

export function IndicatorPicker({ active, onAdd, onClose }: { active: IndicatorInstance[]; onAdd: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const counts = useMemo(() => active.reduce<Record<string, number>>((a, i) => ((a[i.id] = (a[i.id] || 0) + 1), a), {}), [active]);
  const list = INDICATORS.filter(
    (d) => (cat === "All" || d.category === cat) && (!q || `${d.name} ${d.short} ${d.description}`.toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <Modal title="Indicators" onClose={onClose}>
      <div className="px-5 pt-4 flex flex-col gap-3">
        <label className="flex items-center gap-2 bg-lq-bg-2 border border-lq-line rounded-lg px-3 py-2 focus-within:border-lq-gold-line">
          <Search className="w-4 h-4 text-lq-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${INDICATORS.length} indicators`}
            className="flex-1 bg-transparent outline-none text-sm text-lq-text placeholder:text-lq-muted"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`px-2.5 py-1 rounded-md text-[12px] border transition-colors ${cat === c ? "border-lq-gold-line text-lq-gold bg-lq-gold/5" : "border-lq-line text-lq-text-2 hover:text-lq-text"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <ul className="m-0 p-2 list-none overflow-y-auto flex-1 mt-2">
        {list.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onAdd(d.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-lq-surface-2 flex items-start gap-3 group"
            >
              <span className="font-mono text-[11px] text-lq-gold w-20 shrink-0 pt-0.5">{d.short}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] text-lq-text">{d.name}</span>
                <span className="block text-[12px] text-lq-muted leading-snug">{d.description}</span>
              </span>
              <span className="text-[11px] font-mono text-lq-muted shrink-0 pt-0.5">
                {counts[d.id] ? `${counts[d.id]} on chart` : d.overlay ? "on price" : "new pane"}
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-lq-muted">No indicator matches “{q}”.</li>}
      </ul>
    </Modal>
  );
}

export function IndicatorSettings({ inst, onSave, onClose }: { inst: IndicatorInstance; onSave: (params: Record<string, number>) => void; onClose: () => void }) {
  const def = INDICATOR_BY_ID[inst.id];
  const [vals, setVals] = useState<Record<string, number>>({ ...inst.params });
  if (!def) return null;
  return (
    <Modal title={`${def.name} settings`} onClose={onClose} width="max-w-sm">
      <form
        className="p-5 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(vals);
        }}
      >
        {def.params.length === 0 && <p className="text-sm text-lq-muted m-0">This indicator has no settings.</p>}
        {def.params.map((p) => (
          <label key={p.key} className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-lq-text-2">{p.label}</span>
            {p.options ? (
              <select
                value={vals[p.key]}
                onChange={(e) => setVals({ ...vals, [p.key]: Number(e.target.value) })}
                className="w-32 bg-lq-bg-2 border border-lq-line rounded-md px-2 py-1.5 text-[13px] text-lq-text"
              >
                {p.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                value={vals[p.key]}
                min={p.min}
                max={p.max}
                step={p.step ?? 1}
                onChange={(e) => setVals({ ...vals, [p.key]: Number(e.target.value) })}
                className="w-32 bg-lq-bg-2 border border-lq-line rounded-md px-2 py-1.5 text-[13px] text-lq-text font-mono"
              />
            )}
          </label>
        ))}
        <div className="flex justify-between gap-2 pt-2">
          <button type="button" className="lq-btn lq-btn--ghost" onClick={() => setVals(Object.fromEntries(def.params.map((p) => [p.key, p.default])))}>
            Defaults
          </button>
          <button type="submit" className="lq-btn">Apply</button>
        </div>
      </form>
    </Modal>
  );
}

export function TradeTicket({
  symbol,
  price,
  currencySymbol,
  initialSide,
  onSubmit,
  onClose,
}: {
  symbol: string;
  price: number;
  currencySymbol: string;
  initialSide: "buy" | "sell";
  onSubmit: (side: "buy" | "sell", orderType: string, qty: number, price: number) => void;
  onClose: () => void;
}) {
  const [side, setSide] = useState(initialSide);
  const [orderType, setOrderType] = useState("market");
  const [qty, setQty] = useState(10);
  const [limit, setLimit] = useState(Number(price.toFixed(2)));
  const fill = orderType === "limit" ? limit : price;
  return (
    <Modal title={`Paper order · ${symbol}`} onClose={onClose} width="max-w-sm">
      <form
        className="p-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(side, orderType, qty, fill);
        }}
      >
        <div className="grid grid-cols-2 gap-1.5 bg-lq-bg-2 p-1 rounded-xl border border-lq-line">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`py-2 text-[12px] uppercase tracking-wider font-semibold rounded-lg transition-colors ${
                side === s ? (s === "buy" ? "bg-lq-up/90 text-black" : "bg-lq-down/90 text-black") : "text-lq-muted hover:text-lq-text"
              }`}
            >
              {s === "buy" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="lq-lbl">Order type</span>
          <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="bg-lq-bg-2 border border-lq-line rounded-lg text-[13px] p-2.5 text-lq-text">
            <option value="market">Market</option>
            <option value="limit">Limit</option>
          </select>
        </label>
        {orderType === "limit" && (
          <label className="flex flex-col gap-1">
            <span className="lq-lbl">Limit price ({currencySymbol.trim()})</span>
            <input type="number" step="0.01" value={limit} onChange={(e) => setLimit(parseFloat(e.target.value) || 0)} className="bg-lq-bg-2 border border-lq-line rounded-lg text-[13px] p-2.5 text-lq-text font-mono" />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="lq-lbl">Quantity</span>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="bg-lq-bg-2 border border-lq-line rounded-lg text-[13px] p-2.5 text-lq-text font-mono" />
        </label>
        <div className="bg-lq-bg-2/60 p-3 rounded-lg border border-lq-line font-mono text-[12px] text-lq-muted flex justify-between">
          <span>Estimated value</span>
          <span className="text-lq-text">{currencySymbol}{(qty * fill).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
        </div>
        <button type="submit" className={`w-full font-semibold py-3 rounded-full uppercase text-[12px] tracking-widest ${side === "buy" ? "bg-lq-up text-black" : "bg-lq-down text-black"}`}>
          {side === "buy" ? "Buy" : "Sell"} {qty} {symbol} · paper
        </button>
        <p className="text-[11px] text-lq-muted m-0">Simulated with virtual cash. Nothing is sent to a broker.</p>
      </form>
    </Modal>
  );
}
