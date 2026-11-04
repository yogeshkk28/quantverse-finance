/**
 * Drawing tools for the chart: trend lines, rays, horizontal/vertical lines, rectangles,
 * channels, Fibonacci retracements, a measure tool, long/short position boxes, text and a brush.
 *
 * Points are stored as (time, price), so a line drawn on the 5-minute chart stays at the
 * same place on the hourly or daily chart. Rendering happens inside the chart's own
 * repaint (a series primitive), so drawings never lag when panning, zooming or rescaling.
 */
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  Logical,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";

export type ToolId =
  | "cursor"
  | "trend"
  | "ray"
  | "extended"
  | "hline"
  | "hray"
  | "vline"
  | "rect"
  | "channel"
  | "fib"
  | "measure"
  | "long"
  | "short"
  | "text"
  | "brush";

export interface Pt {
  t: number;
  p: number;
}

export interface Drawing {
  id: string;
  type: Exclude<ToolId, "cursor">;
  pts: Pt[];
  color: string;
  text?: string;
}

/** How many clicks each tool needs (brush is freehand). */
export const POINTS: Record<Drawing["type"], number> = {
  trend: 2, ray: 2, extended: 2, hline: 1, hray: 1, vline: 1, rect: 2, channel: 3, fib: 2, measure: 2, long: 2, short: 2, text: 1, brush: 0,
};

export const DEFAULT_COLOR: Record<Drawing["type"], string> = {
  trend: "#5ab0ff", ray: "#5ab0ff", extended: "#5ab0ff", hline: "#d4af37", hray: "#d4af37", vline: "#9aa3b8",
  rect: "#d27cff", channel: "#2ed3c6", fib: "#e8d8a8", measure: "#5ab0ff", long: "#4ade80", short: "#f87171",
  text: "#f3efe6", brush: "#ffb547",
};

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618];
const FIB_COLORS = ["#9aa3b8", "#f87171", "#ffb547", "#4ade80", "#2ed3c6", "#5ab0ff", "#9aa3b8", "#d27cff"];

// -------------------------------------------------------------------------
// Time <-> logical index, with extrapolation past either end of the data
// -------------------------------------------------------------------------

export class TimeIndex {
  constructor(public times: number[], public step: number) {}

  toLogical(t: number): number {
    const a = this.times;
    const n = a.length;
    if (n === 0) return 0;
    if (t <= a[0]) return (t - a[0]) / this.step;
    if (t >= a[n - 1]) return n - 1 + (t - a[n - 1]) / this.step;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (a[mid] <= t) lo = mid;
      else hi = mid;
    }
    return lo + (t - a[lo]) / (a[hi] - a[lo]);
  }

  toTime(l: number): number {
    const a = this.times;
    const n = a.length;
    if (n === 0) return 0;
    if (l <= 0) return a[0] + l * this.step;
    if (l >= n - 1) return a[n - 1] + (l - (n - 1)) * this.step;
    const i = Math.floor(l);
    return a[i] + (l - i) * (a[i + 1] - a[i]);
  }
}

// -------------------------------------------------------------------------
// Primitive: renders every drawing inside the main pane
// -------------------------------------------------------------------------

interface XY {
  x: number;
  y: number;
}

export interface DrawingContext {
  drawings: Drawing[];
  selectedId: string | null;
  draft: Drawing | null;
  hidden: boolean;
  index: TimeIndex;
  priceFormat: (p: number) => string;
  bars: Array<{ time: number; high: number; low: number }>;
}

