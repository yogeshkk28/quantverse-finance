import React from "react";
import { useNavigate } from "react-router-dom";
import { fmtPrice, SeeAll, Skeleton } from "./ui";
import { chartPath } from "../nav/navConfig";

export interface ListRow {
  key: string;
  /** Symbol or id the chart page opens. */
  chart: string;
  name: string;
  code: string;
  price?: number | null;
  currency?: string;
  unit?: string;
  changePct?: number | null;
  /** Optional right-side note under the change, e.g. traded value. */
  note?: string;
  /** Highlight, e.g. a stock you hold. */
  mark?: string;
}

/**
 * A compact quote list: badge, name with code, price and change. No charts;
 * tapping a row opens that instrument's chart page.
 */
export default function QuoteList({
  id,
  title,
  aside,
  rows,
  loading,
  empty = "Unavailable right now.",
  seeAll,
  footnote,
}: {
  id: string;
  title: string;
  aside?: React.ReactNode;
  rows: ListRow[];
  loading?: boolean;
  empty?: string;
  seeAll?: { href: string; label: string };
  footnote?: string;
}) {
  const navigate = useNavigate();
  return (
    <section className="lq-panel lq-rise flex flex-col min-w-0" aria-labelledby={id}>
      <div className="flex items-center gap-2 px-5 pt-5 pb-2">
        <h2 id={id} className="m-0 text-[17px] font-semibold text-lq-text">
          {title}
        </h2>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </div>
      {loading ? (
        <div className="px-5 py-2 flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="m-0 px-5 py-8 text-center text-[13px] text-lq-muted">{empty}</p>
      ) : (
        <ul className="m-0 p-0 list-none px-2">
          {rows.map((r) => {
            const up = (r.changePct ?? 0) >= 0;
            return (
              <li key={r.key} className="border-b border-lq-line-soft last:border-0">
                <button
                  type="button"
                  onClick={() => navigate(chartPath(r.chart))}
                  className="group w-full px-3 py-2.5 grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 text-left rounded-lg hover:bg-lq-surface-2 transition-colors"
                >
                  <span
                    aria-hidden="true"
                    className="w-[30px] h-[30px] rounded-full grid place-items-center border border-lq-line-2 bg-lq-surface-2 lq-num text-[9px] text-lq-text-2"
                  >
                    {r.code.replace(/[^A-Z0-9]/gi, "").slice(0, 3)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] text-lq-text truncate group-hover:text-lq-gold">{r.name}</span>
                    <span className="flex items-center gap-1.5 mt-0.5">
                      <span className="lq-num text-[10px] text-lq-muted px-1.5 py-px rounded bg-lq-surface-2 border border-lq-line-soft">{r.code}</span>
                      {r.mark && <span className="text-[10px] text-lq-gold">{r.mark}</span>}
                    </span>
                  </span>
                  <span className="text-right leading-tight">
                    <span className="block lq-num text-[14px] text-lq-text">
                      {r.price != null ? `${r.currency ?? ""}${fmtPrice(r.price)}` : "—"}
                      {r.unit && <span className="ml-1 text-[10px] text-lq-muted font-sans">{r.unit}</span>}
                    </span>
                    <span className={`block lq-num text-[12px] mt-0.5 ${r.changePct == null ? "text-lq-muted" : up ? "lq-up" : "lq-down"}`}>
                      {r.changePct == null ? "—" : `${up ? "+" : "−"}${Math.abs(r.changePct).toFixed(2)}%`}
                      {r.note && <span className="ml-1.5 text-lq-muted">{r.note}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {(seeAll || footnote) && (
        <div className="mt-auto px-5 pt-2 pb-4 flex items-center gap-3">
          {seeAll && <SeeAll href={seeAll.href}>{seeAll.label}</SeeAll>}
          {footnote && <span className="ml-auto text-[10px] text-lq-muted text-right">{footnote}</span>}
        </div>
      )}
    </section>
  );
}
