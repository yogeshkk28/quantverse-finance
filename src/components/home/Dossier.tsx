import React, { useRef, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { useJson, fmtPrice, fmtSigned, timeAgo, asOfLabel, RangeBar, Skeleton } from "./ui";
import { fmtCompact } from "../dashboard/parts";
import { NewsItem, headlineFor } from "./NewsPanel";

type Vote = "buy" | "sell" | "neutral";
interface Tally {
  buy: number;
  sell: number;
  neutral: number;
  rows: { name: string; value: number; vote: Vote }[];
}
interface DossierData {
  symbol: string;
  short: string;
  name: string;
  kind: "index" | "future" | "fx" | "crypto" | "stock";
  available: boolean;
  currency?: string;
  unit?: string;
  asOf?: string;
  price?: number;
  change?: number;
  changePct?: number;
  dayLow?: number;
  dayHigh?: number;
  low52?: number;
  high52?: number;
  volume?: number | null;
  avgVolume30?: number | null;
  spark?: number[];
  performance?: { label: string; pct: number | null }[];
  seasonals?: { year: number; points: { d: number; v: number }[] }[];
  technicals?: { score: number; label: string; movingAverages: Tally; oscillators: Tally };
  volTerm?: { label: string; vol: number }[];
  risk?: { maxDrawdown1Y: number; fromHigh: number; upDays1Y: number; atrPct: number };
  breadth?: {
    members: number;
    region: "US" | "IN";
    aboveMa: { label: string; pct: number }[];
    outperforming: { label: string; pct: number }[];
    equalWeightVsIndex1M: number;
    highsLows: { label: string; highs: number; lows: number; netPct: number }[];
  } | null;
  profile?: { type: string; exchange: string; hours: string; quoteCurrency: string; dataSymbol: string; history: string };
}

const SECTIONS = [
  { id: "pulse", label: "Pulse" },
  { id: "breadth", label: "Breadth" },
  { id: "perf", label: "Returns" },
  { id: "season", label: "Seasonals" },
  { id: "tech", label: "Technicals" },
  { id: "vol", label: "Volatility" },
  { id: "profile", label: "Profile" },
] as const;

const SEASON_COLORS = ["var(--lq-gold)", "#7cc4ff", "#a3a7b7"];

/**
 * The instrument dossier: one dense, scrollable side panel that explains whatever
 * is in focus on the homepage (an index, future, currency or coin): today's move,
 * volume against its average, the latest related headline, market breadth,
 * returns by horizon, seasonal paths, a technical summary, realised volatility by
 * horizon, risk and profile. Section tabs at the top jump within the panel.
 */
export const DOSSIER_PICKS = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^NSEI", label: "Nifty 50" },
  { symbol: "^BSESN", label: "Sensex" },
  { symbol: "^NSEBANK", label: "Nifty Bank" },
  { symbol: "CL=F", label: "WTI crude" },
  { symbol: "NG=F", label: "Natural gas" },
  { symbol: "GC=F", label: "Gold" },
  { symbol: "HG=F", label: "Copper" },
  { symbol: "USDINR=X", label: "USD/INR" },
  { symbol: "BTC-USD", label: "Bitcoin" },
];