export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  ctx: DrawingContext;

  constructor(ctx: DrawingContext) {
    this.ctx = ctx;
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.series = p.series;
    this.requestUpdate = p.requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  update(ctx: Partial<DrawingContext>) {
    Object.assign(this.ctx, ctx);
    this.requestUpdate?.();
  }

  toXY(pt: Pt): XY | null {
    if (!this.chart || !this.series) return null;
    const x = this.chart.timeScale().logicalToCoordinate(this.ctx.index.toLogical(pt.t) as Logical);
    const y = this.series.priceToCoordinate(pt.p);
    if (x === null || y === null) return null;
    return { x, y };
  }

  fromXY(x: number, y: number): Pt | null {
    if (!this.chart || !this.series) return null;
    const l = this.chart.timeScale().coordinateToLogical(x);
    const p = this.series.coordinateToPrice(y);
    if (l === null || p === null) return null;
    return { t: this.ctx.index.toTime(l), p };
  }

  private all(): Drawing[] {
    return this.ctx.draft ? [...this.ctx.drawings, this.ctx.draft] : this.ctx.drawings;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    const self = this;
    const renderer: IPrimitivePaneRenderer = {
      draw(target) {
        if (self.ctx.hidden) return;
        target.useMediaCoordinateSpace(({ context: c, mediaSize }) => {
          for (const d of self.all()) {
            const pts = d.pts.map((p) => self.toXY(p));
            if (pts.some((p) => p === null)) continue;
            renderDrawing(c, d, pts as XY[], mediaSize.width, mediaSize.height, self.ctx, d.id === self.ctx.selectedId || d === self.ctx.draft);
          }
        });
      },
    };
    return [{ renderer: () => renderer, zOrder: () => "top" }];
  }

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    if (this.ctx.hidden || !this.series) return [];
    const views: ISeriesPrimitiveAxisView[] = [];
    for (const d of this.all()) {
      const show = d.type === "hline" || d.type === "hray" || d.id === this.ctx.selectedId || d === this.ctx.draft;
      if (!show || d.type === "brush" || d.type === "vline") continue;
      for (const pt of d.pts) {
        const y = this.series.priceToCoordinate(pt.p);
        if (y === null) continue;
        views.push({
          coordinate: () => y,
          text: () => this.ctx.priceFormat(pt.p),
          textColor: () => "#07080c",
          backColor: () => d.color,
          visible: () => true,
          tickVisible: () => true,
        } as ISeriesPrimitiveAxisView);
      }
    }
    return views;
  }

  /** Index of the drawing under (x, y) and which handle, if any. */
  findAt(x: number, y: number): { drawing: Drawing; handle: number | null } | null {
    if (this.ctx.hidden) return null;
    const list = this.ctx.drawings;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      const pts = d.pts.map((p) => this.toXY(p));
      if (pts.some((p) => p === null)) continue;
      const xy = pts as XY[];
      if (d.type !== "brush") {
        const h = handlePoints(d, xy).findIndex((p) => Math.hypot(p.x - x, p.y - y) <= 7);
        if (h >= 0) return { drawing: d, handle: h };
      }
      if (hitBody(d, xy, x, y, this.chart?.timeScale().width() ?? 4000)) return { drawing: d, handle: null };
    }
    return null;
  }
}

// -------------------------------------------------------------------------
// Geometry
// -------------------------------------------------------------------------

function distToSegment(px: number, py: number, a: XY, b: XY): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** Extend segment a→b to the pane edges: forward only (ray) or both ways. */
function extend(a: XY, b: XY, w: number, both: boolean): [XY, XY] {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return [a, b];
  const far = (from: XY, sx: number, sy: number) => {
    const k = 4 * (w + 2000) / Math.max(Math.abs(sx), Math.abs(sy), 1e-6);
    return { x: from.x + sx * k, y: from.y + sy * k };
  };
  return [both ? far(a, -dx, -dy) : a, far(b, dx, dy)];
}

/** Position tools: entry, target, and a stop mirrored 1:1 unless dragged (3rd point). */
function positionPoints(d: Drawing, pts: XY[]): { entry: XY; target: XY; stop: XY; x2: number } {
  const [entry, target] = pts;
  const stop = pts[2] ?? { x: target.x, y: entry.y - (target.y - entry.y) };
  return { entry, target, stop, x2: target.x };
}

export function handlePoints(d: Drawing, pts: XY[]): XY[] {
  if (d.type === "long" || d.type === "short") {
    const p = positionPoints(d, pts);
    return [p.entry, p.target, { x: p.x2, y: p.stop.y }];
  }
  return pts;
}

function hitBody(d: Drawing, p: XY[], x: number, y: number, w: number): boolean {
  const T = 6;
  switch (d.type) {
    case "trend":
    case "measure":
      return d.type === "trend" ? distToSegment(x, y, p[0], p[1]) <= T : inRect(x, y, p[0], p[1]);
    case "ray":
    case "extended": {
      const [a, b] = extend(p[0], p[1], w, d.type === "extended");
      return distToSegment(x, y, a, b) <= T;
    }
    case "hline":
      return Math.abs(y - p[0].y) <= T;
    case "hray":
      return Math.abs(y - p[0].y) <= T && x >= p[0].x - T;
    case "vline":
      return Math.abs(x - p[0].x) <= T;
    case "rect":
      return inRect(x, y, p[0], p[1]);
    case "channel": {
      if (p.length < 3) return distToSegment(x, y, p[0], p[1]) <= T;
      const off = channelOffset(p);
      return distToSegment(x, y, p[0], p[1]) <= T || distToSegment(x, y, { x: p[0].x, y: p[0].y + off }, { x: p[1].x, y: p[1].y + off }) <= T || inQuad(x, y, p, off);
    }
    case "fib":
      return x >= Math.min(p[0].x, p[1].x) - T && x <= Math.max(p[0].x, p[1].x) + T && y >= Math.min(p[0].y, p[1].y) - T && y <= Math.max(p[0].y, p[1].y) + T;
    case "long":
    case "short": {
      const q = positionPoints(d, p);
      return inRect(x, y, { x: q.entry.x, y: q.target.y }, { x: q.x2, y: q.stop.y });
    }
    case "text":
      return Math.abs(x - p[0].x - 40) <= 50 && Math.abs(y - p[0].y + 8) <= 12;
    case "brush":
      return p.some((q, i) => i > 0 && distToSegment(x, y, p[i - 1], q) <= T);
  }
}

