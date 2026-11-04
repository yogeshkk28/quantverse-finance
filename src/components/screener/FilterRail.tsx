import React, { useMemo, useState } from "react";
import { ChevronDown, Bookmark, Trash2, X } from "lucide-react";
import type { ScreenerRow } from "../../types";
import { GROUPS, METRICS, Metric, MetricGroup, MetricKey, formatValue, quantile, valuesOf } from "./metrics";
import { CAP_BANDS, Filters, PRESETS, Preset, Range, SIGNALS, activeRanges } from "./filters";

interface SavedScreen {
  name: string;
  filters: Filters;
}

interface FilterRailProps {
  rows: ScreenerRow[];
  matches: ScreenerRow[];
  filters: Filters;
  onChange: (next: Filters) => void;
  activePreset: string | null;
  onPreset: (p: Preset) => void;
  saved: SavedScreen[];
  onSave: (name: string) => void;
  onLoadSaved: (s: SavedScreen) => void;
  onDeleteSaved: (name: string) => void;
}

const BINS = 28;

/** Distribution of the whole universe (faint) and of current matches (gold), with the chosen range shaded. */
function Histogram({ metric, all, matches, range }: { metric: Metric; all: number[]; matches: number[]; range?: Range }) {
  const { bars, lo, hi } = useMemo(() => {
    const lo = metric.clip ? Math.max(metric.clip[0], quantile(all, 0.01)) : quantile(all, 0.01);
    const hi = metric.clip ? Math.min(metric.clip[1], quantile(all, 0.99)) : quantile(all, 0.99);
    const width = hi > lo ? (hi - lo) / BINS : 1;
    const bin = (v: number) => Math.max(0, Math.min(BINS - 1, Math.floor((v - lo) / width)));
    const a = new Array(BINS).fill(0);
    const m = new Array(BINS).fill(0);
    all.forEach((v) => a[bin(v)]++);
    matches.forEach((v) => m[bin(v)]++);
    const peak = Math.max(1, ...a);
    return { bars: a.map((n, i) => ({ all: n / peak, match: m[i] / peak })), lo, hi };
  }, [all, matches, metric]);

  if (all.length < 5) return null;
  const x = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo || 1)) * 280;
  const min = range?.min !== undefined && range.min !== "" ? Number(range.min) : null;
  const max = range?.max !== undefined && range.max !== "" ? Number(range.max) : null;
  const shade = min !== null || max !== null;

  return (
    <div className="mt-1.5">
      <svg viewBox="0 0 280 26" preserveAspectRatio="none" className="w-full h-[26px] block" aria-hidden="true">
        {shade && (
          <rect
            x={min !== null && isFinite(min) ? x(min) : 0}
            width={Math.max(2, (max !== null && isFinite(max) ? x(max) : 280) - (min !== null && isFinite(min) ? x(min) : 0))}
            y={0}
            height={26}
            fill="rgba(212,175,55,0.08)"
          />
        )}
        {bars.map((b, i) => (
          <g key={i}>
            <rect x={i * 10 + 1} width={8} y={26 - b.all * 24} height={b.all * 24} rx={1.5} fill="#2F3344" />
            <rect x={i * 10 + 1} width={8} y={26 - b.match * 24} height={b.match * 24} rx={1.5} fill="#D4AF37" opacity={0.85} />
          </g>
        ))}
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-lq-muted mt-0.5">
        <span>{formatValue(metric.key, lo)}</span>
        <span>{formatValue(metric.key, hi)}</span>
      </div>
    </div>
  );
}

