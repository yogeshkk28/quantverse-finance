import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Ticker, CorrelationNode, CorrelationLink } from "../types";
import { ZoomIn, ZoomOut, Maximize2, X, Activity, Sliders, Play, Layers, RefreshCw } from "lucide-react";

interface CorrelationWebTabProps {
  tickers: Ticker[];
  onSelectTicker: (tickerId: string) => void;
  onAlertMessage?: (msg: string) => void;
}

export default function CorrelationWebTab({ tickers, onSelectTicker, onAlertMessage }: CorrelationWebTabProps) {
  const d3ContainerRef = useRef<HTMLDivElement | null>(null);

  // Filters state
  const [selectedSector, setSelectedSector] = useState<string>("All Sectors");
  const [selectedIndex, setSelectedIndex] = useState<string>("S&P 500");
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<string>("30 Days");

  // Selected node detailed view metrics
  const [clickedNode, setClickedNode] = useState<CorrelationNode | null>(null);

  // Zoom level state indicator
  const [zoomScale, setZoomLevel] = useState<number>(100);

  // D3 Selection helpers passed to click operations
  const d3ZoomRef = useRef<any>(null);
  const d3SvgRef = useRef<any>(null);

  // Fetch nodes & links matching the backend API
  const [networkData, setNetworkData] = useState<{ nodes: CorrelationNode[]; links: CorrelationLink[] }>({
    nodes: [],
    links: []
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchNetwork() {
      try {
        setLoading(true);
        const res = await fetch("/api/correlation-web");
        const data = await res.json();
        setNetworkData(data);
      } catch (err) {
        console.error("Failed to load correlation web:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchNetwork();
  }, []);

  // Compute filtered sectors list dynamically
  const uniqueSectors = useMemo(() => {
    if (!Array.isArray(tickers)) return ["All Sectors"];
    const list = new Set(tickers.map((t) => t.sector));
    return ["All Sectors", ...Array.from(list)];
  }, [tickers]);

  // Compute top correlations for the clicked node detail view
  const nodeTopCorrelations = useMemo(() => {
    if (!clickedNode) return [];
    
    // Find all links referencing clickedNode
    const connected = networkData.links.filter((l) => {
      const sourceId = typeof l.source === "object" ? l.source.id : l.source;
      const targetId = typeof l.target === "object" ? l.target.id : l.target;
      return sourceId === clickedNode.id || targetId === clickedNode.id;
    });

    // Sort connections by absolute correlation magnitude
    connected.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    
    return connected.slice(0, 3).map((l) => {
      const sourceId = typeof l.source === "object" ? l.source.id : l.source;
      const targetId = typeof l.target === "object" ? l.target.id : l.target;
      const peerId = sourceId === clickedNode.id ? targetId : sourceId;
      return {
        peerId,
        value: l.value
      };
    });
  }, [clickedNode, networkData]);

  // Draw force directed network graph in container
  useEffect(() => {
    if (loading || networkData.nodes.length === 0 || !d3ContainerRef.current) return;

    // Clear previous elements
    d3ContainerRef.current.innerHTML = "";

    const containerWidth = d3ContainerRef.current.clientWidth || 800;
    const containerHeight = d3ContainerRef.current.clientHeight || 550;

    // Create SVG Node
    const svg = d3.select(d3ContainerRef.current)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
      .attr("class", "select-none");

    d3SvgRef.current = svg;

    const g = svg.append("g");

    // Add zoom capabilities
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.15, 3.5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(Math.round(event.transform.k * 100));
      });

    d3ZoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    // Apply some initial scale
    svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(0, 0).scale(0.85));

    // Filter nodes list based on selected sector dropdown (Technology, Financials, etc.)
    const filteredNodes = networkData.nodes.filter((node) => {
      if (selectedSector === "All Sectors") return true;
      return node.sector === selectedSector;
    });

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

    // Filter links
    const filteredLinks = networkData.links.filter((link) => {
      const sId = typeof link.source === "object" ? link.source.id : link.source;
      const tId = typeof link.target === "object" ? link.target.id : link.target;
      return filteredNodeIds.has(sId) && filteredNodeIds.has(tId);
    });

    // Create D3 Force Simulation
    const simulation = d3.forceSimulation(filteredNodes)
      .force("link", d3.forceLink(filteredLinks).id((d: any) => d.id).distance(120).strength(0.45))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(containerWidth / 2, containerHeight / 2))
      .force("collide", d3.forceCollide().radius(28));

    // Lines representing correlation links (Gold representing positive, Slate Gray representing negative correlation)
    const linkSelection = g.append("g")
      .selectAll("line")
      .data(filteredLinks)
      .join("line")
      .attr("stroke", (d: any) => d.value >= 0 ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.15)") // Premium Gold vs Soft White Line
      .attr("stroke-width", (d: any) => Math.max(1.2, Math.abs(d.value) * 3.5))
      .attr("class", "transition-all duration-300");

    // Group items for nodes (Node + Ticker Tag Label)
    const nodeSelection = g.append("g")
      .selectAll("g")
      .data(filteredNodes)
      .join("g")
      .attr("class", "cursor-grab active:cursor-grabbing group")
      .call(d3.drag<SVGGElement, CorrelationNode>()
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
        })
      )
      .on("click", (event, d: any) => {
        event.stopPropagation();
        setClickedNode(d);
        onAlertMessage?.(`Selected asset node: ${d.id}`);
      });

    // Outer ring colored by sector class with high-contrast Sophisticated Dark theme values
    const getSectorColor = (sector: string) => {
      if (sector === "Technology") return "#D4AF37"; // Signature Gold
      if (sector === "Financials") return "#F5E6CA"; // Alabaster/White
      if (sector === "Healthcare") return "#9A7B31"; // Mid Gold
      if (sector === "Energy") return "#3b82f6"; // Cool blue
      if (sector === "Consumer") return "#22c55e"; // Emerald
      return "#64748b";
    };

    // Node circular base shape
    nodeSelection.append("circle")
      .attr("r", 9)
      .attr("fill", (d: any) => getSectorColor(d.sector))
      .attr("stroke", "#020202")
      .attr("stroke-width", "2")
      .attr("class", "transition-all duration-300 ease-in-out group-hover:scale-115 group-hover:brightness-110");

    // Luminous inner highlight
    nodeSelection.append("circle")
      .attr("r", 3)
      .attr("fill", "#020202")
      .attr("opacity", 0.9);

    // Dynamic tag text displaying Symbol ID directly on web
    nodeSelection.append("text")
      .attr("dx", 12)
      .attr("dy", ".35em")
      .attr("fill", "#F2F2F2")
      .attr("class", "font-mono font-bold select-none pointer-events-none")
      .attr("font-size", "10px")
      .text((d: any) => d.id);

    // Animation ticks computation update
    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeSelection
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };

  }, [loading, networkData, selectedSector]);

  // Zoom manipulation actions
  const triggerZoomIn = () => {
    if (d3SvgRef.current && d3ZoomRef.current) {
      d3SvgRef.current.transition().duration(300).call(d3ZoomRef.current.scaleBy, 1.25);
    }
  };

  const triggerZoomOut = () => {
    if (d3SvgRef.current && d3ZoomRef.current) {
      d3SvgRef.current.transition().duration(300).call(d3ZoomRef.current.scaleBy, 0.8);
    }
  };

  const triggerZoomReset = () => {
    if (d3SvgRef.current && d3ZoomRef.current) {
      d3SvgRef.current.transition().duration(500).call(d3ZoomRef.current.transform, d3.zoomIdentity.translate(0, 0).scale(0.85));
    }
  };

  return (
    <div className="flex-grow flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto px-6 py-8 gap-6 font-sans relative overflow-hidden select-none">
      
      {/* MAIN PLOTTING WEB PANES */}
      <div className="flex-1 bg-[#050505] border border-white/10 rounded-2xl relative flex flex-col overflow-hidden min-h-[450px] shadow-2xl">
        
        {/* Top Dropdowns controls matching mockup exactly */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-3 bg-black/80 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl w-auto">
          
          {/* Sector selection */}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[8px] tracking-[0.16em] text-white/45 font-bold uppercase">Sector Group</span>
            <select
              value={selectedSector}
              onChange={(e) => { setSelectedSector(e.target.value); setClickedNode(null); }}
              className="bg-black border border-white/10 rounded-lg text-xs py-1.5 px-3 text-[#F2F2F2] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 outline-none cursor-pointer"
            >
              {uniqueSectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Index Selector */}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[8px] tracking-[0.16em] text-white/45 font-bold uppercase">INDEX STANDARD</span>
            <select
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(e.target.value)}
              className="bg-black border border-white/10 rounded-lg text-xs py-1.5 px-3 text-[#F2F2F2] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 outline-none cursor-pointer"
            >
              <option>S&P 500</option>
              <option>NASDAQ 100</option>
              <option>Russell 2000</option>
            </select>
          </div>

          {/* TimePeriod select */}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[8px] tracking-[0.16em] text-white/45 font-bold uppercase">Time range</span>
            <select
              value={selectedTimePeriod}
              onChange={(e) => setSelectedTimePeriod(e.target.value)}
              className="bg-black border border-white/10 rounded-lg text-xs py-1.5 px-3 text-[#F2F2F2] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 outline-none cursor-pointer"
            >
              <option>30 Days</option>
              <option>90 Days</option>
              <option>1 Year</option>
            </select>
          </div>

          <div className="flex items-end">
            <button 
              type="button"
              className="bg-[#0d0d0d] hover:bg-white/[0.04] border border-white/10 text-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold rounded-lg hover:text-[#F2F2F2] transition-colors uppercase font-mono tracking-wider cursor-pointer duration-200"
              onClick={() => onAlertMessage?.(`Filtering correlations index: Sectors: ${selectedSector}, Index: ${selectedIndex}, Period: ${selectedTimePeriod}`)}
            >
              Filter Web
            </button>
          </div>

        </div>

        {/* Real D3 Graph canvas mounting target */}
        <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing bg-radial from-transparent to-[#020202]/90" id="d3-correlation-network-view" ref={d3ContainerRef}>
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 font-mono text-xs text-white/30 bg-black/60">
              <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
              <span>Initializing force simulation networks...</span>
            </div>
          )}
        </div>

        {/* Floating Zoom Control Tools */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col bg-black/80 border border-white/10 p-1.5 rounded-xl shadow-2xl gap-1">
          <button 
            onClick={triggerZoomIn}
            className="p-1.5 text-white/50 hover:text-[#D4AF37] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[8px] text-white/40 text-center py-0.5 block">{zoomScale}%</span>
          <button 
            onClick={triggerZoomOut}
            className="p-1.5 text-white/50 hover:text-[#D4AF37] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="h-px bg-white/5 my-0.5" />
          <button 
            onClick={triggerZoomReset}
            className="p-1.5 text-white/50 hover:text-[#D4AF37] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            title="Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Legend color scale indicators */}
        <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-sm border border-white/10 p-3 rounded-xl shadow-lg flex items-center gap-4">
          <span className="font-mono text-[8px] text-white/45 font-bold uppercase tracking-[0.16em]">CORRELATION</span>
          <div className="w-24 h-1.5 rounded-full bg-gradient-to-r from-red-500/85 via-white/15 to-[#D4AF37] relative" />
          <div className="flex justify-between w-24 absolute bottom-1 left-[105px] px-0.5 select-none pointer-events-none">
            <span className="text-[7px] font-mono font-bold text-red-400">-1.0</span>
            <span className="text-[7px] font-mono font-bold text-white/20">0.0</span>
            <span className="text-[7px] font-mono font-bold text-[#D4AF37]">1.0</span>
          </div>
        </div>

      </div>

      {/* DETAIL VIEW ON SELECT NODE - SIDE POPUP SIDEBAR */}
      <aside className={`w-full lg:w-80 flex-shrink-0 flex flex-col bg-[#050505] border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 transform ${
        clickedNode ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12 pointer-events-none lg:w-0 lg:p-0 lg:border-0 lg:opacity-0"
      }`}>
        {clickedNode && (
          <div className="flex-1 flex flex-col justify-between p-5 h-full">
            
            <div className="flex flex-col gap-4">
              
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-serif font-light text-[#F2F2F2] tracking-wide">{clickedNode.id}</h2>
                  <p className="text-[10px] text-white/40 font-medium leading-normal mt-1">{clickedNode.name}</p>
                </div>
                <button 
                  onClick={() => setClickedNode(null)}
                  className="text-white/40 hover:text-white transition-colors p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Ratios metrics block */}
              <div className="grid grid-cols-2 gap-3 font-sans">
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <span className="font-mono text-[8px] tracking-wider text-white/40 uppercase block">Sector Class</span>
                  <span className="text-white/80 text-xs font-bold block mt-1 truncate">{clickedNode.sector}</span>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <span className="font-mono text-[8px] tracking-wider text-white/40 uppercase block">Beta factor</span>
                  <span className="text-[#D4AF37] text-xs font-mono font-bold block mt-1">{clickedNode.beta}</span>
                </div>
              </div>

              {/* Highest correlations listing */}
              <div className="bg-black/30 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
                <span className="font-mono text-[9px] tracking-wider text-white/45 uppercase font-bold">Top Relationships</span>
                
                <div className="flex flex-col gap-2 font-mono text-xs">
                  {nodeTopCorrelations.length > 0 ? (
                    nodeTopCorrelations.map((rel) => {
                      const positiveVal = rel.value >= 0;
                      return (
                        <div key={rel.peerId} className="flex justify-between items-center py-2 px-3 bg-black/40 border border-white/5 rounded-lg select-none">
                          <span className="text-[#F2F2F2]/80 font-bold">{rel.peerId}</span>
                          <span className={`font-bold flex items-center gap-0.5 text-[10px] ${positiveVal ? "text-[#D4AF37]" : "text-red-400"}`}>
                            {positiveVal ? "▲" : "▼"}{Math.abs(rel.value).toFixed(2)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-white/30 text-xs font-sans">No connections found.</span>
                  )}
                </div>
              </div>

            </div>

            {/* Bottom action trigger redirects back into charts panel */}
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/5">
              <button
                onClick={() => {
                  onSelectTicker(clickedNode.id);
                  onAlertMessage?.(`Directed Terminal focus to live chart: ${clickedNode.id}`);
                }}
                className="w-full bg-gradient-to-tr from-[#D4AF37] to-[#F5E6CA] text-black py-3 rounded-xl text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-all flex items-center justify-center gap-2 select-none shadow-[0_4px_16px_rgba(212,175,55,0.2)] active:scale-95 duration-200 cursor-pointer font-sans"
              >
                <Activity className="w-4 h-4 text-black animate-pulse" /> Focus Live chart
              </button>
            </div>

          </div>
        )}
      </aside>

    </div>
  );
}