function inRect(x: number, y: number, a: XY, b: XY) {
  return x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x) && y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y);
}

function channelOffset(p: XY[]): number {
  // Vertical distance from the base line to the third point.
  const [a, b, c] = p;
  const t = b.x === a.x ? 0 : (c.x - a.x) / (b.x - a.x);
  return c.y - (a.y + t * (b.y - a.y));
}

function inQuad(x: number, y: number, p: XY[], off: number) {
  const [a, b] = p;
  if (x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x)) return false;
  const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
  const y0 = a.y + t * (b.y - a.y);
  return y >= Math.min(y0, y0 + off) && y <= Math.max(y0, y0 + off);
}

// -------------------------------------------------------------------------
// Rendering
// -------------------------------------------------------------------------

function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, align: CanvasTextAlign = "left", bg?: string) {
  c.font = "500 11px 'JetBrains Mono', ui-monospace, monospace";
  c.textAlign = align;
  c.textBaseline = "middle";
  if (bg) {
    const w = c.measureText(text).width + 10;
    const left = align === "left" ? x - 5 : align === "right" ? x - w + 5 : x - w / 2;
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(left, y - 9, w, 18, 4);
    c.fill();
  }
  c.fillStyle = color;
  c.fillText(text, x, y);
}

function line(c: CanvasRenderingContext2D, a: XY, b: XY) {
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}