function RangeRow({ metric, all, matches, range, onChange }: {
  metric: Metric;
  all: number[];
  matches: number[];
  range?: Range;
  onChange: (r: Range) => void;
}) {
  const active = !!range && (range.min !== "" || range.max !== "");
  return (
    <div className={`rounded-lg px-2.5 py-2 transition-colors ${active ? "bg-[rgba(212,175,55,0.06)] ring-1 ring-lq-gold-line" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[12px] text-lq-text-2 truncate cursor-help" title={metric.hint} htmlFor={`f-${metric.key}-min`}>
          {metric.label}
        </label>
        <div className="flex items-center gap-1 shrink-0">
          <input
            id={`f-${metric.key}-min`}
            inputMode="decimal"
            placeholder="min"
            aria-label={`${metric.label} minimum`}
            value={range?.min ?? ""}
            onChange={(e) => onChange({ min: e.target.value, max: range?.max ?? "" })}
            className="w-[58px] h-7 rounded-md bg-lq-bg border border-lq-line-2 px-1.5 font-mono text-[11px] text-lq-text placeholder:text-lq-muted/60 focus:border-lq-gold focus:outline-none"
          />
          <span className="text-lq-muted text-[10px]">–</span>
          <input
            inputMode="decimal"
            placeholder="max"
            aria-label={`${metric.label} maximum`}
            value={range?.max ?? ""}
            onChange={(e) => onChange({ min: range?.min ?? "", max: e.target.value })}
            className="w-[58px] h-7 rounded-md bg-lq-bg border border-lq-line-2 px-1.5 font-mono text-[11px] text-lq-text placeholder:text-lq-muted/60 focus:border-lq-gold focus:outline-none"
          />
        </div>
      </div>
      <Histogram metric={metric} all={all} matches={matches} range={range} />
    </div>
  );
}

export default function FilterRail(props: FilterRailProps) {
  const { rows, matches, filters, onChange, activePreset, onPreset, saved } = props;
  const [open, setOpen] = useState<Record<MetricGroup, boolean>>({
    Performance: true,
    Valuation: false,
    Technicals: false,
    Risk: false,
    "Factor scores": false,
    "Size & liquidity": false,
  });
  const [saveName, setSaveName] = useState("");

  const distributions = useMemo(() => {
    const out = {} as Record<MetricKey, { all: number[]; matches: number[] }>;
    for (const m of METRICS) out[m.key] = { all: valuesOf(rows, m.key), matches: valuesOf(matches, m.key) };
    return out;
  }, [rows, matches]);

  const activeByGroup = useMemo(() => {
    const counts: Partial<Record<MetricGroup, number>> = {};
    for (const [k] of activeRanges(filters)) {
      const g = METRICS.find((m) => m.key === k)?.group;
      if (g) counts[g] = (counts[g] ?? 0) + 1;
    }
    return counts;
  }, [filters]);

  const toggle = <T,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <aside
      className="w-full lg:w-[320px] shrink-0 flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1"
      aria-label="Screener filters"
    >
      {/* Preset screens */}
      <section className="lq-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="lq-marker" />
          <h2 className="lq-h3 text-[18px]">Screens</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.blurb}
              aria-pressed={activePreset === p.id}
              onClick={() => onPreset(p)}
              className="lq-chip !min-h-[28px] !px-3 !text-[11.5px]"
            >
              {p.label}
            </button>
          ))}
        </div>
        {activePreset && (
          <p className="mt-3 text-[12px] text-lq-muted leading-snug">{PRESETS.find((p) => p.id === activePreset)?.blurb}</p>
        )}

        <div className="mt-4 pt-3 border-t border-lq-line-soft">
          <span className="lq-lbl">My screens</span>
          {saved.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {saved.map((s) => (
                <li key={s.name} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => props.onLoadSaved(s)}
                    className="flex-1 text-left text-[12.5px] text-lq-text-2 hover:text-lq-gold truncate py-1 flex items-center gap-1.5"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-lq-gold shrink-0" /> {s.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${s.name}`}
                    onClick={() => props.onDeleteSaved(s.name)}
                    className="p-1 text-lq-muted hover:text-lq-down"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (saveName.trim()) {
                props.onSave(saveName.trim());
                setSaveName("");
              }
            }}
          >
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name this screen"
              aria-label="Name for the current screen"
              className="lq-input flex-1 !min-h-[32px] !text-[12px]"
            />
            <button type="submit" className="lq-btn lq-btn--ghost !min-h-[32px] !px-3 !text-[12px]" disabled={!saveName.trim()}>
              Save
            </button>
          </form>
        </div>
      </section>

      {/* Universe, size and signals */}
      <section className="lq-panel p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="lq-marker" />
            <h2 className="lq-h3 text-[18px]">Filters</h2>
          </div>
        </div>

        <div>
          <span className="lq-lbl">Market</span>
          <div className="mt-2 flex gap-1.5">
            {([["US", "United States"], ["IN", "India (NSE)"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filters.markets.includes(id)}
                onClick={() => onChange({ ...filters, markets: toggle(filters.markets, id) })}
                className="lq-chip !min-h-[28px] !px-3 !text-[11.5px]"
              >
                {label}
                <span className="font-mono text-[10px] opacity-70">{rows.filter((r) => r.market === id).length}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="lq-lbl">Market cap</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CAP_BANDS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.hint}
                aria-pressed={filters.caps.includes(c.id)}
                onClick={() => onChange({ ...filters, caps: toggle(filters.caps, c.id) })}
                className="lq-chip !min-h-[28px] !px-3 !text-[11.5px]"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="lq-lbl">Signals</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SIGNALS.map((s) => {
              const count = matches.filter(s.test).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  title={s.hint}
                  aria-pressed={filters.signals.includes(s.id)}
                  onClick={() => onChange({ ...filters, signals: toggle(filters.signals, s.id) })}
                  className="lq-chip !min-h-[28px] !px-3 !text-[11.5px]"
                >
                  {s.label}
                  <span className="font-mono text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Metric ranges with distributions */}
      <section className="lq-panel p-2" aria-label="Metric ranges">
        {GROUPS.map((g) => {
          const metrics = METRICS.filter((m) => m.group === g);
          const isOpen = open[g];
          return (
            <div key={g} className="border-b border-lq-line-soft last:border-b-0">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen({ ...open, [g]: !isOpen })}
                className="w-full flex items-center justify-between px-2.5 py-3 text-left hover:text-lq-gold transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-lq-text">{g}</span>
                  {activeByGroup[g] ? (
                    <span className="lq-num text-[10px] text-lq-bg bg-lq-gold rounded-full px-1.5 py-px">{activeByGroup[g]}</span>
                  ) : (
                    <span className="text-[11px] text-lq-muted">{metrics.length}</span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 text-lq-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="pb-2 flex flex-col gap-1">
                  {metrics.map((m) => (
                    <RangeRow
                      key={m.key}
                      metric={m}
                      all={distributions[m.key].all}
                      matches={distributions[m.key].matches}
                      range={filters.ranges[m.key]}
                      onChange={(rg) => {
                        const ranges = { ...filters.ranges };
                        if (rg.min === "" && rg.max === "") delete ranges[m.key];
                        else ranges[m.key] = rg;
                        onChange({ ...filters, ranges });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </aside>
  );
}

export function ClearChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full border border-lq-gold-line bg-[rgba(212,175,55,0.06)] text-[11.5px] text-lq-gold-soft">
      {label}
      <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="p-0.5 rounded-full hover:bg-lq-surface-2 text-lq-gold">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
