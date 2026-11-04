import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Grid3x3, LayoutList, Loader2, ScatterChart, Search, X } from "lucide-react";
import type { ScreenerResponse, ScreenerRow, Ticker } from "../types";
import FilterRail, { ClearChip } from "./screener/FilterRail";
import ScreenerTable, { COLUMN_SETS, ColumnSet, SortKey } from "./screener/ScreenerTable";
import ScreenerHeatmap from "./screener/ScreenerHeatmap";
import ScreenerScatter from "./screener/ScreenerScatter";
import { GROUPS, METRIC, METRICS, MetricKey, compactUsd, formatMetric, quantile, valuesOf } from "./screener/metrics";
import {
  CAP_BANDS,
  EMPTY_FILTERS,
  Filters,
  Preset,
  SIGNALS,
  activeRanges,
  applyFilters,
  countActive,
  presetFilters,
} from "./screener/filters";

interface ScreenerTabProps {
  tickers: Ticker[];
  /** The row is passed along so stocks outside the dashboard universe can still be charted. */
  onSelectTicker: (tickerId: string, ticker?: Ticker) => void;
  onAlertMessage?: (msg: string) => void;
}

type View = "table" | "heatmap" | "scatter";

const WATCH_KEY = "lumina_screener_watchlist";
const SAVED_KEY = "lumina_screener_saved";
const PAGE_SIZES = [25, 50, 100];

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep it in memory only */
  }
}

/** Shape a screener row like a dashboard ticker so Charts and the order ticket can use it. */
function toTicker(r: ScreenerRow): Ticker {
  return {
    id: r.id,
    name: r.name,
    price: r.price ?? 0,
    chg: r.chg ?? 0,
    volSurge: r.relVolume ?? 1,
    pe: r.pe,
    mktCap: r.mktCap === null ? "—" : r.market === "US" ? compactUsd(r.mktCap) : `₹${(r.mktCap / 1e12).toFixed(2)}T`,
    mktCapValue: r.mktCapUsd,
    rsi: r.rsi ?? 50,
    roe: null,
    sector: r.sector,
    beta: r.beta ?? 1,
    macdCross: !!r.macdCross,
    market: r.market,
    currency: r.currency,
    source: r.source === "simulated" ? "mock" : "yahoo",
    delayed: true,
    fundamentalsSource: r.source === "simulated" ? "sample" : r.pe !== null ? "fmp" : "none",
    asOf: new Date().toISOString(),
  };
}

function median(values: number[]): number | null {
  return values.length ? quantile(values, 0.5) : null;
}

function StatCard({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="lq-card px-4 py-3 min-w-0">
      <span className="lq-lbl">{label}</span>
      <div className="mt-1.5 lq-num text-[20px] leading-none text-lq-text">{children}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-lq-muted truncate">{sub}</div>}
    </div>
  );
}

