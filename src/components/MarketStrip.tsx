import React, { useEffect, useState } from "react";
import { useMarketSummary } from "./MarketStatusPill";

export interface GlobalIndex {
  symbol: string;
  label: string;
  price: number | null;
  changePct: number | null;
  currency: string;
  live: boolean;
}

// One shared poll for every component that shows index levels.
let shared: GlobalIndex[] = [];
const listeners = new Set<(v: GlobalIndex[]) => void>();
let timer: number | null = null;

function load() {
  fetch("/api/global-indices")
    .then((r) => r.json())
    .then((d) => {
      shared = Array.isArray(d.indices) ? d.indices : [];
      listeners.forEach((l) => l(shared));
    })
    .catch(() => {});
}

export function useGlobalIndices(): GlobalIndex[] {
  const [value, setValue] = useState(shared);
  useEffect(() => {
    listeners.add(setValue);
    if (timer === null) {
      load();
      timer = window.setInterval(load, 60_000);
    }
    return () => {
      listeners.delete(setValue);
      if (listeners.size === 0 && timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return value;
}

const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** The live ticker strip under the header, shared by every page. */
export default function MarketStrip() {
  const indices = useGlobalIndices();
  const { regions } = useMarketSummary();

  const items = (
    <>
      {regions.map((r) => (
        <span key={r.name} className="inline-flex items-center gap-1.5">
          <span className="text-lq-muted">{r.short}</span>
          <span className={r.open ? "text-lq-up" : "text-lq-muted"}>
            {r.open}/{r.total}
          </span>
        </span>
      ))}
      {indices.map((idx) => {
        const ok = idx.live && idx.price !== null && idx.changePct !== null;
        const up = (idx.changePct ?? 0) >= 0;
        return (
          <span key={idx.symbol} className="inline-flex items-center gap-2">
            <span className="text-lq-text">{idx.label}</span>
            {ok ? (
              <>
                <span className="text-lq-text-2">
                  {idx.currency}
                  {fmt(idx.price!)}
                </span>
                <span className={up ? "lq-up" : "lq-down"}>
                  {up ? "▲" : "▼"} {Math.abs(idx.changePct!).toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="text-lq-muted">unavailable</span>
            )}
          </span>
        );
      })}
    </>
  );

  return (
    <div className="relative z-10 border-b border-lq-line bg-[rgba(11,12,18,0.82)] backdrop-blur-sm overflow-hidden">
      <div className="animate-ticker-loop py-2.5 lq-num text-[12px] whitespace-nowrap" aria-label="Market strip">
        <div className="flex gap-10 pl-10">{items}</div>
        <div className="flex gap-10 pl-10" aria-hidden="true">
          {items}
        </div>
      </div>
    </div>
  );
}