function handle(c: CanvasRenderingContext2D, p: XY, color: string) {
  c.save();
  c.setLineDash([]);
  c.fillStyle = "#07080c";
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function renderDrawing(c: CanvasRenderingContext2D, d: Drawing, p: XY[], w: number, h: number, ctx: DrawingContext, selected: boolean) {
  c.save();
  c.strokeStyle = d.color;
  c.fillStyle = d.color;
  c.lineWidth = selected ? 2 : 1.5;
  c.lineCap = "round";
  const fmt = ctx.priceFormat;

  switch (d.type) {
    case "trend":
      line(c, p[0], p[1]);
      break;
    case "ray":
    case "extended": {
      const [a, b] = extend(p[0], p[1], w, d.type === "extended");
      line(c, a, b);
      break;
    }
    case "hline":
      line(c, { x: 0, y: p[0].y }, { x: w, y: p[0].y });
      break;
    case "hray":
      line(c, p[0], { x: w, y: p[0].y });
      break;
    case "vline":
      line(c, { x: p[0].x, y: 0 }, { x: p[0].x, y: h });
      break;
    case "rect": {
      const x = Math.min(p[0].x, p[1].x), y = Math.min(p[0].y, p[1].y);
      c.fillStyle = alpha(d.color, 0.12);
      c.fillRect(x, y, Math.abs(p[1].x - p[0].x), Math.abs(p[1].y - p[0].y));
      c.strokeRect(x, y, Math.abs(p[1].x - p[0].x), Math.abs(p[1].y - p[0].y));
      break;
    }
    case "channel": {
      line(c, p[0], p[1]);
      if (p.length >= 3) {
        const off = channelOffset(p);
        const a2 = { x: p[0].x, y: p[0].y + off }, b2 = { x: p[1].x, y: p[1].y + off };
        line(c, a2, b2);
        c.fillStyle = alpha(d.color, 0.08);
        c.beginPath();
        c.moveTo(p[0].x, p[0].y);
        c.lineTo(p[1].x, p[1].y);
        c.lineTo(b2.x, b2.y);
        c.lineTo(a2.x, a2.y);
        c.closePath();
        c.fill();
        c.save();
        c.setLineDash([4, 4]);
        c.globalAlpha = 0.6;
        line(c, { x: p[0].x, y: p[0].y + off / 2 }, { x: p[1].x, y: p[1].y + off / 2 });
        c.restore();
      }
      break;
    }
    case "fib": {
      const [a, b] = d.pts;
      const x1 = Math.min(p[0].x, p[1].x), x2 = Math.max(p[0].x, p[1].x);
      c.save();
      c.setLineDash([3, 3]);
      c.globalAlpha = 0.5;
      line(c, p[0], p[1]);
      c.restore();
      let prevY: number | null = null;
      FIB_LEVELS.forEach((lvl, i) => {
        const price = b.p + (a.p - b.p) * lvl;
        const y = p[1].y + (p[0].y - p[1].y) * lvl;
        const col = FIB_COLORS[i];
        if (prevY !== null) {
          c.fillStyle = alpha(col, 0.07);
          c.fillRect(x1, Math.min(prevY, y), x2 - x1, Math.abs(y - prevY));
        }
        c.strokeStyle = col;
        c.lineWidth = 1;
        line(c, { x: x1, y }, { x: x2, y });
        label(c, `${lvl} (${fmt(price)})`, x1 - 6, y, col, "right");
        prevY = y;
      });
      break;
    }
    case "measure": {
      const [a, b] = d.pts;
      const up = b.p >= a.p;
      const col = up ? "#4ade80" : "#f87171";
      const x = Math.min(p[0].x, p[1].x), y = Math.min(p[0].y, p[1].y);
      c.fillStyle = alpha(col, 0.14);
      c.fillRect(x, y, Math.abs(p[1].x - p[0].x), Math.abs(p[1].y - p[0].y));
      c.strokeStyle = col;
      c.lineWidth = 1;
      const midX = (p[0].x + p[1].x) / 2, midY = (p[0].y + p[1].y) / 2;
      line(c, { x: midX, y: p[0].y }, { x: midX, y: p[1].y });
      line(c, { x: p[0].x, y: midY }, { x: p[1].x, y: midY });
      const bars = Math.round(ctx.index.toLogical(b.t) - ctx.index.toLogical(a.t));
      const diff = b.p - a.p;
      const text = `${diff >= 0 ? "+" : ""}${fmt(diff)} (${((diff / a.p) * 100).toFixed(2)}%) · ${bars} bars`;
      label(c, text, midX, up ? y - 14 : y + Math.abs(p[1].y - p[0].y) + 14, "#07080c", "center", col);
      break;
    }
    case "long":
    case "short": {
      const q = positionPoints(d, p);
      const [entryPt, targetPt] = d.pts;
      const stopPrice = d.pts[2]?.p ?? entryPt.p - (targetPt.p - entryPt.p);
      const x1 = Math.min(q.entry.x, q.x2), x2 = Math.max(q.entry.x, q.x2);
      const wdt = Math.max(x2 - x1, 2);
      c.fillStyle = "rgba(74,222,128,0.16)";
      c.fillRect(x1, Math.min(q.entry.y, q.target.y), wdt, Math.abs(q.target.y - q.entry.y));
      c.fillStyle = "rgba(248,113,113,0.16)";
      c.fillRect(x1, Math.min(q.entry.y, q.stop.y), wdt, Math.abs(q.stop.y - q.entry.y));
      c.strokeStyle = "#c9cbd6";
      c.lineWidth = 1;
      line(c, { x: x1, y: q.entry.y }, { x: x2, y: q.entry.y });
      const reward = Math.abs(targetPt.p - entryPt.p), risk = Math.abs(stopPrice - entryPt.p);
      const rr = risk ? (reward / risk).toFixed(2) : "∞";
      const pct = (v: number) => `${((Math.abs(v - entryPt.p) / entryPt.p) * 100).toFixed(2)}%`;
      label(c, `Target ${fmt(targetPt.p)} · ${pct(targetPt.p)}`, x1 + wdt / 2, q.target.y + (q.target.y < q.entry.y ? -12 : 12), "#07080c", "center", "#4ade80");
      label(c, `Stop ${fmt(stopPrice)} · ${pct(stopPrice)}`, x1 + wdt / 2, q.stop.y + (q.stop.y < q.entry.y ? -12 : 12), "#07080c", "center", "#f87171");
      label(c, `${d.type === "long" ? "Long" : "Short"} ${fmt(entryPt.p)} · R:R ${rr}`, x1 + wdt / 2, q.entry.y, "#f3efe6", "center", "rgba(16,18,26,0.92)");
      break;
    }
    case "text":
      c.font = "500 13px Inter, ui-sans-serif, system-ui, sans-serif";
      c.textBaseline = "alphabetic";
      c.textAlign = "left";
      c.fillText(d.text || "Note", p[0].x, p[0].y);
      if (selected) {
        c.setLineDash([3, 3]);
        c.lineWidth = 1;
        c.strokeRect(p[0].x - 4, p[0].y - 16, c.measureText(d.text || "Note").width + 8, 22);
      }
      break;
    case "brush":
      if (p.length > 1) {
        c.lineJoin = "round";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(p[0].x, p[0].y);
        for (const q of p.slice(1)) c.lineTo(q.x, q.y);
        c.stroke();
      }
      break;
  }

  if (selected && d.type !== "brush") for (const hp of handlePoints(d, p)) handle(c, hp, d.color);
  c.restore();
}
