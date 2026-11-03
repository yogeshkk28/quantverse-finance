import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Ticker } from "../types";
import NetworkView, { DrawEdge } from "./correlation/NetworkView";
import MatrixHeatmap from "./correlation/MatrixHeatmap";
import SpectrumChart from "./correlation/SpectrumChart";
import RegimePanel from "./correlation/RegimePanel";
import NodeDetail, { GroupSwatch } from "./correlation/NodeDetail";
import { ROLE_LABEL } from "./correlation/palette";
import type { Basis, Dynamics, Estimator, Market, NetworkKind, Structure, WebNode } from "./correlation/types";

interface CorrelationWebTabProps {
  tickers: Ticker[];
  onSelectTicker: (tickerId: string) => void;
  onAlertMessage?: (msg: string) => void;
}

const NETWORKS: Array<{ id: NetworkKind; label: string; note: string }> = [
  {
    id: "mst",
    label: "Backbone",
    note: "Minimum spanning tree: the strongest chain of links that connects every stock, with no loops. Faint edges are ones that often disappear when the days are resampled.",
  },
  {
    id: "tmfg",
    label: "Filtered graph",
    note: "TMFG: the backbone plus the tightest triangles of stocks, about three links per stock. Hub scores are measured on this graph.",
  },
  {
    id: "partial",
    label: "Direct ties",
    note: "Partial correlation: a link only when two stocks are tied after every other stock is accounted for. Links that exist only through a third stock drop out.",
  },
  {
    id: "threshold",
    label: "Threshold",
    note: "Every pair whose correlation clears a significance bar corrected for testing all pairs at once.",
  },
  {
    id: "leads",
    label: "Lead-lag",
    note: "An arrow from A to B means A's market-adjusted move today has tended to show up in B tomorrow. Only pairs that pass a strict significance test are drawn.",
  },
];

const ESTIMATORS: Array<{ id: Estimator; label: string; hint: string }> = [
  { id: "lw", label: "Ledoit–Wolf", hint: "Shrinks noisy correlations towards their average by the statistically optimal amount" },
  { id: "rmt", label: "Noise-filtered", hint: "Random-matrix filter: keeps only eigen-directions that stand out from pure noise" },
  { id: "sample", label: "Sample", hint: "Plain sample correlation, no cleaning" },
];

