import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatWait, marketStatus, REGIONS, Region } from "../landing/marketHours";

const SHORT: Record<Region, string> = {
  Americas: "AMER",
  "Europe & Africa": "EMEA",
  "Middle East": "MIDEAST",
  "Asia-Pacific": "APAC",
};

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Summary of the 20 largest exchanges, computed from the viewer's clock. */
export function useMarketSummary() {
  const now = useNow();
  const status = marketStatus(now);
  const live = status.filter((s) => s.state === "open").sort((a, b) => a.closesIn - b.closesIn);
  const next = status.filter((s) => s.state !== "open").sort((a, b) => a.opensIn - b.opensIn);
  const regions = REGIONS.map((r) => {
    const xs = status.filter((s) => s.region === r);
    return { name: r, short: SHORT[r], open: xs.filter((s) => s.state === "open").length, total: xs.length };
  });
  return { now, status, live, next, regions, total: status.length };
}

/** "9/20 markets live" pill in the header, with the world clock in a popover. */
export default function MarketStatusPill() {
  const { now, live, next, regions, total } = useMarketSummary();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const utc = now.toISOString().slice(11, 16);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="lq-market-status"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 sm:gap-2.5 min-h-10 px-3 sm:px-3.5 rounded-full bg-lq-surface-2 text-lq-text text-[13px] font-medium border border-[rgba(143,123,255,0.45)] shadow-[0_0_18px_var(--lq-violet-glow)] hover:border-lq-violet transition-colors"
      >
        <span
          aria-hidden="true"
          className={`w-2 h-2 rounded-full ${live.length ? "bg-lq-up" : "bg-lq-down"}`}
        />
        <span className="whitespace-nowrap">
          <strong className={live.length ? "text-lq-up" : "text-lq-down"}>
            {live.length}/{total}
          </strong>{" "}
          <span className="hidden sm:inline">markets live</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          id="lq-market-status"
          className="lq-panel absolute right-0 mt-2 w-[min(340px,calc(100vw-32px))] p-4 z-50 flex flex-col gap-3"
        >
          <div className="flex justify-between">
            <span className="lq-lbl">Market status</span>
            <span className="lq-lbl lq-num">{utc} UTC</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {regions.map((r) => (
              <div key={r.name} className="lq-card px-2 py-2 flex flex-col gap-1" title={r.name}>
                <span className="lq-lbl text-[10px]">{r.short}</span>
                <span className={`lq-num text-sm ${r.open ? "text-lq-up" : "text-lq-muted"}`}>
                  {r.open}/{r.total}
                </span>
              </div>
            ))}
          </div>

          <span className="lq-lbl">Live now · closes in</span>
          {live.length === 0 && <p className="text-xs text-lq-muted m-0">No exchange is in session right now.</p>}
          <ul className="flex flex-col gap-1.5 m-0 p-0 list-none max-h-48 overflow-y-auto">
            {live.map((m) => (
              <li key={m.code} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 text-[13px]">
                <span className="font-medium">{m.code}</span>
                <span className="text-lq-muted truncate">{m.city}</span>
                <span className="lq-num text-lq-text-2">{formatWait(m.closesIn)}</span>
              </li>
            ))}
          </ul>

          <span className="lq-lbl">Opening next</span>
          <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
            {next.slice(0, 3).map((m) => (
              <li key={m.code} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 text-[13px]">
                <span className="font-medium">{m.code}</span>
                <span className="text-lq-muted truncate">{m.city}</span>
                <span className="lq-num text-lq-text-2">{formatWait(m.opensIn)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-lq-muted m-0">Regular hours from each exchange's local clock. Holidays are not modelled.</p>
        </div>
      )}
    </div>
  );
}
