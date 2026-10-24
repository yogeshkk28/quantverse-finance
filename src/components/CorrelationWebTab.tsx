import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Ticker, CorrelationNode, CorrelationLink, CorrelationLead, EventStudy } from "../types";
import { ZoomIn, ZoomOut, Maximize2, X, Activity, RefreshCw, ArrowRight } from "lucide-react";

interface CorrelationWebTabProps {
  tickers: Ticker[];
  onSelectTicker: (tickerId: string) => void;
  onAlertMessage?: (msg: string) => void;
}

type Lens = "adjusted" | "raw" | "leadlag";

interface WebResponse {
  nodes: CorrelationNode[];
  links: CorrelationLink[];
  leads: CorrelationLead[];
  sessions?: number;
  linkThreshold?: number;
  leadThreshold?: number;
  missing?: string[];
  error?: string;
}

const LENS_NOTE: Record<Lens, string> = {
  adjusted:
    "Market-adjusted: each stock's move with its index taken out, so a line means the two companies move together for their own reasons.",
  raw: "Raw: plain correlation of daily returns. Most stocks look linked here simply because they all follow the market.",
  leadlag:
    "Lead-lag: an arrow from A to B means A's market-adjusted move today has tended to show up in B tomorrow. Only pairs that pass a strict significance test are drawn.",
};

const idOf = (end: string | CorrelationNode) => (typeof end === "object" ? end.id : end);

const getSectorColor = (sector: string) => {
  if (sector === "Technology") return "#D4AF37";
  if (sector === "Financials") return "#F5E6CA";
  if (sector === "Healthcare") return "#9A7B31";
  if (sector === "Energy") return "#3b82f6";
  if (sector === "Consumer") return "#22c55e";
  return "#64748b";
};

