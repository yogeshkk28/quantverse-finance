import React, { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, X } from "lucide-react";
import PairExplorer from "./PairExplorer";
import { ROLE_LABEL, groupColor, shapePath } from "./palette";
import type { EventStudy, Market, Structure, WebNode } from "./types";

const idOf = (end: string | { id: string }) => (typeof end === "object" ? end.id : end);
const signed = (v: number, digits = 2) => `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;

export function GroupSwatch({ group, size = 12 }: { group: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden="true" className="flex-none">
      <path d={shapePath(group, size * size * 0.5)} fill={groupColor(group)} />
    </svg>
  );
}

interface Props {
  node: WebNode;
  data: Structure;
  market: Market;
  groupOf: (n: WebNode) => number;
  groupLabel: (g: number) => string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onOpenChart: (id: string) => void;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="lq-card px-3 py-2.5" title={hint}>
      <span className="lq-lbl block">{label}</span>
      <span className="lq-num text-sm text-lq-text block mt-1">{value}</span>
    </div>
  );
}

export default function NodeDetail({ node, data, market, groupOf, groupLabel, onClose, onSelect, onOpenChart }: Props) {
  const idx = data.ids.indexOf(node.id);
  const [peer, setPeer] = useState<string | null>(null);

  const neighbours = useMemo(
    () =>
      data.ids
        .map((id, j) => ({ id, rho: data.corr[idx][j], partial: data.partial[idx][j] }))
        .filter((x) => x.id !== node.id)
        .sort((a, b) => b.rho - a.rho)
        .slice(0, 6),
    [data, idx, node.id]
  );
  const direct = useMemo(
    () =>
      data.edges.partial
        .filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => ({ id: e.source === node.id ? e.target : e.source, value: e.value })),
    [data, node.id]
  );
  const leads = data.edges.leads.filter((l) => idOf(l.source) === node.id);
  const follows = data.edges.leads.filter((l) => idOf(l.target) === node.id);

  useEffect(() => setPeer(neighbours[0]?.id ?? null), [node.id, neighbours]);

  // Event study over two years (independent of the window).
  const [study, setStudy] = useState<EventStudy | null>(null);
  const [studyState, setStudyState] = useState<"loading" | "ok" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    setStudyState("loading");
    fetch(`/api/correlation-web/events?market=${market}&symbol=${encodeURIComponent(node.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: EventStudy) => {
        if (cancelled) return;
        setStudy(d);
        setStudyState("ok");
      })
      .catch(() => !cancelled && setStudyState("error"));
    return () => {
      cancelled = true;
    };
  }, [node.id, market]);

  const g = groupOf(node);
  return (
    <aside className="lq-panel flex flex-col gap-5 p-5" aria-label={`${node.id} details`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="lq-h2 lq-num">{node.id}</h2>
          <p className="text-xs text-lq-muted mt-1 truncate">{node.name}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="lq-chip pointer-events-none !min-h-[26px] !px-2.5">
              <GroupSwatch group={g} /> {groupLabel(g)}
            </span>
            <span className="lq-tag">{ROLE_LABEL[node.role]}</span>
            <span className="lq-tag">{node.sector}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-2 -m-2 text-lq-muted hover:text-lq-text" aria-label="Close details">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Hub score" value={`${Math.round(node.hub * 100)}`} hint="Average percentile of strength, eigenvector, betweenness and closeness" />
        <Stat label="Beta" value={node.beta.toFixed(2)} hint="Sensitivity to the benchmark index over this window" />
        <Stat label="Factor 1 load" value={(node.loadings[0] ?? 0).toFixed(2)} hint="Loading on the first eigenvector: the market mode on raw returns, the largest common factor on market-adjusted ones" />
        <Stat label="Eigenvector" value={node.eigenvector.toFixed(2)} hint="Connected to other well-connected stocks" />
        <Stat label="Betweenness" value={node.betweenness.toFixed(2)} hint="Share of shortest paths through this stock" />
        <Stat label="Links" value={`${node.degree} · ${node.mstDegree}`} hint="Filtered-graph links · spanning-tree links" />
      </div>
      <p className="text-[11px] text-lq-muted leading-relaxed -mt-2">
        {node.role === "core"
          ? "A core hub: shocks here spread to many stocks. Holding it adds concentrated, system-wide risk."
          : node.role === "periphery"
          ? "On the periphery: loosely tied to the rest, so it tends to diversify a portfolio."
          : node.role === "bridge"
          ? "A bridge: few direct links, but it connects otherwise separate groups."
          : "Mid-network: neither a hub nor isolated."}
      </p>

      <section className="flex flex-col gap-2">
        <span className="lq-lbl">Closest stocks</span>
        <table className="lq-table text-xs">
          <thead>
            <tr>
              <th scope="col">Stock</th>
              <th scope="col" className="!text-right">Corr.</th>
              <th scope="col" className="!text-right">Partial</th>
            </tr>
          </thead>
          <tbody>
            {neighbours.map((nb) => (
              <tr key={nb.id} className={peer === nb.id ? "bg-white/[0.03]" : undefined}>
                <td className="!py-1.5">
                  <button type="button" className="lq-num text-lq-text hover:text-lq-gold" onClick={() => setPeer(nb.id)} aria-pressed={peer === nb.id}>
                    {nb.id}
                  </button>
                </td>
                <td className="!py-1.5 text-right lq-num text-lq-text-2">{signed(nb.rho)}</td>
                <td className="!py-1.5 text-right lq-num text-lq-text-2">{signed(nb.partial)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {direct.length > 0 && (
          <p className="text-[11px] text-lq-muted">
            Direct ties that pass the partial-correlation test:{" "}
            {direct.map((d, i) => (
              <React.Fragment key={d.id}>
                {i > 0 && ", "}
                <button type="button" className="lq-num text-lq-text-2 hover:text-lq-gold" onClick={() => onSelect(d.id)}>
                  {d.id}
                </button>
              </React.Fragment>
            ))}
            .
          </p>
        )}
      </section>

      {peer && (
        <section className="flex flex-col gap-2 border-t border-lq-line pt-4">
          <span className="lq-lbl">
            Pair · {node.id} × {peer}
          </span>
          <PairExplorer market={market} a={node.id} b={peer} days={data.days} />
        </section>
      )}

      <section className="flex flex-col gap-2 border-t border-lq-line pt-4">
        <span className="lq-lbl">Next-day lead-lag</span>
        {leads.length === 0 && follows.length === 0 ? (
          <p className="text-xs text-lq-muted">No lead-lag pair with {node.id} passes the significance test in this window.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {leads.map((l) => (
              <li key={`l-${idOf(l.target)}`} className="flex items-center justify-between lq-num">
                <span className="flex items-center gap-1.5 text-lq-text-2">
                  {node.id} <ArrowRight className="w-3 h-3" aria-label="leads" /> <b className="text-lq-text">{idOf(l.target)}</b>
                </span>
                <span className="text-lq-text-2">r {signed(l.value)}</span>
              </li>
            ))}
            {follows.map((l) => (
              <li key={`f-${idOf(l.source)}`} className="flex items-center justify-between lq-num">
                <span className="flex items-center gap-1.5 text-lq-text-2">
                  <b className="text-lq-text">{idOf(l.source)}</b> <ArrowRight className="w-3 h-3" aria-label="leads" /> {node.id}
                </span>
                <span className="text-lq-text-2">r {signed(l.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-lq-line pt-4">
        <span className="lq-lbl">After {node.id}'s biggest moves</span>
        {studyState === "loading" && <p className="text-xs text-lq-muted">Running the event study…</p>}
        {studyState === "error" && <p className="text-xs text-lq-muted">Couldn't run the event study.</p>}
        {studyState === "ok" && study && study.events.length === 0 && <p className="text-xs text-lq-muted">Not enough history.</p>}
        {studyState === "ok" && study && study.events.length > 0 && (
          <>
            <p className="text-[11px] text-lq-muted leading-relaxed">
              The {study.events.length} largest market-adjusted moves in two years (each at least {study.threshold}%). Peer moves are
              signed so + means the same direction as {node.id}.
            </p>
            <table className="lq-table text-xs">
              <thead>
                <tr>
                  <th scope="col">Peer</th>
                  <th scope="col" className="!text-right">Same day</th>
                  <th scope="col" className="!text-right">Next 5d</th>
                </tr>
              </thead>
              <tbody>
                {study.peers.slice(0, 6).map((p) => (
                  <tr key={p.id}>
                    <td className="!py-1.5 lq-num text-lq-text">
                      {p.id}
                      {p.significant && (
                        <span className="lq-tag ml-2 !py-0.5" title={`p = ${p.p}`}>
                          sig
                        </span>
                      )}
                    </td>
                    <td className="!py-1.5 text-right lq-num text-lq-text-2">{signed(p.sameDay)}%</td>
                    <td className="!py-1.5 text-right lq-num text-lq-text">{signed(p.next5)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-lq-muted">“sig” passes a t-test corrected for testing every peer at once.</p>
          </>
        )}
      </section>

      <button type="button" className="lq-btn w-full" onClick={() => onOpenChart(node.id)}>
        <Activity className="w-4 h-4" /> Open {node.id} chart
      </button>
    </aside>
  );
}
