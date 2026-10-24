import React, { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { Layers, ArrowRight } from "lucide-react";
import { CorrelationNode, CorrelationLink, CorrelationLead } from "../types";

interface WebData {
  nodes: CorrelationNode[];
  links: CorrelationLink[];
  leads: CorrelationLead[];
  sessions?: number;
}

const W = 800;
const H = 220;
const idOf = (end: string | CorrelationNode) => (typeof end === "object" ? end.id : end);

/**
 * Dashboard preview of the Correlation Web: the live market-adjusted links for
 * the last 90 sessions, laid out once (no animation) to keep the dashboard light.
 */
export default function MiniCorrelationWeb({ onOpen }: { onOpen: () => void }) {
  const [market, setMarket] = useState<"US" | "IN">("US");
  const [data, setData] = useState<WebData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/correlation-web?market=${market}&days=90&mode=adjusted`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(body.error || "Correlation data is unavailable.");
        else setData(body);
      })
      .catch(() => !cancelled && setError("Correlation data is unavailable."));
    return () => {
      cancelled = true;
    };
  }, [market]);

  const layout = useMemo(() => {
    if (!data || data.nodes.length === 0) return null;
    const nodes = data.nodes.map((n) => ({ ...n }));
    const links = data.links.map((l) => ({ source: idOf(l.source), target: idOf(l.target), value: l.value }));
    const sim = d3
      .forceSimulation(nodes as any)
      .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(70).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-90))
      .force("x", d3.forceX(W / 2).strength(0.04))
      .force("y", d3.forceY(H / 2).strength(0.12))
      .force("collide", d3.forceCollide().radius(26))
      .stop();
    for (let i = 0; i < 300; i++) sim.tick();
    const clampX = (x: number) => Math.max(30, Math.min(W - 30, x));
    const clampY = (y: number) => Math.max(20, Math.min(H - 24, y));
    nodes.forEach((n: any) => {
      n.x = clampX(n.x);
      n.y = clampY(n.y);
    });
    return { nodes: nodes as any[], links: links as any[] };
  }, [data]);

  const strongest = useMemo(
    () => (data ? [...data.links].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3) : []),
    [data]
  );

  return (
    <section className="bg-[#050505] border border-white/10 p-6 rounded-2xl flex flex-col gap-4 mt-2">
      <div className="flex justify-between items-start md:items-end flex-col md:flex-row gap-4">
        <div>
          <h3 className="font-serif text-xl font-light text-[#F2F2F2] tracking-wide flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D4AF37]" /> Correlation Web
          </h3>
          <p className="text-xs text-white/50 mt-1 leading-relaxed font-light max-w-xl">
            Which stocks have moved together over the last 90 sessions, with the market's own move taken out.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["US", "IN"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMarket(m)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono tracking-wider ${
                market === m ? "border-[#D4AF37] text-[#D4AF37]" : "border-white/10 text-white/40 hover:text-white/70"
              }`}
            >
              {m === "US" ? "US" : "INDIA"}
            </button>
          ))}
          <button
            type="button"
            onClick={onOpen}
            className="ml-2 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-[10px] font-mono font-bold tracking-wider flex items-center gap-1 hover:opacity-90"
          >
            OPEN WEB <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_220px] gap-4">
        <button
          type="button"
          onClick={onOpen}
          className="h-[220px] bg-black/60 border border-white/5 rounded-xl relative overflow-hidden text-left"
          aria-label="Open the Correlation Web"
        >
          {!data && !error && <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-white/30">Computing…</span>}
          {error && <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-white/40 px-6 text-center">{error}</span>}
          {layout && (
            <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
              {layout.links.map((l, i) => (
                <line
                  key={i}
                  x1={l.source.x}
                  y1={l.source.y}
                  x2={l.target.x}
                  y2={l.target.y}
                  stroke={l.value >= 0 ? "rgba(212,175,55,0.55)" : "rgba(248,113,113,0.6)"}
                  strokeWidth={Math.max(1, Math.abs(l.value) * 4)}
                />
              ))}
              {layout.nodes.map((n) => (
                <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                  <circle r={6} fill="#050505" stroke="#D4AF37" strokeWidth={1.5} />
                  <text y={17} textAnchor="middle" fill="#F2F2F2" fillOpacity={0.6} fontSize={9} fontFamily="monospace">
                    {n.id}
                  </text>
                </g>
              ))}
            </svg>
          )}
        </button>

        <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
          <span className="font-mono text-[9px] tracking-wider text-white/45 uppercase font-bold">Strongest links</span>
          {strongest.length === 0 && <span className="text-xs text-white/35">{data ? "No link clears the threshold right now." : "–"}</span>}
          {strongest.map((l) => (
            <div key={`${idOf(l.source)}-${idOf(l.target)}`} className="flex justify-between font-mono text-xs">
              <span className="text-white/80">
                {idOf(l.source)} · {idOf(l.target)}
              </span>
              <span className={l.value >= 0 ? "text-[#D4AF37]" : "text-red-400"}>{l.value.toFixed(2)}</span>
            </div>
          ))}
          {data && data.leads.length > 0 && (
            <>
              <span className="font-mono text-[9px] tracking-wider text-white/45 uppercase font-bold mt-2">Moves first</span>
              {data.leads.slice(0, 2).map((l) => (
                <div key={`${idOf(l.source)}>${idOf(l.target)}`} className="flex items-center gap-1.5 font-mono text-xs text-white/80">
                  {idOf(l.source)} <ArrowRight className="w-3 h-3 text-[#D4AF37]" /> {idOf(l.target)}
                </div>
              ))}
            </>
          )}
          <span className="mt-auto text-[10px] text-white/30 leading-relaxed">Past co-movement, not a forecast.</span>
        </div>
      </div>
    </section>
  );
}