function Chips<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string; hint?: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <span className="lq-lbl">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={String(o.id)} type="button" className="lq-chip" aria-pressed={value === o.id} title={o.hint} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="lq-panel px-4 py-3.5 flex flex-col gap-1 min-w-0">
      <span className="lq-lbl">{label}</span>
      <span className="lq-num text-xl text-lq-text">{value}</span>
      <span className="text-[11px] text-lq-muted leading-snug">{sub}</span>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function CorrelationWebTab({ onSelectTicker, onAlertMessage }: CorrelationWebTabProps) {
  const [market, setMarket] = useState<Market>("US");
  const [days, setDays] = useState(90);
  const [basis, setBasis] = useState<Basis>("residual");
  const [estimator, setEstimator] = useState<Estimator>("lw");
  const [kind, setKind] = useState<NetworkKind>("mst");
  const [colorBy, setColorBy] = useState<"cluster" | "sector">("cluster");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusGroup, setFocusGroup] = useState<number | null>(null);

  const [data, setData] = useState<Structure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regime, setRegime] = useState<Dynamics | null>(null);
  const [regimeError, setRegimeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/correlation-web/structure?market=${market}&days=${days}&basis=${basis}&estimator=${estimator}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Could not compute correlations.");
        return body as Structure;
      })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message || "Could not reach the server."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [market, days, basis, estimator]);

  useEffect(() => {
    let cancelled = false;
    setRegime(null);
    setRegimeError(null);
    fetch(`/api/correlation-web/dynamics?market=${market}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Regime metrics unavailable.");
        return body as Dynamics;
      })
      .then((d) => !cancelled && setRegime(d))
      .catch((e) => !cancelled && setRegimeError(e.message));
    return () => {
      cancelled = true;
    };
  }, [market]);

  useEffect(() => {
    setSelectedId(null);
    setFocusGroup(null);
  }, [market]);
  useEffect(() => setFocusGroup(null), [colorBy, data]);

  const sectors = useMemo(() => {
    if (!data) return [] as string[];
    const counts = new Map<string, number>();
    data.nodes.forEach((n) => counts.set(n.sector, (counts.get(n.sector) ?? 0) + 1));
    return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
  }, [data]);

  const groupOf = useCallback(
    (n: WebNode) => (colorBy === "cluster" ? n.cluster : Math.max(0, sectors.indexOf(n.sector))),
    [colorBy, sectors]
  );
  const groupLabel = useCallback((g: number) => (colorBy === "cluster" ? `Group ${g + 1}` : sectors[g] ?? "Other"), [colorBy, sectors]);
  const groupCount = colorBy === "cluster" ? data?.clusters.k ?? 0 : sectors.length;

  const edges: DrawEdge[] = useMemo(() => {
    if (!data) return [];
    if (kind === "leads")
      return data.edges.leads.map((l) => ({
        source: typeof l.source === "object" ? l.source.id : l.source,
        target: typeof l.target === "object" ? l.target.id : l.target,
        value: l.value,
      }));
    return data.edges[kind];
  }, [data, kind]);

  const selected = data?.nodes.find((n) => n.id === selectedId) ?? null;
  const ranked = useMemo(() => (data ? [...data.nodes].sort((a, b) => b.hub - a.hub) : []), [data]);
  const groupMembers = useMemo(() => {
    if (!data) return [] as WebNode[][];
    const out: WebNode[][] = Array.from({ length: groupCount }, () => []);
    data.nodes.forEach((n) => out[groupOf(n)]?.push(n));
    return out;
  }, [data, groupCount, groupOf]);

  const net = NETWORKS.find((x) => x.id === kind)!;
  const emptyNote =
    kind === "leads"
      ? data && data.sessions < 60
        ? "30 sessions is too short to test who moves first. Pick 90 days or 1 year."
        : "No lead-lag pair passed the significance test in this window. That's the usual result for large, heavily traded stocks: news reaches them all on the same day."
      : kind === "partial"
      ? "No direct tie survives the partial-correlation test in this window."
      : "No pair clears the significance threshold in this window.";

  const openChart = (id: string) => {
    onSelectTicker(id);
    onAlertMessage?.(`Opened chart: ${id}`);
  };

  return (
    <div className="relative z-[1] w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      {/* Title */}
      <header className="flex flex-col gap-2 lq-rise">
        <span className="flex items-center gap-2 lq-lbl !text-lq-gold">
          <span className="lq-marker" aria-hidden="true" /> Correlation Web · Market structure lab
        </span>
        <h1 className="lq-h1">How the market is wired</h1>
        <p className="text-sm text-lq-text-2 max-w-3xl leading-relaxed">
          Cleaned correlations, filtered networks, automatic groups, hub scores and a regime monitor for the stocks Lumina tracks.
          Everything describes the past and is for practice, not advice.
        </p>
      </header>

      {/* Controls */}
      <section className="lq-panel p-4 sm:p-5 flex flex-wrap gap-x-8 gap-y-4 lq-rise" style={{ ["--lq-i" as any]: 1 }} aria-label="Analysis settings">
        <Chips<Market>
          label="Market"
          value={market}
          onChange={setMarket}
          options={[
            { id: "US", label: "United States" },
            { id: "IN", label: "India (NSE)" },
          ]}
        />
        <Chips<number>
          label="Window"
          value={days}
          onChange={setDays}
          options={[
            { id: 30, label: "30 days" },
            { id: 90, label: "90 days" },
            { id: 250, label: "1 year" },
          ]}
        />
        <Chips<Basis>
          label="Returns"
          value={basis}
          onChange={setBasis}
          options={[
            { id: "residual", label: "Market-adjusted", hint: "Each stock's move with its index taken out" },
            { id: "raw", label: "Raw", hint: "Plain daily returns; most stocks look linked through the market" },
          ]}
        />
        <Chips<Estimator> label="Estimator" value={estimator} onChange={setEstimator} options={ESTIMATORS} />
      </section>

      {error && !loading && (
        <div className="lq-panel p-6 text-sm text-lq-text-2" role="alert">
          {error}
        </div>
      )}

      {/* KPIs */}
      {data && (
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" aria-label="Structure summary">
          <Kpi
            label="Average correlation"
            value={data.stats.avgCorr.toFixed(2)}
            sub={`${data.basis === "residual" ? "Market-adjusted" : "Raw"} · ${data.sessions} sessions`}
          />
          <Kpi
            label="Absorption ratio"
            value={pct(data.spectrum.absorption)}
            sub={regime ? `${regime.absorptionPercentile}th percentile of 2 years (raw)` : "Top fifth of eigenvectors"}
          />
          <Kpi label="Factors above noise" value={String(data.spectrum.signal)} sub={`${data.basis === "residual" ? "Largest factor" : "Market mode"} ${pct(data.spectrum.marketShare)} of variance`} />
          <Kpi label="Effective bets" value={data.spectrum.effectiveRank.toFixed(1)} sub={`Independent drivers among ${data.nodes.length} stocks`} />
          <Kpi label="Groups found" value={String(data.clusters.k)} sub={`Silhouette ${data.clusters.silhouette.toFixed(2)}${data.clusters.silhouette < 0.1 ? " · weak" : ""}`} />
          <Kpi
            label={data.shrinkage !== null ? "Shrinkage" : "Backbone reliability"}
            value={data.shrinkage !== null ? data.shrinkage.toFixed(2) : pct(data.stats.mstReliability)}
            sub={data.shrinkage !== null ? `Backbone reliability ${pct(data.stats.mstReliability)}` : `Tree length ${data.stats.treeLength.toFixed(2)}`}
          />
        </section>
      )}

      {/* Network + side */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <section className="lq-panel w-full flex-1 min-w-0 flex flex-col overflow-hidden" aria-label="Correlation network">
          <div className="p-4 sm:p-5 flex flex-col gap-4 border-b border-lq-line">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Chips<NetworkKind> label="Network" value={kind} onChange={setKind} options={NETWORKS.map((n) => ({ id: n.id, label: n.label }))} />
              <Chips<"cluster" | "sector">
                label="Colour by"
                value={colorBy}
                onChange={setColorBy}
                options={[
                  { id: "cluster", label: "Groups found" },
                  { id: "sector", label: "Sector" },
                ]}
              />
            </div>
            <p className="text-xs text-lq-muted leading-relaxed max-w-3xl">{net.note}</p>
          </div>

          <div className="relative h-[560px] sm:h-[620px] overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 45% 40% at 50% 50%, rgba(143,123,255,0.08), transparent 70%), radial-gradient(ellipse 70% 60% at 50% 50%, rgba(212,175,55,0.035), transparent 75%)",
              }}
            />
            {data && !loading && (
              <NetworkView
                nodes={data.nodes}
                edges={edges}
                kind={kind}
                groupOf={groupOf}
                selectedId={selectedId}
                focusGroup={focusGroup}
                onSelect={setSelectedId}
              />
            )}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-xs text-lq-muted">
                <RefreshCw className="w-4 h-4 animate-spin text-lq-gold" aria-hidden="true" />
                <span>Estimating correlations, networks and clusters…</span>
              </div>
            )}
            {data && !loading && edges.length === 0 && (
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 mx-auto max-w-md text-center text-xs text-lq-text-2 lq-card px-5 py-4 pointer-events-none">
                {emptyNote}
              </div>
            )}
          </div>

          {data && (
            <div className="p-4 sm:p-5 border-t border-lq-line flex flex-col gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Focus a group">
                {groupMembers.map((members, g) =>
                  members.length ? (
                    <button
                      key={g}
                      type="button"
                      className="lq-chip"
                      aria-pressed={focusGroup === g}
                      onClick={() => setFocusGroup(focusGroup === g ? null : g)}
                      title={members.map((m) => m.id).join(", ")}
                    >
                      <GroupSwatch group={g} /> {groupLabel(g)} <span className="lq-num opacity-70">{members.length}</span>
                    </button>
                  ) : null
                )}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-lq-muted">
                <span className="flex items-center gap-2">
                  <span className="inline-block w-6 h-0.5 bg-lq-gold-soft" aria-hidden="true" /> Move together
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: "#3987e5" }} aria-hidden="true" /> Move opposite
                </span>
                <span>Thicker = stronger · Bigger node = higher hub score</span>
                {kind === "mst" && <span>Faint edge = less reliable under resampling</span>}
                {kind === "partial" && data.thresholds.partialTest === "ranked" && (
                  <span>Too few days for a formal test; showing the {data.nodes.length} strongest direct ties</span>
                )}
                {kind === "threshold" && <span>|ρ| ≥ {data.thresholds.link}</span>}
                {data.missing.length > 0 && <span>No history: {data.missing.join(", ")}</span>}
              </div>
            </div>
          )}
        </section>

        <div className="w-full xl:w-[400px] flex-none flex flex-col gap-6">
          {data && selected ? (
            <NodeDetail
              key={selected.id}
              node={selected}
              data={data}
              market={market}
              groupOf={groupOf}
              groupLabel={groupLabel}
              onClose={() => setSelectedId(null)}
              onSelect={setSelectedId}
              onOpenChart={openChart}
            />
          ) : (
            data && (
              <section className="lq-panel p-5 flex flex-col gap-3" aria-labelledby="cw-hubs">
                <h2 id="cw-hubs" className="lq-h3">
                  Systemic hubs
                </h2>
                <p className="text-xs text-lq-muted leading-relaxed">
                  Ranked by hub score on the filtered graph. Hubs pass shocks on to many stocks; periphery names diversify. Select a stock
                  for its neighbours, pair charts and event study.
                </p>
                <div className="overflow-x-auto -mx-1">
                  <table className="lq-table text-xs">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Stock</th>
                        <th scope="col">Role</th>
                        <th scope="col" className="!text-right">
                          Hub
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((n, i) => (
                        <tr key={n.id}>
                          <td className="!py-1.5 lq-num text-lq-muted">{i + 1}</td>
                          <td className="!py-1.5">
                            <button
                              type="button"
                              className="flex items-center gap-2 lq-num text-lq-text hover:text-lq-gold"
                              onClick={() => setSelectedId(n.id)}
                            >
                              <GroupSwatch group={groupOf(n)} size={10} /> {n.id}
                            </button>
                          </td>
                          <td className="!py-1.5 text-lq-text-2">{ROLE_LABEL[n.role]}</td>
                          <td className="!py-1.5">
                            <span className="flex items-center justify-end gap-2">
                              <span className="h-1.5 w-16 rounded-full bg-lq-surface-2 overflow-hidden" aria-hidden="true">
                                <span className="block h-full rounded-full bg-lq-text-2" style={{ width: `${Math.round(n.hub * 100)}%` }} />
                              </span>
                              <span className="lq-num text-lq-text w-6 text-right">{Math.round(n.hub * 100)}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          )}
        </div>
      </div>

      {/* Matrix + spectrum */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="lq-panel p-5 flex flex-col gap-4" aria-labelledby="cw-matrix">
            <div className="flex items-center gap-2">
              <span className="lq-marker" aria-hidden="true" />
              <h2 id="cw-matrix" className="lq-h3">
                Clustered correlation matrix
              </h2>
            </div>
            <MatrixHeatmap data={data} selectedId={selectedId} onSelect={setSelectedId} />
          </section>
          <section className="lq-panel p-5 flex flex-col gap-4" aria-labelledby="cw-spectrum">
            <div className="flex items-center gap-2">
              <span className="lq-marker" aria-hidden="true" />
              <h2 id="cw-spectrum" className="lq-h3">
                Eigenvalue spectrum vs. noise
              </h2>
            </div>
            <SpectrumChart spectrum={data.spectrum} n={data.nodes.length} adjusted={data.basis === "residual"} />
            <div className="border-t border-lq-line pt-4 flex flex-col gap-2">
              <span className="lq-lbl">Why {data.clusters.k} groups</span>
              <div className="flex flex-wrap gap-2">
                {data.clusters.scan.map((s) => (
                  <span
                    key={s.k}
                    className={`lq-card px-2.5 py-1.5 lq-num text-[11px] ${s.k === data.clusters.k ? "!border-lq-gold-line text-lq-text" : "text-lq-muted"}`}
                  >
                    k={s.k} · {s.silhouette.toFixed(2)}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-lq-muted leading-relaxed">
                The clustering tree is cut where the average silhouette (how much closer each stock is to its own group than to the next) is
                highest. Below about 0.1 the groups are weak and should not be read too closely.
              </p>
            </div>
          </section>
        </div>
      )}

      {/* Regime */}
      <section className="lq-panel p-5 flex flex-col gap-4" aria-labelledby="cw-regime">
        <div className="flex items-center gap-2">
          <span className="lq-marker" aria-hidden="true" />
          <h2 id="cw-regime" className="lq-h3">
            Regime monitor
          </h2>
        </div>
        {regime ? (
          <RegimePanel data={regime} />
        ) : (
          <p className="text-xs text-lq-muted">{regimeError ?? "Computing rolling windows…"}</p>
        )}
      </section>

      {/* Method */}
      <details className="lq-panel p-5 text-xs text-lq-text-2 leading-relaxed">
        <summary className="cursor-pointer lq-lbl !text-lq-text-2">Method and references</summary>
        <ul className="mt-3 flex flex-col gap-2 list-disc pl-5 marker:text-lq-gold">
          <li>
            Returns are daily, outlier-capped at ±3 robust standard deviations, and by default market-adjusted (residuals after each
            stock's beta to its index).
          </li>
          <li>
            Ledoit–Wolf (2003) shrinks the correlation matrix towards a constant-correlation target with the optimal intensity. The
            noise filter clips eigenvalues inside the Marchenko–Pastur band (Laloux et al. 1999; Plerou et al. 2002).
          </li>
          <li>Distance between two stocks is √(2(1 − ρ)) (Mantegna 1999). Partial correlations come from the inverse of the cleaned matrix.</li>
          <li>
            Backbone: minimum spanning tree, with edge reliability from a 5-day block bootstrap (Tumminello et al. 2007). Filtered graph:
            TMFG (Massara, Di Matteo &amp; Aste 2016).
          </li>
          <li>Groups: average-linkage clustering cut at the best silhouette. Hub score: mean percentile of strength, eigenvector, betweenness and closeness centrality (Pozzi et al. 2013).</li>
          <li>
            Regime: absorption ratio and its 15-day shift (Kritzman et al. 2011), spanning-tree length and survival (Onnela et al. 2003)
            over rolling 60-session windows.
          </li>
          <li>Lead-lag pairs and partial ties pass Bonferroni-corrected tests, so a few links are expected to be missing rather than false.</li>
        </ul>
      </details>
    </div>
  );
}