export default function Dossier({ symbol, news, onPick }: { symbol: string; news: NewsItem[]; onPick: (symbol: string) => void }) {
  const d = useJson<DossierData>(`/api/dossier?symbol=${encodeURIComponent(symbol)}`, 180_000);
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>("pulse");

  const jump = (id: string) => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>(`[data-sec="${id}"]`);
    if (box && el) box.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
  };
  const onScroll = () => {
    const box = scroller.current;
    if (!box) return;
    let cur = "pulse";
    box.querySelectorAll<HTMLElement>("[data-sec]").forEach((el) => {
      if (el.offsetTop - box.scrollTop <= 40) cur = el.dataset.sec!;
    });
    if (cur !== active) setActive(cur);
  };

  const ok = d && d.available;
  const up = (d?.changePct ?? 0) >= 0;
  const headline = ok ? headlineFor(d.symbol, d.short, news) : null;
  const sections = SECTIONS.filter((s) => s.id !== "breadth" || d?.breadth);

  return (
    <aside className="lq-panel lq-rise flex flex-col min-w-0 overflow-hidden xl:flex-1 xl:min-h-0" aria-labelledby="dossier-h" style={{ "--lq-i": 2 } as React.CSSProperties}>
      <header className="px-5 pt-5 pb-3 flex flex-col gap-3 border-b border-lq-line">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full grid place-items-center border border-lq-gold-line bg-lq-bg-2 lq-num text-[9px] text-lq-gold-soft flex-none">
            {(d?.short ?? "").replace(/[^A-Z0-9]/gi, "").slice(0, 4)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="dossier-h" className="m-0 text-[15px] font-semibold text-lq-text truncate">
              {d?.name ?? "Loading…"}
            </h2>
            <span className="lq-lbl text-[10px]">Dossier · {d?.profile?.type ?? kindLabel(d?.kind)}</span>
          </div>
          <label className="flex-none">
            <span className="sr-only">Instrument</span>
            <select
              value={symbol}
              onChange={(e) => onPick(e.target.value)}
              className="lq-input !min-h-[30px] !px-2 text-[12px] cursor-pointer"
            >
              {DOSSIER_PICKS.map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {ok ? (
          <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
            <span className="lq-num text-[28px] leading-none text-lq-text">{fmtPrice(d.price)}</span>
            <span className="text-[11px] text-lq-muted">{d.unit ? `USD ${d.unit}` : d.profile?.quoteCurrency}</span>
            <span className={`lq-num text-[14px] ${up ? "lq-up" : "lq-down"}`}>
              {fmtSigned(d.change, d.price && d.price < 20 ? 4 : 2)} {fmtSigned(d.changePct, 2, "%")}
            </span>
            <span className="basis-full lq-num text-[10px] text-lq-muted">Delayed · as of {asOfLabel(d.asOf)}</span>
          </div>
        ) : d === undefined ? (
          <Skeleton className="h-8 w-40" />
        ) : (
          <p className="m-0 text-[13px] text-lq-muted">Data for this instrument is unavailable right now.</p>
        )}
        <nav aria-label="Dossier sections" className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-0.5">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              aria-current={active === s.id ? "true" : undefined}
              className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${
                active === s.id ? "bg-lq-surface-2 text-lq-gold-soft border border-lq-gold-line" : "text-lq-muted hover:text-lq-text border border-transparent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      <div ref={scroller} onScroll={onScroll} tabIndex={0} aria-label="Dossier details" className="relative flex-1 min-h-0 overflow-y-auto px-5 pb-6 max-h-[620px] xl:max-h-none">
        {d === undefined ? (
          <div className="flex flex-col gap-4 pt-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : !ok ? null : (
          <>
            <Sec id="pulse" title="Pulse">
              <div className="grid grid-cols-2 gap-3">
                <RangeBar label="Day range" low={d.dayLow} high={d.dayHigh} value={d.price} />
                <RangeBar label="52-week range" low={d.low52} high={d.high52} value={d.price} />
              </div>
              {d.volume && d.avgVolume30 ? <VolumeBar vol={d.volume} avg={d.avgVolume30} /> : null}
              {headline ? (
                <a
                  href={headline.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg p-3 border border-lq-gold-line bg-[linear-gradient(135deg,rgba(212,175,55,0.08),rgba(143,123,255,0.06))] hover:border-lq-gold transition-colors"
                >
                  <span className="flex items-center gap-2 text-[11px]">
                    <span className="text-lq-gold font-medium">News</span>
                    <span className="text-lq-muted">
                      {headline.source}
                      {headline.time ? ` · ${timeAgo(headline.time)}` : ""}
                    </span>
                  </span>
                  <span className="block mt-1 text-[13px] text-lq-text leading-snug">{headline.title}</span>
                </a>
              ) : null}
              {d.risk && (
                <dl className="m-0 grid grid-cols-2 gap-2">
                  <Stat k="From 52W high" v={fmtSigned(d.risk.fromHigh, 2, "%")} tone={d.risk.fromHigh} />
                  <Stat k="Max drawdown 1Y" v={fmtSigned(d.risk.maxDrawdown1Y, 2, "%")} tone={d.risk.maxDrawdown1Y} />
                  <Stat k="Up days 1Y" v={`${d.risk.upDays1Y}%`} />
                  <Stat k="Avg true range" v={`${d.risk.atrPct}%`} />
                </dl>
              )}
            </Sec>

            {d.breadth && <Breadth b={d.breadth} />}

            {d.performance && (
              <Sec id="perf" title="Returns">
                <div className="grid grid-cols-3 gap-1.5">
                  {d.performance.map((p) => (
                    <PerfTile key={p.label} label={p.label} pct={p.pct} />
                  ))}
                </div>
              </Sec>
            )}

            {d.seasonals && d.seasonals.length > 0 && <Seasonals s={d.seasonals} />}

            {d.technicals && <Technicals t={d.technicals} />}

            {d.volTerm && d.volTerm.length > 1 && <VolCurve v={d.volTerm} />}

            {d.profile && (
              <Sec id="profile" title="Profile">
                <dl className="m-0 flex flex-col">
                  {[
                    ["Type", d.profile.type],
                    ["Exchange", d.profile.exchange],
                    ["Session", d.profile.hours],
                    ["Quoted in", d.profile.quoteCurrency],
                    ["Data symbol", d.profile.dataSymbol],
                    ["History", d.profile.history],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 py-1.5 border-b border-lq-line-soft last:border-0 text-[12px]">
                      <dt className="text-lq-muted">{k}</dt>
                      <dd className="m-0 text-lq-text-2 text-right lq-num text-[11px]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Sec>
            )}
            <p className="m-0 mt-4 text-[10px] text-lq-muted leading-relaxed">
              Computed from delayed daily closes. Ratings summarise past trend signals and are not advice.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

function kindLabel(k?: string) {
  return k === "future" ? "Future" : k === "fx" ? "Currency" : k === "crypto" ? "Crypto" : k === "stock" ? "Stock" : "Index";
}

function Sec({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section data-sec={id} aria-label={title} className="pt-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-[13px] font-semibold text-lq-text">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: number }) {
  return (
    <div className="rounded-md bg-lq-surface-2 border border-lq-line-soft px-2.5 py-2">
      <dt className="lq-lbl text-[9px]">{k}</dt>
      <dd className={`m-0 mt-0.5 lq-num text-[13px] ${tone == null ? "text-lq-text" : tone >= 0 ? "lq-up" : "lq-down"}`}>{v}</dd>
    </div>
  );
}

function VolumeBar({ vol, avg }: { vol: number; avg: number }) {
  const total = vol + avg;
  const ratio = vol / avg;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px]">
        <span>
          <span className="text-lq-muted">Volume </span>
          <span className="lq-num text-lq-text">{fmtCompact(vol)}</span>
        </span>
        <span>
          <span className="text-lq-muted">Avg 30D </span>
          <span className="lq-num text-lq-text">{fmtCompact(avg)}</span>
        </span>
      </div>
      <div className="flex h-1.5 gap-0.5 rounded-full overflow-hidden" role="img" aria-label={`Volume is ${ratio.toFixed(2)} times its 30-day average`}>
        <span className="bg-lq-gold" style={{ width: `${(vol / total) * 100}%` }} />
        <span className="bg-lq-line-2 flex-1" />
      </div>
      <span className="lq-num text-[10px] text-lq-muted">{ratio.toFixed(2)}× average</span>
    </div>
  );
}

function Breadth({ b }: { b: NonNullable<DossierData["breadth"]> }) {
  const max = Math.max(1, ...b.highsLows.map((h) => Math.max(h.highs, h.lows)));
  return (
    <Sec id="breadth" title="Breadth" aside={<span className="text-[10px] text-lq-muted">{b.members} tracked {b.region === "US" ? "US" : "NSE"} leaders</span>}>
      <div className="flex flex-col gap-1">
        <span className="lq-lbl text-[10px]">New 52-week highs and lows</span>
        <div className="grid grid-cols-4 gap-2 items-end h-[92px] pt-2" role="img" aria-label={b.highsLows.map((h) => `${h.label}: ${h.highs} highs, ${h.lows} lows`).join("; ")}>
          {b.highsLows.map((h) => (
            <div key={h.label} className="flex flex-col items-center gap-1 h-full justify-end">
              <div className="flex items-end gap-1 h-full">
                <span className="w-3 rounded-t-sm bg-lq-up/80" style={{ height: `${(h.highs / max) * 100}%`, minHeight: h.highs ? 3 : 0 }} title={`${h.highs} new highs`} />
                <span className="w-3 rounded-t-sm bg-lq-down/80" style={{ height: `${(h.lows / max) * 100}%`, minHeight: h.lows ? 3 : 0 }} title={`${h.lows} new lows`} />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {b.highsLows.map((h) => (
            <span key={h.label} className="flex flex-col">
              <span className="lq-num text-[10px] text-lq-muted">{h.label}</span>
              <span className={`lq-num text-[10px] ${h.netPct >= 0 ? "lq-up" : "lq-down"}`}>net {fmtSigned(h.netPct, 0, "%")}</span>
            </span>
          ))}
        </div>
        <div className="flex gap-3 text-[10px] text-lq-muted mt-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-lq-up" /> New highs
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-lq-down" /> New lows
          </span>
        </div>
      </div>
      <PctBars title="Above moving averages" rows={b.aboveMa} />
      <PctBars title="Outperforming the index" rows={b.outperforming} />
      <div className="flex justify-between text-[12px]">
        <span className="text-lq-muted">Equal-weight vs index, 1M</span>
        <span className={`lq-num ${b.equalWeightVsIndex1M >= 0 ? "lq-up" : "lq-down"}`}>{fmtSigned(b.equalWeightVsIndex1M, 1, "%")}</span>
      </div>
    </Sec>
  );
}

function PctBars({ title, rows }: { title: string; rows: { label: string; pct: number }[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="lq-lbl text-[10px]">{title}</span>
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-1">
          <div className="flex justify-between text-[12px]">
            <span className="text-lq-text-2">{r.label}</span>
            <span className="lq-num text-lq-text">{r.pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-lq-line overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-lq-gold-deep to-lq-gold" style={{ width: `${r.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PerfTile({ label, pct }: { label: string; pct: number | null }) {
  const has = pct != null;
  const up = (pct ?? 0) >= 0;
  const a = has ? Math.min(0.28, 0.06 + Math.abs(pct!) / 60) : 0;
  return (
    <div
      className="rounded-md px-2 py-2 text-center border border-lq-line-soft"
      style={{ background: has ? (up ? `rgba(74,222,128,${a})` : `rgba(248,113,113,${a})`) : "var(--lq-surface-2)" }}
    >
      <span className={`block lq-num text-[13px] ${has ? (up ? "lq-up" : "lq-down") : "text-lq-muted"}`}>{fmtSigned(pct, 2, "%")}</span>
      <span className="block lq-num text-[10px] text-lq-muted mt-0.5">{label}</span>
    </div>
  );
}

const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const monthOf = (doy: number) => MONTH_START.reduce((acc, start, i) => (start <= doy ? i : acc), 0);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Seasonals({ s }: { s: NonNullable<DossierData["seasonals"]> }) {
  // Merge each year's points on day-of-year so the tooltip lines them up.
  const map = new Map<number, Record<string, number>>();
  s.forEach((yr) => yr.points.forEach((p) => map.set(p.d, { ...(map.get(p.d) ?? { d: p.d }), [yr.year]: p.v })));
  const rows = [...map.values()].sort((a, b) => a.d - b.d);
  return (
    <Sec id="season" title="Seasonals" aside={<span className="text-[10px] text-lq-muted">% from prior year-end</span>}>
      <div className="h-[150px] -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="d"
              type="number"
              domain={[0, 365]}
              ticks={[0, 120, 243]}
              tickFormatter={(v) => MONTHS[monthOf(v)]}
              tick={{ fill: "var(--lq-muted)", fontSize: 10 }}
              axisLine={{ stroke: "var(--lq-line)" }}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <ReferenceLine y={0} stroke="var(--lq-line-2)" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{ background: "var(--lq-surface-2)", border: "1px solid var(--lq-line-2)", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "var(--lq-muted)" }}
              labelFormatter={(v) => {
                const m = monthOf(Number(v));
                return `${MONTHS[m]} ${Number(v) - MONTH_START[m] + 1}`;
              }}
              formatter={(v: number, name) => [`${v >= 0 ? "+" : ""}${v.toFixed(2)}%`, name]}
            />
            {s.map((yr, i) => (
              <Line
                key={yr.year}
                dataKey={String(yr.year)}
                name={String(yr.year)}
                stroke={SEASON_COLORS[i]}
                strokeWidth={i === 0 ? 2 : 1.2}
                strokeOpacity={i === 0 ? 1 : 0.75}
                dot={false}
                connectNulls
                isAnimationActive={false}
                type="linear"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 text-[10px]">
        {s.map((yr, i) => (
          <span key={yr.year} className="flex items-center gap-1.5 text-lq-muted">
            <span className="w-2 h-2 rounded-full" style={{ background: SEASON_COLORS[i] }} />
            <span className="lq-num">{yr.year}</span>
            <span className={`lq-num ${yr.points[yr.points.length - 1].v >= 0 ? "lq-up" : "lq-down"}`}>{fmtSigned(yr.points[yr.points.length - 1].v, 1, "%")}</span>
          </span>
        ))}
      </div>
    </Sec>
  );
}

const ZONES = ["Strong sell", "Sell", "Neutral", "Buy", "Strong buy"];

function Technicals({ t }: { t: NonNullable<DossierData["technicals"]> }) {
  const [open, setOpen] = useState(false);
  // score −1…1 → needle −90°…90°
  const angle = t.score * 90;
  const zoneColor = ["#b45454", "var(--lq-down)", "var(--lq-muted)", "var(--lq-up)", "#2f9e5b"];
  const arc = (from: number, to: number) => {
    const p = (deg: number) => {
      const r = ((deg - 180) * Math.PI) / 180;
      return `${(60 + 46 * Math.cos(r)).toFixed(2)} ${(58 + 46 * Math.sin(r)).toFixed(2)}`;
    };
    return `M ${p(from)} A 46 46 0 0 1 ${p(to)}`;
  };
  return (
    <Sec id="tech" title="Technicals" aside={<span className="text-[10px] text-lq-muted">daily</span>}>
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 120 66" className="w-[190px]" role="img" aria-label={`Technical summary: ${t.label}`}>
          {ZONES.map((z, i) => (
            <path key={z} d={arc(i * 36 + 2, (i + 1) * 36 - 2)} fill="none" stroke={zoneColor[i]} strokeOpacity={ZONES[i] === t.label ? 1 : 0.35} strokeWidth="6" strokeLinecap="round" />
          ))}
          <g transform={`rotate(${angle} 60 58)`} style={{ transition: "transform 0.6s cubic-bezier(0.2,0.7,0.2,1)" }}>
            <line x1="60" y1="58" x2="60" y2="20" stroke="var(--lq-gold-soft)" strokeWidth="2.2" strokeLinecap="round" />
          </g>
          <circle cx="60" cy="58" r="4" fill="var(--lq-bg)" stroke="var(--lq-gold)" strokeWidth="1.5" />
        </svg>
        <span className="font-serif text-[22px] text-lq-text -mt-1">{t.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["Moving averages", t.movingAverages],
            ["Oscillators", t.oscillators],
          ] as const
        ).map(([name, g]) => (
          <div key={name} className="rounded-md bg-lq-surface-2 border border-lq-line-soft px-2.5 py-2">
            <span className="lq-lbl text-[9px]">{name}</span>
            <div className="flex justify-between mt-1 lq-num text-[11px]">
              <span className="lq-down">S {g.sell}</span>
              <span className="text-lq-muted">N {g.neutral}</span>
              <span className="lq-up">B {g.buy}</span>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="self-center lq-chip text-[11px]">
        {open ? "Hide signals" : "Show all signals"}
      </button>
      {open && (
        <table className="w-full text-[11px]">
          <tbody>
            {[...t.oscillators.rows, ...t.movingAverages.rows].map((r) => (
              <tr key={r.name} className="border-b border-lq-line-soft last:border-0">
                <td className="py-1 text-lq-text-2">{r.name}</td>
                <td className="py-1 text-right lq-num text-lq-muted">{fmtPrice(r.value)}</td>
                <td className={`py-1 pl-2 text-right capitalize ${r.vote === "buy" ? "lq-up" : r.vote === "sell" ? "lq-down" : "text-lq-muted"}`}>{r.vote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Sec>
  );
}

function VolCurve({ v }: { v: NonNullable<DossierData["volTerm"]> }) {
  const short = v[0].vol;
  const long = v[v.length - 1].vol;
  const shape = short > long * 1.1 ? "Inverted: recent moves are larger than usual" : short < long * 0.9 ? "Upward sloping: calmer than usual lately" : "Flat: recent moves match the longer run";
  return (
    <Sec id="vol" title="Realised volatility" aside={<span className="text-[10px] text-lq-muted">annualised, by lookback</span>}>
      <div className="h-[130px] -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={v} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fill: "var(--lq-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--lq-line)" }} tickLine={false} interval={0} />
            <YAxis orientation="right" width={36} tick={{ fill: "var(--lq-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(x) => `${x}%`} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "var(--lq-surface-2)", border: "1px solid var(--lq-line-2)", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "var(--lq-muted)" }}
              formatter={(x: number) => [`${x.toFixed(1)}%`, "Volatility"]}
            />
            <Line dataKey="vol" stroke="var(--lq-gold)" strokeWidth={1.8} dot={{ r: 2.5, fill: "var(--lq-gold)", strokeWidth: 0 }} isAnimationActive={false} type="linear" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="m-0 text-[11px] text-lq-muted">{shape}.</p>
    </Sec>
  );
}