export default function ScreenerTab({ onSelectTicker, onAlertMessage }: ScreenerTabProps) {
  const [data, setData] = useState<ScreenerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [view, setView] = useState<View>("table");
  const [columnSet, setColumnSet] = useState<ColumnSet>("overview");
  const [sortKey, setSortKey] = useState<SortKey>("mktCapUsd");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [colorBy, setColorBy] = useState<MetricKey>("chg");
  const [axisX, setAxisX] = useState<MetricKey>("volatility");
  const [axisY, setAxisY] = useState<MetricKey>("perfY1");
  const [watchlist, setWatchlist] = useState<Set<string>>(() => new Set(readStore<string[]>(WATCH_KEY, [])));
  const [saved, setSaved] = useState<Array<{ name: string; filters: Filters }>>(() => readStore(SAVED_KEY, []));

  // Load, poll while the first build fills in, then refresh every minute.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch("/api/screener");
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || !Array.isArray(body.rows)) throw new Error(body?.error || `HTTP ${res.status}`);
        setData(body);
        setError(null);
        timer = setTimeout(load, body.status === "building" ? 3000 : 60_000);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
        timer = setTimeout(load, 15_000);
      }
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const rows = data?.rows ?? [];
  const matches = useMemo(() => applyFilters(rows, filters, watchlist), [rows, filters, watchlist]);

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...matches].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1; // blanks last either way
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }, [matches, sortKey, sortAsc]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const updateFilters = useCallback((next: Filters) => {
    setFilters(next);
    setActivePreset(null);
    setPage(1);
  }, []);

  const applyPreset = (p: Preset) => {
    if (activePreset === p.id) {
      setFilters(EMPTY_FILTERS);
      setActivePreset(null);
    } else {
      setFilters({ ...presetFilters(p), search: filters.search, markets: filters.markets });
      setActivePreset(p.id);
      onAlertMessage?.(`Screen applied: ${p.label}.`);
    }
    setPage(1);
  };

  const toggleWatch = (id: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      writeStore(WATCH_KEY, [...next]);
      return next;
    });
  };

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(k);
      setSortAsc(k === "id" || k === "sector" || k === "pe" || k === "fwdPe" || k === "pb" || k === "volatility" || k === "analyst");
    }
    setPage(1);
  };

  const select = (r: ScreenerRow) => {
    onSelectTicker(r.id, toTicker(r));
    onAlertMessage?.(`Opened ${r.id} in Charts.`);
  };

  const exportCsv = () => {
    const cols: Array<keyof ScreenerRow> = ["id", "name", "market", "sector", "industry", "currency", ...METRICS.map((m) => m.key)];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...sorted.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumina-screener-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onAlertMessage?.(`Exported ${sorted.length} stocks to CSV.`);
  };

  // Summary stats for the strip above the results
  const stats = useMemo(() => {
    const chg = valuesOf(matches, "chg");
    const up = chg.filter((v) => v > 0).length;
    const down = chg.filter((v) => v < 0).length;
    const top = [...matches].filter((r) => r.chg !== null).sort((a, b) => b.chg! - a.chg!);
    return {
      up,
      down,
      flat: chg.length - up - down,
      medChg: median(chg),
      medRsi: median(valuesOf(matches, "rsi")),
      medPe: median(valuesOf(matches, "pe")),
      cap: valuesOf(matches, "mktCapUsd").reduce((a, b) => a + b, 0),
      best: top[0],
      worst: top[top.length - 1],
    };
  }, [matches]);

  const sectors = useMemo(() => {
    const scope = applyFilters(rows, { ...filters, sectors: [] }, watchlist);
    const map = new Map<string, ScreenerRow[]>();
    scope.forEach((r) => map.set(r.sector, [...(map.get(r.sector) ?? []), r]));
    return [...map]
      .map(([name, list]) => ({ name, count: list.length, chg: median(valuesOf(list, "chg")) }))
      .sort((a, b) => b.count - a.count);
  }, [rows, filters, watchlist]);

  // Removable chips for everything currently filtering the list
  const chips: Array<{ label: string; clear: () => void }> = [];
  if (filters.search) chips.push({ label: `"${filters.search}"`, clear: () => updateFilters({ ...filters, search: "" }) });
  filters.markets.forEach((m) => chips.push({ label: m === "US" ? "United States" : "India", clear: () => updateFilters({ ...filters, markets: filters.markets.filter((x) => x !== m) }) }));
  filters.sectors.forEach((s) => chips.push({ label: s, clear: () => updateFilters({ ...filters, sectors: filters.sectors.filter((x) => x !== s) }) }));
  filters.caps.forEach((c) => chips.push({ label: `${CAP_BANDS.find((b) => b.id === c)?.label} cap`, clear: () => updateFilters({ ...filters, caps: filters.caps.filter((x) => x !== c) }) }));
  activeRanges(filters).forEach(([k, lo, hi]) => {
    const m = METRIC[k];
    const unit = m.unit === "pct" ? "%" : m.unit === "x" ? "×" : "";
    const label = lo !== null && hi !== null ? `${m.short} ${lo}–${hi}${unit}` : lo !== null ? `${m.short} ≥ ${lo}${unit}` : `${m.short} ≤ ${hi}${unit}`;
    chips.push({
      label,
      clear: () => {
        const ranges = { ...filters.ranges };
        delete ranges[k];
        updateFilters({ ...filters, ranges });
      },
    });
  });
  filters.signals.forEach((s) => chips.push({ label: SIGNALS.find((x) => x.id === s)!.label, clear: () => updateFilters({ ...filters, signals: filters.signals.filter((x) => x !== s) }) }));
  if (filters.watchOnly) chips.push({ label: "Watchlist", clear: () => updateFilters({ ...filters, watchOnly: false }) });

  const building = data?.status === "building";
  const simulated = data?.mode === "simulated";
  const metricSelect = (value: MetricKey, onChange: (k: MetricKey) => void, label: string) => (
    <label className="flex items-center gap-2 text-[12px] text-lq-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as MetricKey)} className="lq-input !min-h-[32px] !text-[12px] !pr-7 cursor-pointer">
        {GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {METRICS.filter((m) => m.group === g).map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );

  return (
    <div className="relative flex-1 w-full max-w-[1680px] mx-auto px-4 md:px-6 py-6 flex flex-col gap-4">
      {/* Title row */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 lq-rise">
        <div className="flex flex-col gap-1.5">
          <span className="lq-lbl !text-lq-gold">Screener · {data?.universe ?? "—"} stocks · US and India</span>
          <h1 className="lq-h1">Find the setup, then test it on paper</h1>
          <p className="text-[13.5px] text-lq-text-2 max-w-[720px]">
            {METRICS.length} metrics across valuation, performance, technicals, risk and factor scores. Pick a screen, narrow it down, and open any stock in Charts to place a practice trade.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center gap-2 min-h-[34px] px-3 rounded-full bg-lq-surface-2 border text-[12px] text-lq-text"
            style={{ borderColor: "rgba(143,123,255,.45)", boxShadow: "0 0 18px var(--lq-violet-glow)" }}
            title={data ? `Prices ${data.coverage.quotes}/${data.universe} · history ${data.coverage.history}/${data.universe}` : undefined}
          >
            {building ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-lq-gold" />
            ) : (
              <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: simulated ? "var(--lq-muted)" : "var(--lq-up)" }} />
            )}
            {building ? `Loading ${Math.round((data?.progress ?? 0) * 100)}%` : simulated ? "Simulated data" : "Delayed market data"}
            {data && !building && (
              <span className="text-lq-muted lq-num text-[11px]">
                {new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </span>
          <button type="button" onClick={exportCsv} disabled={!sorted.length} className="lq-btn">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </header>

      {simulated && (
        <div role="status" className="lq-card px-4 py-3 text-[13px] text-lq-text-2 border-lq-gold-line">
          <strong className="text-lq-gold-soft font-medium">Live market data is unreachable right now.</strong> These rows are generated from a
          random walk so you can explore the screener. None of the numbers are real prices or fundamentals.
        </div>
      )}
      {error && !data && (
        <div role="alert" className="lq-card px-4 py-3 text-[13px] text-lq-text-2">
          Could not load the screener ({error}). Retrying shortly.
        </div>
      )}
      {building && (
        <div className="h-1 rounded-full bg-lq-line overflow-hidden" aria-hidden="true">
          <div className="h-full transition-all duration-700" style={{ width: `${(data?.progress ?? 0) * 100}%`, background: "var(--lq-gold-grad)" }} />
        </div>
      )}

      {/* Summary strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 lq-rise" style={{ ["--lq-i" as string]: 1 }} aria-label="Summary of matches">
        <StatCard label="Matches" sub={`of ${rows.length} loaded`}>
          {matches.length}
        </StatCard>
        <StatCard
          label="Breadth today"
          sub={
            <span>
              <span className="text-lq-up">▲ {stats.up}</span> · <span className="text-lq-down">▼ {stats.down}</span>
              {stats.flat ? ` · ${stats.flat} flat` : ""}
            </span>
          }
        >
          <div className="flex h-2.5 rounded-full overflow-hidden bg-lq-line mt-1.5" role="img" aria-label={`${stats.up} up, ${stats.down} down`}>
            <div style={{ width: `${(stats.up / Math.max(1, stats.up + stats.down + stats.flat)) * 100}%`, background: "var(--lq-up)" }} />
            <div style={{ width: `${(stats.flat / Math.max(1, stats.up + stats.down + stats.flat)) * 100}%`, background: "var(--lq-line-2)" }} />
            <div className="flex-1" style={{ background: "var(--lq-down)" }} />
          </div>
        </StatCard>
        <StatCard label="Median change" sub="across matches, today">
          {stats.medChg === null ? "—" : (
            <span className={stats.medChg >= 0 ? "text-lq-up" : "text-lq-down"}>
              {stats.medChg >= 0 ? "▲" : "▼"} {Math.abs(stats.medChg).toFixed(2)}%
            </span>
          )}
        </StatCard>
        <StatCard label="Median P/E · RSI" sub="valuation and heat">
          {stats.medPe === null ? "—" : stats.medPe.toFixed(1)} <span className="text-lq-muted">·</span> {stats.medRsi === null ? "—" : stats.medRsi.toFixed(0)}
        </StatCard>
        <StatCard label="Combined value" sub="market cap of matches, USD">
          {stats.cap ? compactUsd(stats.cap) : "—"}
        </StatCard>
        <StatCard
          label="Biggest mover"
          sub={stats.best ? <button type="button" onClick={() => select(stats.best!)} className="hover:text-lq-gold">{stats.best.name}</button> : "—"}
        >
          {stats.best ? (
            <span className="flex items-baseline gap-2">
              <span className="text-lq-gold">{stats.best.id}</span>
              <span className={`text-[14px] ${stats.best.chg! >= 0 ? "text-lq-up" : "text-lq-down"}`}>{formatMetric("chg", stats.best)}</span>
            </span>
          ) : "—"}
        </StatCard>
      </section>

      {/* Sector strip */}
      <nav aria-label="Sectors" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 lq-rise" style={{ ["--lq-i" as string]: 2 }}>
        {sectors.map((s) => {
          const on = filters.sectors.includes(s.name);
          return (
            <button
              key={s.name}
              type="button"
              aria-pressed={on}
              onClick={() =>
                updateFilters({ ...filters, sectors: on ? filters.sectors.filter((x) => x !== s.name) : [...filters.sectors, s.name] })
              }
              className={`shrink-0 flex flex-col items-start gap-1 px-3 py-2 rounded-[10px] border transition-colors text-left ${
                on ? "border-lq-gold bg-[rgba(212,175,55,0.08)]" : "border-lq-line bg-lq-surface hover:border-lq-gold-line"
              }`}
            >
              <span className={`text-[12px] ${on ? "text-lq-gold-soft" : "text-lq-text-2"}`}>{s.name}</span>
              <span className="flex items-center gap-2 lq-num text-[11px]">
                <span className="text-lq-muted">{s.count}</span>
                {s.chg !== null && (
                  <span className={s.chg >= 0 ? "text-lq-up" : "text-lq-down"}>
                    {s.chg >= 0 ? "▲" : "▼"} {Math.abs(s.chg).toFixed(2)}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <FilterRail
          rows={rows}
          matches={matches}
          filters={filters}
          onChange={updateFilters}
          activePreset={activePreset}
          onPreset={applyPreset}
          saved={saved}
          onSave={(name) => {
            const next = [...saved.filter((s) => s.name !== name), { name, filters }];
            setSaved(next);
            writeStore(SAVED_KEY, next);
            onAlertMessage?.(`Saved screen "${name}".`);
          }}
          onLoadSaved={(s) => {
            setFilters({ ...EMPTY_FILTERS, ...s.filters });
            setActivePreset(null);
            setPage(1);
          }}
          onDeleteSaved={(name) => {
            const next = saved.filter((s) => s.name !== name);
            setSaved(next);
            writeStore(SAVED_KEY, next);
          }}
        />

        <section className="flex-1 min-w-0 w-full flex flex-col gap-3">
          {/* Toolbar */}
          <div className="lq-panel p-3 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-lq-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => updateFilters({ ...filters, search: e.target.value })}
                  placeholder="Search symbol, company or industry"
                  aria-label="Search stocks"
                  className="lq-input w-full !pl-9"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  aria-pressed={filters.watchOnly}
                  onClick={() => updateFilters({ ...filters, watchOnly: !filters.watchOnly })}
                  className="lq-chip"
                  title="Show only stocks you starred"
                >
                  ★ Watchlist <span className="font-mono text-[10px] opacity-70">{watchlist.size}</span>
                </button>
                <div className="flex rounded-full border border-lq-line-2 p-0.5 bg-lq-bg" role="tablist" aria-label="View">
                  {([
                    ["table", "Table", LayoutList],
                    ["heatmap", "Heatmap", Grid3x3],
                    ["scatter", "Scatter", ScatterChart],
                  ] as const).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={view === id}
                      onClick={() => setView(id)}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] transition-colors ${
                        view === id ? "bg-lq-surface-2 text-lq-gold ring-1 ring-lq-gold-line" : "text-lq-muted hover:text-lq-text"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-between">
              {view === "table" ? (
                <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Column set">
                  {COLUMN_SETS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="tab"
                      aria-selected={columnSet === c.id}
                      onClick={() => setColumnSet(c.id)}
                      className={`shrink-0 h-8 px-3 rounded-md text-[12px] transition-colors ${
                        columnSet === c.id ? "text-lq-gold bg-[rgba(212,175,55,0.08)]" : "text-lq-muted hover:text-lq-text"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  {view === "scatter" && metricSelect(axisX, setAxisX, "X")}
                  {view === "scatter" && metricSelect(axisY, setAxisY, "Y")}
                  {metricSelect(colorBy, setColorBy, "Colour")}
                </div>
              )}
              <span className="text-[12px] text-lq-muted">
                <span className="lq-num text-lq-text">{matches.length}</span> of {rows.length}
                {countActive(filters) > 0 && ` · ${countActive(filters)} filter${countActive(filters) > 1 ? "s" : ""}`}
              </span>
            </div>

            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-lq-line-soft">
                {chips.map((c) => (
                  <ClearChip key={c.label} label={c.label} onClear={c.clear} />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setActivePreset(null);
                    setPage(1);
                  }}
                  className="ml-1 inline-flex items-center gap-1 text-[12px] text-lq-muted hover:text-lq-gold"
                >
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="lq-panel overflow-hidden">
            {rows.length === 0 ? (
              <div className="py-24 flex flex-col items-center gap-3 text-lq-muted text-[13px]">
                <Loader2 className="w-6 h-6 animate-spin text-lq-gold" />
                Loading {data?.universe ?? 1300}+ stocks…
              </div>
            ) : matches.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <p className="lq-h3">No stocks pass every filter</p>
                <p className="text-[13px] text-lq-muted max-w-sm">Loosen a range or remove a chip above. The histograms in the filter panel show where most stocks sit.</p>
              </div>
            ) : view === "table" ? (
              <div className="overflow-auto max-h-[calc(100vh-180px)] min-h-[420px]">
                <ScreenerTable
                  rows={pageRows}
                  columnSet={columnSet}
                  sortKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                  watchlist={watchlist}
                  onToggleWatch={toggleWatch}
                  onSelect={select}
                  rankOffset={(safePage - 1) * pageSize}
                />
              </div>
            ) : view === "heatmap" ? (
              <div className="p-2">
                <ScreenerHeatmap rows={matches} colorBy={colorBy} onSelect={select} />
              </div>
            ) : (
              <div className="p-2">
                <ScreenerScatter rows={matches} x={axisX} y={axisY} colorBy={colorBy} watchlist={watchlist} onSelect={select} />
              </div>
            )}

            {view === "table" && matches.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-lq-line">
                <span className="text-[12px] text-lq-muted">
                  <span className="lq-num text-lq-text-2">
                    {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}
                  </span>{" "}
                  of {sorted.length} · sorted by {sortKey === "id" ? "symbol" : sortKey === "sector" ? "sector" : METRIC[sortKey].label}
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-[12px] text-lq-muted flex items-center gap-1.5">
                    Rows
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="lq-input !min-h-[30px] !text-[12px] cursor-pointer"
                    >
                      {PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} className="lq-btn lq-btn--ghost !min-h-[30px] !px-3 !text-[12px]">
                    Prev
                  </button>
                  <span className="lq-num text-[12px] text-lq-text-2 w-14 text-center">
                    {safePage} / {pages}
                  </span>
                  <button type="button" onClick={() => setPage(safePage + 1)} disabled={safePage >= pages} className="lq-btn lq-btn--ghost !min-h-[30px] !px-3 !text-[12px]">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-[11.5px] text-lq-muted leading-relaxed">
            Prices are delayed and come from Yahoo Finance. Factor scores are percentile ranks within each market, computed by Lumina from the
            metrics shown; they describe the past year and are not a forecast or advice. Lumina is a practice environment: no real orders are placed.
          </p>
        </section>
      </div>
    </div>
  );
}
