import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Filter } from "lucide-react";
import { MARKET_ITEMS } from "./nav/navConfig";
import { Sparkline, Empty, fmtNum } from "./dashboard/parts";

interface MarketRow {
  id: string;
  symbol: string;
  short: string;
  name: string;
  group: string;
  unit?: string;
  currency?: string;
  available: boolean;
  price?: number;
  change?: number;
  changePct?: number;
  spark?: number[];
  asOf?: string;
  frequency?: "daily" | "monthly";
  chartable: boolean;
}

interface MarketResponse {
  category: string;
  title: string;
  blurb: string;
  rows: MarketRow[];
  error?: string;
}

const digits = (v: number) => (Math.abs(v) < 1 ? 4 : Math.abs(v) < 10 ? 4 : 2);

function ChangeCell({ row }: { row: MarketRow }) {
  if (!row.available || row.changePct == null) return <span className="text-[12px] text-lq-muted">—</span>;
  const up = row.changePct >= 0;
  const isYield = row.unit === "%";
  return (
    <span className={`flex flex-col items-end leading-tight lq-num ${up ? "lq-up" : "lq-down"}`}>
      <span className="text-[13px]">
        {up ? "+" : "−"}
        {Math.abs(row.changePct).toFixed(2)}%
      </span>
      {row.change != null && (
        <span className="text-[11px] opacity-80">
          {up ? "+" : "−"}
          {isYield ? `${Math.abs(row.change * 100).toFixed(1)} bp` : fmtNum(Math.abs(row.change), digits(row.price ?? row.change))}
        </span>
      )}
    </span>
  );
}

