import { useEffect, useMemo, useRef, useState } from "react";
import { INK, divergingColor } from "./palette";
import type { Structure } from "./types";

interface Props {
  data: Structure;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

type Layer = "corr" | "partial";

/**
 * Correlation (or partial-correlation) matrix, rows and columns in dendrogram
 * order so clusters show as blocks on the diagonal. Group boxes outline the
 * clusters chosen by the silhouette cut.
 */
export default function MatrixHeatmap({ data, selectedId, onSelect }: Props) {
  const [layer, setLayer] = useState<Layer>("corr");
  const [hover, setHover] = useState<{ i: number; j: number; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(420);

  const index = useMemo(() => new Map(data.ids.map((id, i) => [id, i])), [data.ids]);
  const order = data.order.map((id) => index.get(id)!);
  const n = order.length;
  const label = n <= 40 ? 64 : 0;
  const cell = Math.max(2, (size - label) / n);
  const matrix = layer === "corr" ? data.corr : data.partial;

  // Contiguous runs of the same cluster along the dendrogram order.
  const blocks = useMemo(() => {
    const out: Array<{ start: number; end: number }> = [];
    let start = 0;
    for (let k = 1; k <= n; k++) {
      if (k === n || data.clusters.labels[order[k]] !== data.clusters.labels[order[start]]) {
        out.push({ start, end: k });
        start = k;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, n]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.min(el.clientWidth, 560)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const gap = cell >= 6 ? 1 : 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = order[r];
        const j = order[c];
        ctx.fillStyle = i === j ? INK.surface2 : divergingColor(matrix[i][j]);
        ctx.fillRect(label + c * cell, label + r * cell, cell - gap, cell - gap);
      }
    }
    ctx.strokeStyle = "rgba(245,230,202,0.75)";
    ctx.lineWidth = 1.25;
    for (const b of blocks) {
      if (b.end - b.start < 2) continue;
      ctx.strokeRect(label + b.start * cell - 0.5, label + b.start * cell - 0.5, (b.end - b.start) * cell, (b.end - b.start) * cell);
    }
    if (label) {
      ctx.font = "500 9.5px JetBrains Mono, monospace";
      for (let k = 0; k < n; k++) {
        const id = data.ids[order[k]];
        ctx.fillStyle = id === selectedId ? INK.gold : INK.muted;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(id.slice(0, 9), label - 6, label + k * cell + cell / 2);
        ctx.save();
        ctx.translate(label + k * cell + cell / 2, label - 6);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "left";
        ctx.fillText(id.slice(0, 9), 0, 0);
        ctx.restore();
      }
    }
    if (hover) {
      ctx.strokeStyle = INK.gold;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(label + hover.j * cell, label + hover.i * cell, cell - 1, cell - 1);
    }
  }, [size, matrix, n, cell, label, blocks, hover, selectedId, data.ids, order]);

  const locate = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - label;
    const y = e.clientY - rect.top - label;
    const c = Math.floor(x / cell);
    const r = Math.floor(y / cell);
    if (c < 0 || r < 0 || c >= n || r >= n) return null;
    return { i: r, j: c, x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const hi = hover ? order[hover.i] : -1;
  const hj = hover ? order[hover.j] : -1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2" role="group" aria-label="Matrix layer">
          <button type="button" className="lq-chip" aria-pressed={layer === "corr"} onClick={() => setLayer("corr")}>
            Correlation
          </button>
          <button type="button" className="lq-chip" aria-pressed={layer === "partial"} onClick={() => setLayer("partial")}>
            Partial correlation
          </button>
        </div>
        <div className="flex items-center gap-2 lq-num text-[10px] text-lq-muted" aria-hidden="true">
          <span>−1</span>
          <span
            className="h-2 w-28 rounded-sm"
            style={{ background: `linear-gradient(90deg, ${divergingColor(-1)}, ${divergingColor(-0.5)}, ${divergingColor(0)}, ${divergingColor(0.5)}, ${divergingColor(1)})` }}
          />
          <span>+1</span>
        </div>
      </div>
      <div ref={wrapRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size, cursor: "crosshair" }}
          role="img"
          aria-label={`${layer === "corr" ? "Correlation" : "Partial correlation"} matrix of ${n} stocks in cluster order`}
          onMouseMove={(e) => setHover(locate(e))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const at = locate(e);
            if (at) onSelect(data.ids[order[at.i]]);
          }}
        />
        {hover && hi !== hj && (
          <div
            className="pointer-events-none absolute z-10 lq-card px-3 py-2 text-xs shadow-xl"
            style={{ left: Math.min(hover.x + 12, size - 190), top: hover.y + 12, width: 180 }}
          >
            <div className="lq-num font-semibold text-lq-text">
              {data.ids[hi]} × {data.ids[hj]}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-2 lq-num text-[11px] text-lq-text-2">
              <span className="text-lq-muted">Correlation</span>
              <span className="text-right">{data.corr[hi][hj].toFixed(2)}</span>
              <span className="text-lq-muted">Partial</span>
              <span className="text-right">{data.partial[hi][hj].toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-lq-muted leading-relaxed">
        Rows follow the clustering tree, so related stocks sit together and groups show as boxes on the diagonal. Partial correlation
        keeps only the direct tie between two stocks after every other stock is accounted for. Click a row to open that stock.
      </p>
    </div>
  );
}
