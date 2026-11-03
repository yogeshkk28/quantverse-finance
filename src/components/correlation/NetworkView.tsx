import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { INK, NEG, groupColor, shapePath } from "./palette";
import type { NetworkKind, WebNode } from "./types";

export interface DrawEdge {
  source: string;
  target: string;
  value: number;
  /** 0–1. Drives opacity on MST edges. */
  reliability?: number;
  distance?: number;
}

interface Props {
  nodes: WebNode[];
  edges: DrawEdge[];
  kind: NetworkKind;
  groupOf: (n: WebNode) => number;
  selectedId: string | null;
  focusGroup: number | null;
  onSelect: (id: string | null) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  node: WebNode;
}

const radiusOf = (n: WebNode) => 7 + n.hub * 9;

export default function NetworkView({ nodes, edges, kind, groupOf, selectedId, focusGroup, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const paintRef = useRef<(hover: string | null) => void>(() => {});
  const [zoom, setZoom] = useState(100);
  const selectedRef = useRef<string | null>(selectedId);
  const focusRef = useRef<number | null>(focusGroup);
  const groupRef = useRef(groupOf);
  groupRef.current = groupOf;
  const recolorRef = useRef<() => void>(() => {});
  const [tip, setTip] = useState<{ x: number; y: number; node: WebNode } | null>(null);

  // Build the layout whenever the data or the network type changes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || nodes.length === 0) return;
    host.querySelector("svg.cw-net")?.remove();
    const width = host.clientWidth || 800;
    const height = host.clientHeight || 560;

    const svg = d3
      .select(host)
      .insert("svg", ":first-child")
      .attr("class", "cw-net")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", `Correlation network of ${nodes.length} stocks`)
      .style("display", "block");
    svgRef.current = svg;

    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "cw-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L10,0L0,4")
      .attr("fill", INK.goldSoft);

    const g = svg.append("g");
    const z = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoom(Math.round(event.transform.k * 100));
      });
    zoomRef.current = z;
    svg.call(z);
    svg.on("click", () => onSelect(null));

    const simNodes: SimNode[] = nodes.map((n) => ({ id: n.id, node: n }));
    const byId = new Map(simNodes.map((n) => [n.id, n]));
    const simEdges = edges
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => ({ ...e, source: byId.get(e.source)!, target: byId.get(e.target)! }));

    const tree = kind === "mst";
    const sim = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, any>(simEdges)
          .id((d) => d.id)
          .distance((e: any) => (kind === "leads" ? 150 : 30 + (e.distance ?? Math.sqrt(2 * (1 - e.value))) * (tree ? 70 : 110)))
          .strength(tree ? 0.9 : kind === "tmfg" ? 0.35 : 0.5)
      )
      .force("charge", d3.forceManyBody().strength(tree ? -260 : -180))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.06))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => radiusOf(d.node) + 14));

    const directed = kind === "leads";
    const link = g
      .append("g")
      .attr("fill", "none")
      .selectAll<SVGLineElement, any>("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", (d) => (d.value >= 0 ? INK.goldSoft : NEG))
      .attr("stroke-dasharray", (d) => (d.value < 0 ? "4 3" : null))
      .attr("stroke-linecap", "round")
      .attr("stroke-width", (d) => (directed ? 1.5 + Math.abs(d.value) * 6 : 1 + Math.abs(d.value) * 3.2))
      .attr("marker-end", directed ? "url(#cw-arrow)" : null);

    const baseOpacity = (d: any) =>
      d.reliability !== undefined ? 0.15 + 0.75 * d.reliability : directed ? 0.75 : 0.18 + 0.6 * Math.min(1, Math.abs(d.value));

    const node = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => `${d.id}, ${d.node.name}`)
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelect(d.id);
      })
      .on("keydown", (event: KeyboardEvent, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(d.id);
        }
      })
      .on("mouseenter", (event, d) => {
        paintRef.current(d.id);
        const rect = host.getBoundingClientRect();
        setTip({ x: event.clientX - rect.left, y: event.clientY - rect.top, node: d.node });
      })
      .on("mousemove", (event) => {
        const rect = host.getBoundingClientRect();
        setTip((t) => (t ? { ...t, x: event.clientX - rect.left, y: event.clientY - rect.top } : t));
      })
      .on("mouseleave", () => {
        paintRef.current(null);
        setTip(null);
      });

    // Hit target larger than the mark.
    node.append("circle").attr("r", (d) => radiusOf(d.node) + 8).attr("fill", "transparent");
    node
      .append("circle")
      .attr("class", "cw-halo")
      .attr("r", (d) => radiusOf(d.node) + 5)
      .attr("fill", "none")
      .attr("stroke", INK.gold)
      .attr("stroke-width", 1.5)
      .attr("opacity", 0);
    node
      .append("path")
      .attr("class", "cw-mark")
      .attr("d", (d) => shapePath(groupRef.current(d.node), Math.PI * radiusOf(d.node) ** 2))
      .attr("fill", (d) => groupColor(groupRef.current(d.node)))
      .attr("stroke", INK.surface)
      .attr("stroke-width", 2);
    node
      .append("text")
      .attr("x", (d) => radiusOf(d.node) + 5)
      .attr("dy", "0.35em")
      .attr("fill", INK.text2)
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-size", 10.5)
      .attr("font-weight", 500)
      .attr("paint-order", "stroke")
      .attr("stroke", INK.surface)
      .attr("stroke-width", 3)
      .style("pointer-events", "none")
      .text((d) => d.id);

    const neighbors = new Map<string, Set<string>>();
    for (const e of simEdges) {
      const s = (e.source as SimNode).id;
      const t = (e.target as SimNode).id;
      if (!neighbors.has(s)) neighbors.set(s, new Set());
      if (!neighbors.has(t)) neighbors.set(t, new Set());
      neighbors.get(s)!.add(t);
      neighbors.get(t)!.add(s);
    }

    paintRef.current = (hover) => {
      const anchor = hover ?? selectedRef.current;
      const group = focusRef.current;
      const near = anchor ? neighbors.get(anchor) ?? new Set<string>() : null;
      node.attr("opacity", (d) => {
        if (near) return d.id === anchor || near.has(d.id) ? 1 : 0.18;
        if (group !== null) return groupRef.current(d.node) === group ? 1 : 0.18;
        return 1;
      });
      node.select(".cw-halo").attr("opacity", (d) => (d.id === selectedRef.current ? 1 : 0));
      link.attr("opacity", (d: any) => {
        if (near) return d.source.id === anchor || d.target.id === anchor ? Math.max(0.85, baseOpacity(d)) : 0.05;
        const gof = groupRef.current;
        if (group !== null) return gof(d.source.node) === group && gof(d.target.node) === group ? baseOpacity(d) : 0.05;
        return baseOpacity(d);
      });
    };
    paintRef.current(null);
    recolorRef.current = () => {
      node
        .select<SVGPathElement>(".cw-mark")
        .attr("d", (d) => shapePath(groupRef.current(d.node), Math.PI * radiusOf(d.node) ** 2))
        .attr("fill", (d) => groupColor(groupRef.current(d.node)));
      paintRef.current(null);
    };

    sim.on("tick", () => {
      // Keep every node (and its label) inside the panel, so narrow screens don't lose stocks off the edge.
      for (const d of simNodes) {
        const r = radiusOf(d.node);
        d.x = Math.max(r + 6, Math.min(width - r - 62, d.x ?? 0));
        d.y = Math.max(r + 6, Math.min(height - r - 6, d.y ?? 0));
      }
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => {
          if (!directed) return d.target.x;
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const len = Math.hypot(dx, dy) || 1;
          return d.target.x - (dx / len) * (radiusOf(d.target.node) + 4);
        })
        .attr("y2", (d: any) => {
          if (!directed) return d.target.y;
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const len = Math.hypot(dx, dy) || 1;
          return d.target.y - (dy / len) * (radiusOf(d.target.node) + 4);
        });
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
      svg.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, kind]);

  useEffect(() => recolorRef.current(), [groupOf]);

  // Selection and cluster focus repaint without re-running the layout.
  useEffect(() => {
    selectedRef.current = selectedId;
    focusRef.current = focusGroup;
    paintRef.current(null);
  }, [selectedId, focusGroup]);

  const zoomBy = (k: number) => svgRef.current && zoomRef.current && svgRef.current.transition().duration(250).call(zoomRef.current.scaleBy, k);
  const reset = () =>
    svgRef.current && zoomRef.current && svgRef.current.transition().duration(400).call(zoomRef.current.transform, d3.zoomIdentity);

  return (
    <div ref={hostRef} className="absolute inset-0">
      {tip && (
        <div
          className="pointer-events-none absolute z-20 lq-card px-3 py-2 text-xs shadow-xl"
          style={{ left: Math.min(tip.x + 14, (hostRef.current?.clientWidth ?? 600) - 220), top: tip.y + 14, width: 200 }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="lq-num font-semibold text-lq-text">{tip.node.id}</span>
            <span className="lq-lbl">{tip.node.sector}</span>
          </div>
          <div className="text-lq-muted truncate mt-0.5">{tip.node.name}</div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 lq-num text-[11px] text-lq-text-2">
            <span className="text-lq-muted">Hub score</span>
            <span className="text-right">{Math.round(tip.node.hub * 100)}</span>
            <span className="text-lq-muted">Links</span>
            <span className="text-right">{tip.node.degree}</span>
            <span className="text-lq-muted">Beta</span>
            <span className="text-right">{tip.node.beta.toFixed(2)}</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center gap-1 lq-card p-1.5">
        <button type="button" onClick={() => zoomBy(1.25)} className="p-2 text-lq-muted hover:text-lq-gold" aria-label="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="lq-num text-[10px] text-lq-muted">{zoom}%</span>
        <button type="button" onClick={() => zoomBy(0.8)} className="p-2 text-lq-muted hover:text-lq-gold" aria-label="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button type="button" onClick={reset} className="p-2 text-lq-muted hover:text-lq-gold" aria-label="Reset view">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