function Row({ row, onOpen }: { row: MarketRow; onOpen?: () => void }) {
  const price =
    row.available && row.price != null ? `${row.currency ?? ""}${fmtNum(row.price, row.unit === "%" ? 3 : digits(row.price))}${row.unit === "%" ? "%" : ""}` : "—";
  const body = (
    <>
      <span className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden="true"
          className="w-9 h-9 flex-shrink-0 rounded-full border border-lq-line-2 bg-lq-surface-2 flex items-center justify-center lq-num text-[10px] text-lq-gold-soft"
        >
          {row.short.replace(/[^A-Z0-9]/g, "").slice(0, 3)}
        </span>
        <span className="flex flex-col min-w-0">
          <span className="text-[14px] text-lq-text leading-snug line-clamp-2 sm:truncate">{row.name}</span>
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="lq-num text-[11px] text-lq-muted px-1.5 py-px rounded border border-lq-line-2">{row.short}</span>
            {row.frequency === "monthly" && <span className="text-[11px] text-lq-muted">monthly</span>}
          </span>
        </span>
      </span>
      <span className="hidden sm:flex justify-center">
        <Sparkline values={row.spark ?? []} width={96} height={28} />
      </span>
      <span className="flex flex-col items-end leading-tight">
        <span className="lq-num text-[14px] text-lq-text">{price}</span>
        <span className="text-[11px] text-lq-muted truncate max-w-[140px]">
          {row.available ? (row.unit && row.unit !== "%" ? row.unit : "") : "Unavailable"}
        </span>
      </span>
      <ChangeCell row={row} />
    </>
  );
  const cls =
    "grid grid-cols-[minmax(0,1fr)_auto_76px] sm:grid-cols-[minmax(0,1fr)_100px_auto_76px] items-center gap-3 sm:gap-4 px-3 py-3 rounded-[10px] text-left w-full";
  return (
    <li className="border-b border-lq-line-soft last:border-b-0">
      {onOpen ? (
        <button type="button" onClick={onOpen} className={`${cls} hover:bg-lq-surface-2 transition-colors`} title={`Open ${row.short} chart`}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

/** One page per Markets menu entry: grouped quote lists, each row opens the chart page. */
export default function MarketsPage({ category, onOpenChart }: { category: string; onOpenChart: (id: string) => void }) {
  const navigate = useNavigate();
  const [data, setData] = useState<MarketResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const meta = MARKET_ITEMS.find((m) => m.category === category) ?? MARKET_ITEMS[0];

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    fetch(`/api/markets/${category}`)
      .then((r) => r.json())
      .then((d: MarketResponse) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [category]);

  const groups = useMemo(() => {
    const map = new Map<string, MarketRow[]>();
    for (const r of data?.rows ?? []) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    }
    return [...map.entries()];
  }, [data]);

  const anyLive = (data?.rows ?? []).some((r) => r.available);
  const asOf = (data?.rows ?? []).find((r) => r.available && r.frequency === "daily")?.asOf;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
      <div className="lq-rise flex flex-col gap-4" style={{ "--lq-i": 0 } as React.CSSProperties}>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-lq-muted">
          <span>Markets</span>
          <ChevronRight className="w-3 h-3" aria-hidden="true" />
          <span className="text-lq-text-2">{meta.label}</span>
        </nav>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <h1 className="lq-h1 lq-h1--grad">{meta.label}</h1>
          <p className="m-0 text-[14px] text-lq-text-2 max-w-2xl pb-1">{data?.blurb ?? meta.hint}</p>
        </div>
        <div role="tablist" aria-label="Market" className="flex flex-wrap gap-2">
          {MARKET_ITEMS.map((m) => (
            <button
              key={m.category}
              type="button"
              role="tab"
              aria-selected={m.category === category}
              className="lq-chip"
              onClick={() => navigate(m.to)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <div className="lq-panel p-6">
          <Empty>Market data couldn't be loaded. Try again in a minute.</Empty>
        </div>
      ) : data === null ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="lq-panel p-5 flex flex-col gap-3" aria-hidden="true">
              <span className="h-4 w-40 rounded bg-lq-surface-2" />
              {[0, 1, 2, 3].map((j) => (
                <span key={j} className="h-12 rounded-[10px] bg-lq-surface-2/60" />
              ))}
            </div>
          ))}
          <span className="sr-only" role="status">
            Loading {meta.label.toLowerCase()}…
          </span>
        </div>
      ) : (
        <>
          {!anyLive && (
            <div className="lq-card p-4 text-[13px] text-lq-text-2">
              Live quotes for {meta.label.toLowerCase()} are unavailable right now. The list below shows what this page tracks; prices
              appear as soon as the data feed responds.
            </div>
          )}
          <div className={`grid gap-6 ${groups.length > 1 ? "xl:grid-cols-2" : ""} items-start`}>
            {groups.map(([group, rows], gi) => (
              <section
                key={group}
                className="lq-panel lq-rise p-4 md:p-5 flex flex-col gap-2 min-w-0"
                aria-labelledby={`mk-${gi}`}
                style={{ "--lq-i": gi + 1 } as React.CSSProperties}
              >
                <div className="flex items-center gap-3 px-1 pb-1">
                  <span className="lq-marker" aria-hidden="true" />
                  <h2 id={`mk-${gi}`} className="lq-h3">
                    {group}
                  </h2>
                  <span className="ml-auto lq-lbl">{rows.length}</span>
                </div>
                <ul className="m-0 p-0 list-none">
                  {rows.map((r) => (
                    <Row key={r.id} row={r} onOpen={r.chartable ? () => onOpenChart(r.id) : undefined} />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {category === "stocks" && (
            <div className="lq-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="m-0 text-[14px] text-lq-text">Looking for a company that isn't listed here?</p>
                <p className="m-0 mt-1 text-[13px] text-lq-muted">
                  Use the search bar at the top (press <kbd className="lq-num text-lq-text-2">/</kbd>) to open any US or Indian stock, or
                  filter the full list in the Screener.
                </p>
              </div>
              <button type="button" className="lq-btn self-start sm:self-center" onClick={() => navigate("/app/screener")}>
                <Filter className="w-4 h-4" aria-hidden="true" /> Open Screener
              </button>
            </div>
          )}

          <p className="m-0 text-[12px] text-lq-muted">
            Daily data from public feeds, usually delayed 15 minutes or more{asOf ? ` · last quote ${new Date(asOf).toLocaleString()}` : ""}.
            {category === "bonds" && " Global 10-year yields are monthly OECD averages via FRED."}
          </p>
        </>
      )}
    </div>
  );
}