const signed = (v: number, digits = 2) => `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;

export default function CorrelationWebTab({ tickers, onSelectTicker, onAlertMessage }: CorrelationWebTabProps) {
  const d3ContainerRef = useRef<HTMLDivElement | null>(null);

  const [selectedSector, setSelectedSector] = useState<string>("All Sectors");
  const [selectedMarket, setSelectedMarket] = useState<"US" | "IN">("US");
  const [selectedDays, setSelectedDays] = useState<number>(90);
  const [lens, setLens] = useState<Lens>("adjusted");
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [clickedNode, setClickedNode] = useState<CorrelationNode | null>(null);
  const [zoomScale, setZoomLevel] = useState<number>(100);

  const d3ZoomRef = useRef<any>(null);
  const d3SvgRef = useRef<any>(null);

  const [networkData, setNetworkData] = useState<WebResponse>({ nodes: [], links: [], leads: [] });
  const [loading, setLoading] = useState<boolean>(true);

  // Lead-lag is always computed on market-adjusted returns, so it shares the adjusted request.
  const mode = lens === "raw" ? "raw" : "adjusted";

  useEffect(() => {
    let cancelled = false;
    async function fetchNetwork() {
      try {
        setLoading(true);
        setNetworkError(null);
        const res = await fetch(`/api/correlation-web?market=${selectedMarket}&days=${selectedDays}&mode=${mode}`);
        const data: WebResponse = await res.json();
        if (cancelled) return;
        if (!res.ok) setNetworkError(data.error || "Could not compute correlations.");
        setNetworkData({ ...data, nodes: data.nodes || [], links: data.links || [], leads: data.leads || [] });
        setClickedNode(null);
      } catch (err) {
        console.error("Failed to load correlation web:", err);
        if (!cancelled) setNetworkError("Could not reach the server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchNetwork();
    return () => {
      cancelled = true;
    };
  }, [selectedMarket, selectedDays, mode]);

  // Event study for the selected stock (two years of history, independent of the window).
  const [study, setStudy] = useState<EventStudy | null>(null);
  const [studyState, setStudyState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    if (!clickedNode) {
      setStudy(null);
      return;
    }
    let cancelled = false;
    setStudyState("loading");
    fetch(`/api/correlation-web/events?market=${selectedMarket}&symbol=${encodeURIComponent(clickedNode.id)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: EventStudy) => {
        if (cancelled) return;
        setStudy(data);
        setStudyState("idle");
      })
      .catch(() => !cancelled && setStudyState("error"));
    return () => {
      cancelled = true;
    };
  }, [clickedNode, selectedMarket]);

  const uniqueSectors = useMemo(() => {
    const list = new Set(networkData.nodes.map((n) => n.sector));
    return ["All Sectors", ...Array.from(list)];
  }, [networkData.nodes]);

  const nodeLinks = useMemo(() => {
    if (!clickedNode) return [];
    return networkData.links
      .filter((l) => idOf(l.source) === clickedNode.id || idOf(l.target) === clickedNode.id)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 5)
      .map((l) => ({
        peerId: idOf(l.source) === clickedNode.id ? idOf(l.target) : idOf(l.source),
        value: l.value,
      }));
  }, [clickedNode, networkData.links]);

  const nodeLeads = useMemo(() => {
    if (!clickedNode) return { leads: [], follows: [] };
    return {
      leads: networkData.leads.filter((l) => idOf(l.source) === clickedNode.id),
      follows: networkData.leads.filter((l) => idOf(l.target) === clickedNode.id),
    };
  }, [clickedNode, networkData.leads]);

  // Draw the force-directed network
  useEffect(() => {
    if (loading || networkData.nodes.length === 0 || !d3ContainerRef.current) return;

    d3ContainerRef.current.innerHTML = "";
    const containerWidth = d3ContainerRef.current.clientWidth || 800;
    const containerHeight = d3ContainerRef.current.clientHeight || 550;

    const svg = d3
      .select(d3ContainerRef.current)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
      .attr("class", "select-none");
    d3SvgRef.current = svg;

    svg
      .append("defs")
      .append("marker")
      .attr("id", "lead-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerUnits", "userSpaceOnUse")
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#D4AF37");

    const g = svg.append("g");
    const zoomBehavior = d3
      .zoom()
      .scaleExtent([0.15, 3.5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(Math.round(event.transform.k * 100));
      });
    d3ZoomRef.current = zoomBehavior;
    svg.call(zoomBehavior as any);
    svg.call(zoomBehavior.transform as any, d3.zoomIdentity.translate(0, 0).scale(0.85));

    // Copies, so d3's in-place mutation never leaks into React state.
    const filteredNodes: CorrelationNode[] = networkData.nodes
      .filter((node) => selectedSector === "All Sectors" || node.sector === selectedSector)
      .map((n) => ({ ...n }));
    const ids = new Set(filteredNodes.map((n) => n.id));
    const keep = (e: { source: string | CorrelationNode; target: string | CorrelationNode }) =>
      ids.has(idOf(e.source)) && ids.has(idOf(e.target));
    const edges =
      lens === "leadlag"
        ? networkData.leads.filter(keep).map((l) => ({ source: idOf(l.source), target: idOf(l.target), value: l.value }))
        : networkData.links.filter(keep).map((l) => ({ source: idOf(l.source), target: idOf(l.target), value: l.value }));

    const simulation = d3
      .forceSimulation(filteredNodes as any)
      .force("link", d3.forceLink(edges as any).id((d: any) => d.id).distance(lens === "leadlag" ? 150 : 120).strength(0.45))
      .force("charge", d3.forceManyBody().strength(-140))
      .force("center", d3.forceCenter(containerWidth / 2, containerHeight / 2))
      .force("collide", d3.forceCollide().radius(30));

    const linkSelection = g
      .append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d: any) =>
        lens === "leadlag" ? "rgba(212,175,55,0.75)" : d.value >= 0 ? "rgba(212,175,55,0.45)" : "rgba(248,113,113,0.55)"
      )
      .attr("stroke-width", (d: any) => Math.max(1.2, Math.abs(d.value) * (lens === "leadlag" ? 6 : 3.5)))
      .attr("marker-end", lens === "leadlag" ? "url(#lead-arrow)" : null);

    const nodeSelection = g
      .append("g")
      .selectAll("g")
      .data(filteredNodes)
      .join("g")
      .attr("class", "cursor-grab active:cursor-grabbing group")
      .call(
        d3
          .drag<SVGGElement, CorrelationNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      )
      .on("click", (event, d: any) => {
        event.stopPropagation();
        setClickedNode(networkData.nodes.find((n) => n.id === d.id) ?? d);
      });

    nodeSelection
      .append("circle")
      .attr("r", 9)
      .attr("fill", (d: any) => getSectorColor(d.sector))
      .attr("stroke", "#020202")
      .attr("stroke-width", "2");
    nodeSelection.append("circle").attr("r", 3).attr("fill", "#020202").attr("opacity", 0.9);
    nodeSelection
      .append("text")
      .attr("dx", 12)
      .attr("dy", ".35em")
      .attr("fill", "#F2F2F2")
      .attr("class", "font-mono font-bold select-none pointer-events-none")
      .attr("font-size", "10px")
      .text((d: any) => d.id);

    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      nodeSelection.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [loading, networkData, selectedSector, lens]);

  const triggerZoomIn = () => d3SvgRef.current?.transition().duration(300).call(d3ZoomRef.current.scaleBy, 1.25);
  const triggerZoomOut = () => d3SvgRef.current?.transition().duration(300).call(d3ZoomRef.current.scaleBy, 0.8);
  const triggerZoomReset = () =>
    d3SvgRef.current
      ?.transition()
      .duration(500)
      .call(d3ZoomRef.current.transform, d3.zoomIdentity.translate(0, 0).scale(0.85));

  const edgeCount = lens === "leadlag" ? networkData.leads.length : networkData.links.length;
  const emptyMessage =
    lens === "leadlag" && (networkData.sessions ?? 0) < 60
      ? "30 sessions is too short to test who moves first. Pick 90 days or 1 year."
      : lens === "leadlag"
      ? "No lead-lag pair passed the significance test in this window. That's the usual result for large, heavily traded stocks: news reaches them all on the same day."
      : "No pair is linked strongly enough in this window to clear the significance threshold.";

  const selectClass =
    "bg-black border border-white/10 rounded-lg text-xs py-1.5 px-3 text-[#F2F2F2] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 outline-none cursor-pointer";
  const labelClass = "font-mono text-[8px] tracking-[0.16em] text-white/45 font-bold uppercase";

  return (
    <div className="flex-grow flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto px-6 py-8 gap-6 font-sans relative overflow-hidden select-none">
      <div className="flex-1 bg-[#050505] border border-white/10 rounded-2xl relative flex flex-col overflow-hidden min-h-[560px] shadow-2xl">
        {/* Controls */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-start justify-between gap-3 pointer-events-none">
          <div className="flex flex-wrap gap-3 bg-black/80 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl pointer-events-auto">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Lens</span>
              <select value={lens} onChange={(e) => setLens(e.target.value as Lens)} className={selectClass}>
                <option value="adjusted">Market-adjusted links</option>
                <option value="raw">Raw correlation</option>
                <option value="leadlag">Lead-lag (who moves first)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Market</span>
              <select
                value={selectedMarket}
                onChange={(e) => {
                  setSelectedMarket(e.target.value as "US" | "IN");
                  setSelectedSector("All Sectors");
                }}
                className={selectClass}
              >
                <option value="US">United States</option>
                <option value="IN">India (NSE)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Time range</span>
              <select value={selectedDays} onChange={(e) => setSelectedDays(Number(e.target.value))} className={selectClass}>
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
                <option value={250}>1 Year</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Sector</span>
              <select
                value={selectedSector}
                onChange={(e) => {
                  setSelectedSector(e.target.value);
                  setClickedNode(null);
                }}
                className={selectClass}
              >
                {uniqueSectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!loading && !networkError && (
            <div className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl font-mono text-[10px] text-white/55 leading-relaxed pointer-events-auto max-w-[260px]">
              <span className="text-[#D4AF37] font-bold">{edgeCount}</span>{" "}
              {lens === "leadlag" ? "lead-lag pairs" : "links"} · {networkData.sessions ?? "–"} sessions
              <br />
              Threshold |r| ≥ {lens === "leadlag" ? networkData.leadThreshold : networkData.linkThreshold}
              {networkData.missing && networkData.missing.length > 0 && (
                <>
                  <br />
                  No history: {networkData.missing.join(", ")}
                </>
              )}
            </div>
          )}
        </div>

        {/* Graph */}
        <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing" id="d3-correlation-network-view" ref={d3ContainerRef}>
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 font-mono text-xs text-white/30 bg-black/60">
              <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
              <span>Computing return correlations...</span>
            </div>
          )}
          {!loading && networkError && (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-white/50 bg-black/60 px-6 text-center">
              {networkError}
            </div>
          )}
        </div>
        {!loading && !networkError && edgeCount === 0 && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto max-w-md text-center text-xs text-white/55 bg-black/75 border border-white/10 rounded-xl px-5 py-4 pointer-events-none">
            {emptyMessage}
          </div>
        )}

        {/* Zoom */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col bg-black/80 border border-white/10 p-1.5 rounded-xl shadow-2xl gap-1">
          <button onClick={triggerZoomIn} className="p-1.5 text-white/50 hover:text-[#D4AF37] hover:bg-white/5 rounded-lg transition-colors cursor-pointer" title="Zoom In">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[8px] text-white/40 text-center py-0.5 block">{zoomScale}%</span>
          <button onClick={triggerZoomOut} className="p-1.5 text-white/50 hover:text-[#D4AF37] hover:bg-white/5 rounded-lg transition-colors cursor-pointer" title="Zoom Out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="h-px bg-white/5 my-0.5" />
          <button onClick={triggerZoomReset} className="p-1.5 text-white/50 hover:text-[#D4AF37] hover:bg-white/5 rounded-lg transition-colors cursor-pointer" title="Fit to Screen">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Legend + lens explanation */}
        <div className="absolute bottom-4 left-4 right-24 z-10 bg-black/80 backdrop-blur-sm border border-white/10 p-3 rounded-xl shadow-lg flex flex-col gap-2 max-w-xl">
          {lens === "leadlag" ? (
            <div className="flex items-center gap-2 font-mono text-[9px] text-white/60">
              <span className="font-bold text-white/80">A</span>
              <span className="w-10 h-0.5 bg-[#D4AF37] relative after:content-[''] after:absolute after:-right-1 after:-top-[3px] after:border-y-4 after:border-y-transparent after:border-l-[6px] after:border-l-[#D4AF37]" />
              <span className="font-bold text-white/80">B</span>
              <span>A moves today, B tends to follow tomorrow</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 font-mono text-[9px] text-white/60">
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 bg-[#D4AF37]" /> Move together
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 bg-red-400" /> Move opposite
              </span>
              <span>Thicker = stronger</span>
            </div>
          )}
          <p className="text-[10px] text-white/45 leading-relaxed">{LENS_NOTE[lens]}</p>
        </div>
      </div>

      {/* Detail panel */}
      {clickedNode && (
        <aside className="w-full lg:w-[22rem] flex-shrink-0 flex flex-col bg-[#050505] border border-white/10 rounded-2xl overflow-y-auto lg:max-h-[calc(100vh-160px)] shadow-2xl">
          <div className="flex flex-col gap-4 p-5">
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-serif font-light text-[#F2F2F2] tracking-wide">{clickedNode.id}</h2>
                <p className="text-[10px] text-white/40 font-medium leading-normal mt-1">{clickedNode.name}</p>
              </div>
              <button onClick={() => setClickedNode(null)} className="text-white/40 hover:text-white transition-colors p-1 cursor-pointer" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <span className="font-mono text-[8px] tracking-wider text-white/40 uppercase block">Sector</span>
                <span className="text-white/80 text-xs font-bold block mt-1 truncate">{clickedNode.sector}</span>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <span className="font-mono text-[8px] tracking-wider text-white/40 uppercase block">Beta to index</span>
                <span className="text-[#D4AF37] text-xs font-mono font-bold block mt-1">{clickedNode.beta}</span>
              </div>
            </div>

            {/* Links */}
            <section className="bg-black/30 p-4 rounded-xl border border-white/5 flex flex-col gap-2">
              <span className="font-mono text-[9px] tracking-wider text-white/45 uppercase font-bold">
                Strongest links · {mode === "raw" ? "raw" : "market-adjusted"}
              </span>
              {nodeLinks.length > 0 ? (
                nodeLinks.map((rel) => (
                  <div key={rel.peerId} className="flex justify-between items-center py-1.5 px-3 bg-black/40 border border-white/5 rounded-lg font-mono text-xs">
                    <span className="text-[#F2F2F2]/80 font-bold">{rel.peerId}</span>
                    <span className={`font-bold text-[10px] ${rel.value >= 0 ? "text-[#D4AF37]" : "text-red-400"}`}>{signed(rel.value)}</span>
                  </div>
                ))
              ) : (
                <span className="text-white/35 text-xs">No link clears the threshold in this window.</span>
              )}
            </section>

            {/* Lead-lag */}
            <section className="bg-black/30 p-4 rounded-xl border border-white/5 flex flex-col gap-2">
              <span className="font-mono text-[9px] tracking-wider text-white/45 uppercase font-bold">Who moves first</span>
              {nodeLeads.leads.length === 0 && nodeLeads.follows.length === 0 ? (
                <span className="text-white/35 text-xs">No significant lead-lag pair involving {clickedNode.id} in this window.</span>
              ) : (
                <>
                  {nodeLeads.leads.map((l) => (
                    <div key={`l-${idOf(l.target)}`} className="flex items-center justify-between text-xs font-mono py-1">
                      <span className="flex items-center gap-1.5 text-white/80">
                        {clickedNode.id} <ArrowRight className="w-3 h-3 text-[#D4AF37]" /> <b>{idOf(l.target)}</b>
                      </span>
                      <span className="text-[#D4AF37] text-[10px]">r {signed(l.value)}</span>
                    </div>
                  ))}
                  {nodeLeads.follows.map((l) => (
                    <div key={`f-${idOf(l.source)}`} className="flex items-center justify-between text-xs font-mono py-1">
                      <span className="flex items-center gap-1.5 text-white/80">
                        <b>{idOf(l.source)}</b> <ArrowRight className="w-3 h-3 text-[#D4AF37]" /> {clickedNode.id}
                      </span>
                      <span className="text-[#D4AF37] text-[10px]">r {signed(l.value)}</span>
                    </div>
                  ))}
                  <span className="text-[10px] text-white/35">Today's move in the first stock, tomorrow's in the second.</span>
                </>
              )}
            </section>

            {/* Event study */}
            <section className="bg-black/30 p-4 rounded-xl border border-white/5 flex flex-col gap-2">
              <span className="font-mono text-[9px] tracking-wider text-white/45 uppercase font-bold">After {clickedNode.id}'s biggest moves</span>
              {studyState === "loading" && <span className="text-white/35 text-xs">Running the event study…</span>}
              {studyState === "error" && <span className="text-white/35 text-xs">Couldn't run the event study.</span>}
              {studyState === "idle" && study && study.events.length === 0 && (
                <span className="text-white/35 text-xs">Not enough history for an event study.</span>
              )}
              {studyState === "idle" && study && study.events.length > 0 && (
                <>
                  <p className="text-[10px] text-white/45 leading-relaxed">
                    The {study.events.length} largest market-adjusted moves in two years (each at least {study.threshold}%). Peer
                    moves are signed so <b className="text-white/70">+</b> means the same direction as {clickedNode.id}.
                  </p>
                  {study.self && (
                    <div className="text-[11px] text-white/70 bg-black/40 border border-white/5 rounded-lg px-3 py-2">
                      {clickedNode.id} itself, next 5 days:{" "}
                      <b className={study.self.next5 >= 0 ? "text-[#D4AF37]" : "text-red-400"}>{signed(study.self.next5)}%</b>{" "}
                      (
                      {study.self.significant
                        ? study.self.next5 >= 0
                          ? "tends to keep going"
                          : "tends to give some back"
                        : "no reliable follow-through"}
                      )
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 font-mono text-[10px] items-center">
                    <span className="text-white/35">Peer</span>
                    <span className="text-white/35 text-right">Same day</span>
                    <span className="text-white/35 text-right">Next 5d</span>
                    {study.peers.slice(0, 8).map((p) => (
                      <React.Fragment key={p.id}>
                        <span className="text-white/80 font-bold flex items-center gap-1.5">
                          {p.id}
                          {p.significant && (
                            <span className="text-[8px] px-1 py-px rounded bg-[#D4AF37]/15 text-[#D4AF37] font-bold" title={`p = ${p.p}`}>
                              SIG
                            </span>
                          )}
                        </span>
                        <span className={`text-right ${p.sameDay >= 0 ? "text-white/60" : "text-red-400/80"}`}>{signed(p.sameDay)}%</span>
                        <span className={`text-right font-bold ${p.next5 >= 0 ? "text-[#D4AF37]" : "text-red-400"}`}>{signed(p.next5)}%</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <span className="text-[10px] text-white/35 leading-relaxed">
                    SIG = passes a t-test corrected for testing every peer at once. Without it, treat the number as noise.
                  </span>
                </>
              )}
            </section>

            <button
              onClick={() => {
                onSelectTicker(clickedNode.id);
                onAlertMessage?.(`Opened chart: ${clickedNode.id}`);
              }}
              className="w-full bg-gradient-to-tr from-[#D4AF37] to-[#F5E6CA] text-black py-3 rounded-xl text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Activity className="w-4 h-4 text-black" /> Open chart
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
