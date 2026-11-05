import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useJson, fmtPrice } from "./home/ui";
import { MarketToggle, MoversResponse, MOVER_TITLES, MOVER_SUBTITLES } from "./home/HomeLists";
import { fmtCompact } from "./dashboard/parts";
import { chartPath } from "./nav/navConfig";

const LISTS = ["gainers", "losers", "active"] as const;
type List = (typeof LISTS)[number];

/** Full list behind the homepage's Top gainers / Top losers / Most active cards. */
export default function MoversPage({ list: raw }: { list?: string }) {
  const list: List = (LISTS as readonly string[]).includes(raw ?? "") ? (raw as List) : "gainers";
  const [params, setParams] = useSearchParams();
  const market = (["US", "IN"].includes(params.get("market") ?? "") ? params.get("market") : "ALL") as "ALL" | "US" | "IN";
  const navigate = useNavigate();
  const d = useJson<MoversResponse>(`/api/movers?list=${list}&market=${market}&limit=500`, 120_000);
  const rows = d?.rows ?? [];

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 py-10 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link to="/app/dashboard" className="text-[12px] text-lq-muted hover:text-lq-text">
          ‹ Home
        </Link>
        <h1 className="lq-h1">{MOVER_TITLES[list]}</h1>
        <p className="m-0 text-[13px] text-lq-muted">
          {MOVER_SUBTITLES[list]}. {list === "active" ? "Ranked by today's traded value (shares × price, in USD)." : "Ranked by today's change."} Across{" "}
          {d?.universe ?? "the"} tracked US and NSE stocks. Delayed data.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="List" className="flex gap-1 border-b border-lq-line">
          {LISTS.map((l) => (
            <Link
              key={l}
              role="tab"
              aria-selected={l === list}
              to={`/app/movers/${l}${market !== "ALL" ? `?market=${market}` : ""}`}
              className={`px-3 py-2 text-[13px] border-b-2 -mb-px ${l === list ? "border-lq-gold text-lq-text" : "border-transparent text-lq-muted hover:text-lq-text"}`}
            >
              {MOVER_TITLES[l]}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {d && <span className="lq-num text-[11px] text-lq-muted">{d.total} stocks</span>}
          <MarketToggle value={market} onChange={(m) => setParams(m === "ALL" ? {} : { market: m })} />
        </div>
      </div>

      <section className="lq-panel overflow-hidden">
        {d === undefined ? (
          <p className="m-0 p-8 text-center text-[13px] text-lq-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="m-0 p-8 text-center text-[13px] text-lq-muted">{d?.status === "building" ? "Ranking stocks, one moment…" : "Nothing to show right now."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="lq-table text-[13px]">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Company</th>
                  <th className="hidden md:table-cell">Sector</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Change</th>
                  <th className="text-right hidden sm:table-cell">Volume</th>
                  <th className="text-right hidden sm:table-cell">Rel. vol</th>
                  <th className="text-right hidden md:table-cell">Value (USD)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-lq-surface-2" onClick={() => navigate(chartPath(r.id))}>
                    <td className="lq-num text-lq-muted">{i + 1}</td>
                    <td>
                      <Link to={chartPath(r.id)} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-lq-text">{r.id}</span>
                        <span className="text-[10px] text-lq-muted px-1 rounded border border-lq-line">{r.market === "US" ? "US" : "NSE"}</span>
                        <span className="text-[12px] text-lq-muted truncate max-w-[220px]">{r.name}</span>
                      </Link>
                    </td>
                    <td className="hidden md:table-cell text-lq-muted text-[12px]">{r.sector}</td>
                    <td className="lq-num text-right">
                      {r.currency}
                      {fmtPrice(r.price, 2)}
                    </td>
                    <td className={`lq-num text-right ${r.changePct >= 0 ? "lq-up" : "lq-down"}`}>
                      {r.changePct >= 0 ? "+" : "−"}
                      {Math.abs(r.changePct).toFixed(2)}%
                    </td>
                    <td className="lq-num text-right hidden sm:table-cell">{r.volume ? fmtCompact(r.volume) : "—"}</td>
                    <td className="lq-num text-right hidden sm:table-cell text-lq-text-2">{r.relVolume != null ? `${r.relVolume.toFixed(1)}×` : "—"}</td>
                    <td className="lq-num text-right hidden md:table-cell text-lq-text-2">{r.valueUsd ? `$${fmtCompact(r.valueUsd)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {d?.simulated && <p className="m-0 text-[11px] text-lq-muted">Live quotes couldn't be loaded, so these are sample values.</p>}
    </div>
  );
}
