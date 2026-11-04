/**
 * The chart itself: lightweight-charts with raw OHLC bars, indicator panes, band fills,
 * drawing tools and a live legend. Everything is drawn on canvas at device resolution,
 * one candle per bar, with no smoothing.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import {
  AreaSeries,
  BarSeries,
  BaselineSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  LineType,
  Logical,
  MouseEventParams,
  PriceScaleMode,
  SeriesType,
  Time,
  UTCTimestamp,
  createChart,
  createTextWatermark,
} from "lightweight-charts";
import { Eye, EyeOff, Settings2, X } from "lucide-react";
import { Bar, INDICATOR_BY_ID, Num, heikinAshi } from "./indicators";
import { BandFill } from "./bandFill";
import { DEFAULT_COLOR, Drawing, DrawingsPrimitive, POINTS, Pt, TimeIndex, ToolId } from "./drawings";

export type ChartType = "candles" | "hollow" | "heikin" | "bars" | "line" | "area" | "baseline";
export type ScaleMode = "normal" | "log" | "percent";

export interface IndicatorInstance {
  uid: string;
  id: string;
  params: Record<string, number>;
  hidden?: boolean;
}

export interface ChartHandle {
  screenshot: () => HTMLCanvasElement | null;
  resetView: () => void;
  lastCrosshairPrice: () => number | null;
  toXY: (pt: Pt) => { x: number; y: number } | null;
  /** Show bars from this (display) time to the latest bar; null fits everything. */
  showFrom: (time: number | null) => void;
}

interface Props {
  bars: Bar[];
  step: number;
  /** Changes when symbol or interval changes, so the view resets. */
  dataKey: string;
  intraday: boolean;
  chartType: ChartType;
  scaleMode: ScaleMode;
  indicators: IndicatorInstance[];
  showVolume: boolean;
  priceDigits: number;
  watermark: string;
  legendTitle: React.ReactNode;
  alerts: number[];
  tool: ToolId;
  magnet: boolean;
  stayInDrawMode: boolean;
  drawings: Drawing[];
  drawingsHidden: boolean;
  drawingsLocked: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDrawingsChange: (next: Drawing[]) => void;
  onToolDone: () => void;
  onEditText: (id: string) => void;
  onEditIndicator: (uid: string) => void;
  onRemoveIndicator: (uid: string) => void;
  onToggleIndicator: (uid: string) => void;
}

const UP = "#4ade80";
const DOWN = "#f87171";
const GOLD = "#d4af37";

type LegendRow = { uid: string; label: string; values: Array<{ color: string; text: string }>; hidden: boolean };

export function formatPrice(p: number, digits: number) {
  return p.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatVolume(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

const uid = () => Math.random().toString(36).slice(2, 10);

const ChartCanvas = forwardRef<ChartHandle, Props>(function ChartCanvas(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType>[]>([]);
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const computedRef = useRef<Array<{ inst: IndicatorInstance; out: Record<string, Num[]>; pane: number }>>([]);
  const lastKeyRef = useRef<string>("");
  const lastLenRef = useRef<number>(0);
  const crossPriceRef = useRef<number | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const primitiveRef = useRef(
    new DrawingsPrimitive({
      drawings: [],
      selectedId: null,
      draft: null,
      hidden: false,
      index: new TimeIndex([], 60),
      priceFormat: (p) => p.toFixed(2),
      bars: [],
    })
  );

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [paneTops, setPaneTops] = useState<number[]>([0]);

  // ---------------------------------------------------------------------
  // Chart instance
  // ---------------------------------------------------------------------
  useEffect(() => {
    const el = wrapRef.current!;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#090a0f" },
        textColor: "#a3a7b7",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
        panes: { separatorColor: "#232634", separatorHoverColor: "rgba(212,175,55,0.22)", enableResize: true },
      },
      grid: {
        vertLines: { color: "rgba(35,38,52,0.6)" },
        horzLines: { color: "rgba(35,38,52,0.6)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(212,175,55,0.5)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#8a7425" },
        horzLine: { color: "rgba(212,175,55,0.5)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#8a7425" },
      },
      rightPriceScale: { borderColor: "#232634", scaleMargins: { top: 0.08, bottom: 0.06 } },
      timeScale: { borderColor: "#232634", rightOffset: 10, barSpacing: 7, minBarSpacing: 0.4, timeVisible: true, secondsVisible: false },
      kineticScroll: { mouse: false, touch: true },
    });
    chartRef.current = chart;

    const onMove = (param: MouseEventParams<Time>) => {
      if (param.logical === undefined || param.point === undefined) {
        setHoverIdx(null);
        crossPriceRef.current = null;
      } else {
        setHoverIdx(Math.round(param.logical));
        const main = mainRef.current;
        crossPriceRef.current = main ? main.coordinateToPrice(param.point.y) : null;
      }
      measurePanes();
    };
    chart.subscribeCrosshairMove(onMove);
    const ro = new ResizeObserver(() => measurePanes());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const measurePanes = useCallback(() => {
    const chart = chartRef.current, el = wrapRef.current;
    if (!chart || !el) return;
    const base = el.getBoundingClientRect().top;
    const tops = chart.panes().map((p) => {
      const pe = p.getHTMLElement();
      return pe ? pe.getBoundingClientRect().top - base : 0;
    });
    setPaneTops((prev) => (prev.length === tops.length && prev.every((v, i) => Math.abs(v - tops[i]) < 0.5) ? prev : tops));
  }, []);

  // ---------------------------------------------------------------------
  // Build series whenever data, type or indicators change
  // ---------------------------------------------------------------------
  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const { bars, chartType, indicators, showVolume, priceDigits, step, dataKey, scaleMode, intraday, alerts } = props;

    const ts = chart.timeScale();
    const savedRange = ts.getVisibleLogicalRange();

    // Tear down
    if (mainRef.current) mainRef.current.detachPrimitive(primitiveRef.current);
    for (const s of seriesRef.current) chart.removeSeries(s);
    seriesRef.current = [];
    mainRef.current = null;
    for (let i = chart.panes().length - 1; i > 0; i--) chart.removePane(i);
    if (bars.length === 0) return;

    chart.applyOptions({ timeScale: { timeVisible: intraday } });
    const priceFormat = { type: "price" as const, precision: priceDigits, minMove: 1 / 10 ** priceDigits };
    const t = (time: number) => time as UTCTimestamp;

    // Main series
    let main: ISeriesApi<SeriesType>;
    const ohlc = (src: Bar[]) => src.map((b) => ({ time: t(b.time), open: b.open, high: b.high, low: b.low, close: b.close }));
    const common = { priceFormat, priceLineColor: GOLD, priceLineStyle: LineStyle.Dotted };
    switch (chartType) {
      case "bars":
        main = chart.addSeries(BarSeries, { ...common, upColor: UP, downColor: DOWN, thinBars: false });
        main.setData(ohlc(bars));
        break;
      case "line":
        main = chart.addSeries(LineSeries, { ...common, color: GOLD, lineWidth: 2 });
        main.setData(bars.map((b) => ({ time: t(b.time), value: b.close })));
        break;
      case "area":
        main = chart.addSeries(AreaSeries, { ...common, lineColor: GOLD, lineWidth: 2, topColor: "rgba(212,175,55,0.30)", bottomColor: "rgba(212,175,55,0.0)" });
        main.setData(bars.map((b) => ({ time: t(b.time), value: b.close })));
        break;
      case "baseline":
        main = chart.addSeries(BaselineSeries, {
          ...common,
          baseValue: { type: "price", price: bars[0].close },
          topLineColor: UP, topFillColor1: "rgba(74,222,128,0.25)", topFillColor2: "rgba(74,222,128,0.02)",
          bottomLineColor: DOWN, bottomFillColor1: "rgba(248,113,113,0.02)", bottomFillColor2: "rgba(248,113,113,0.25)",
          lineWidth: 2,
        });
        main.setData(bars.map((b) => ({ time: t(b.time), value: b.close })));
        break;
      default: {
        const hollow = chartType === "hollow";
        main = chart.addSeries(CandlestickSeries, {
          ...common,
          upColor: hollow ? "rgba(0,0,0,0)" : UP,
          downColor: DOWN,
          borderUpColor: UP,
          borderDownColor: DOWN,
          wickUpColor: UP,
          wickDownColor: DOWN,
          borderVisible: true,
        });
        main.setData(ohlc(chartType === "heikin" ? heikinAshi(bars) : bars));
      }
    }
    mainRef.current = main;
    seriesRef.current.push(main);
    main.priceScale().applyOptions({
      mode: scaleMode === "log" ? PriceScaleMode.Logarithmic : scaleMode === "percent" ? PriceScaleMode.Percentage : PriceScaleMode.Normal,
    });
    for (const a of alerts) {
      main.createPriceLine({ price: a, color: GOLD, lineWidth: 1, lineStyle: LineStyle.LargeDashed, axisLabelVisible: true, title: "Alert" });
    }

    // Volume, under the candles on its own scale
    if (showVolume) {
      const vol = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(bars.map((b) => ({ time: t(b.time), value: b.volume, color: b.close >= b.open ? "rgba(74,222,128,0.32)" : "rgba(248,113,113,0.32)" })));
      seriesRef.current.push(vol);
    }

    // Indicators
    const last = bars[bars.length - 1].time;
    const timeAt = (i: number) => (i < bars.length ? bars[i].time : last + (i - bars.length + 1) * step);
    let nextPane = 1;
    computedRef.current = [];
    for (const inst of indicators) {
      const def = INDICATOR_BY_ID[inst.id];
      if (!def) continue;
      const out = def.compute(bars, inst.params);
      const pane = def.overlay ? 0 : nextPane++;
      computedRef.current.push({ inst, out, pane });
      const byKey: Record<string, ISeriesApi<SeriesType>> = {};
      def.plots.forEach((plot, pi) => {
        const values = out[plot.key] || [];
        const base = {
          priceLineVisible: false,
          lastValueVisible: !inst.hidden && values.length > 0,
          visible: !inst.hidden,
          crosshairMarkerVisible: false,
          priceFormat: def.overlay ? priceFormat : { type: "price" as const, precision: 2, minMove: 0.01 },
          autoscaleInfoProvider: def.bounds ? () => ({ priceRange: { minValue: def.bounds![0], maxValue: def.bounds![1] } }) : undefined,
        };
        let s: ISeriesApi<SeriesType>;
        if (plot.type === "histogram") {
          s = chart.addSeries(HistogramSeries, { ...base, color: plot.color }, pane);
          s.setData(values.map((v, i) => (v === null ? { time: t(timeAt(i)) } : { time: t(timeAt(i)), value: v, color: v >= 0 ? plot.color : plot.colorDown || plot.color })));
        } else {
          s = chart.addSeries(
            LineSeries,
            {
              ...base,
              color: plot.color,
              lineWidth: (plot.width ?? 1.5) as 1,
              lineStyle: plot.dashed ? LineStyle.Dashed : LineStyle.Solid,
              lineType: plot.type === "step" ? LineType.WithSteps : LineType.Simple,
              lineVisible: plot.type !== "dots",
              pointMarkersVisible: plot.type === "dots",
              pointMarkersRadius: 1.6,
            },
            pane
          );
          const sign = plot.signKey ? out[plot.signKey] : null;
          s.setData(
            values.map((v, i) =>
              v === null
                ? { time: t(timeAt(i)) }
                : sign
                  ? { time: t(timeAt(i)), value: v, color: (sign[i] ?? 1) < 0 ? plot.colorDown || plot.color : plot.color }
                  : { time: t(timeAt(i)), value: v }
            )
          );
        }
        if (pi === 0 && def.levels && !inst.hidden) {
          for (const lvl of def.levels) s.createPriceLine({ price: lvl, color: "rgba(154,163,184,0.45)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "" });
        }
        byKey[plot.key] = s;
        seriesRef.current.push(s);
      });
      if (!inst.hidden) {
        for (const band of def.bands ?? []) {
          const up = out[band.upper] || [], lo = out[band.lower] || [];
          const pts = up
            .map((u, i) => (u === null || lo[i] === null || lo[i] === undefined ? null : { time: timeAt(i), upper: u, lower: lo[i] as number }))
            .filter((x): x is { time: number; upper: number; lower: number } => x !== null);
          byKey[band.upper]?.attachPrimitive(new BandFill(pts, band.color, band.colorAlt));
        }
      }
    }

    const panes = chart.panes();
    panes[0].setStretchFactor(panes.length > 1 ? 3.4 : 1);
    for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1);

    // Drawings live on the main series
    primitiveRef.current.update({
      index: new TimeIndex(bars.map((b) => b.time), step),
      priceFormat: (p) => formatPrice(p, priceDigits),
      bars,
    });
    main.attachPrimitive(primitiveRef.current);

    // Keep the user's view unless the symbol or interval changed
    if (dataKey === lastKeyRef.current && savedRange) {
      const grown = bars.length - lastLenRef.current;
      const atEnd = savedRange.to >= lastLenRef.current - 2;
      const shift = atEnd && grown > 0 ? grown : 0;
      ts.setVisibleLogicalRange({ from: (savedRange.from + shift) as Logical, to: (savedRange.to + shift) as Logical });
    } else {
      const n = bars.length;
      ts.setVisibleLogicalRange({ from: Math.max(-5, n - (intraday ? 180 : 160)) as Logical, to: (n + 8) as Logical });
    }
    lastKeyRef.current = dataKey;
    lastLenRef.current = bars.length;
    requestAnimationFrame(measurePanes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.bars, props.chartType, props.indicators, props.showVolume, props.priceDigits, props.scaleMode, props.alerts, props.dataKey]);

  // Watermark
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !props.watermark) return;
    const wm = createTextWatermark(chart.panes()[0], {
      horzAlign: "center",
      vertAlign: "center",
      lines: [{ text: props.watermark, color: "rgba(212,175,55,0.06)", fontSize: 64, fontFamily: "Cormorant Garamond, Georgia, serif", fontStyle: "" }],
    });
    return () => wm.detach();
  }, [props.watermark, props.indicators.length]);

  // Drawings state → primitive
  useEffect(() => {
    primitiveRef.current.update({ drawings: props.drawings, selectedId: props.selectedId, hidden: props.drawingsHidden });
  }, [props.drawings, props.selectedId, props.drawingsHidden]);

  // Disable chart panning while a drawing tool is armed, so drags draw instead.
  useEffect(() => {
    chartRef.current?.applyOptions({
      handleScroll: props.tool === "cursor",
      handleScale: props.tool === "cursor" ? true : { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });
  }, [props.tool]);

  // ---------------------------------------------------------------------
  // Pointer handling for drawing and editing
  // ---------------------------------------------------------------------
  useEffect(() => {
    const el = wrapRef.current!;
    const prim = primitiveRef.current;
    type Drag =
      | { kind: "draft"; clicks: number; downX: number; downY: number }
      | { kind: "brush" }
      | { kind: "move"; id: string; handle: number | null; start: Pt; orig: Pt[]; moved: boolean };
    let drag: Drag | null = null;
    // The chart listens to mouse events; swallow the mousedown that follows a handled pointerdown.
    let swallow = false;
    const onMouseDown = (e: MouseEvent) => {
      if (swallow) {
        e.stopPropagation();
        swallow = false;
      }
    };

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const inMainPane = (x: number, y: number) => {
      const chart = chartRef.current;
      if (!chart) return false;
      const h = chart.panes()[0]?.getHeight() ?? 0;
      return y >= 0 && y <= h && x >= 0 && x <= chart.timeScale().width();
    };
    const snap = (pt: Pt): Pt => {
      if (!propsRef.current.magnet) return pt;
      const idx = Math.round(prim.ctx.index.toLogical(pt.t));
      const bar = propsRef.current.bars[idx];
      if (!bar) return pt;
      const cand = [bar.open, bar.high, bar.low, bar.close];
      const p = cand.reduce((best, v) => (Math.abs(v - pt.p) < Math.abs(best - pt.p) ? v : best), cand[0]);
      return { t: bar.time, p };
    };
    const ptAt = (x: number, y: number) => {
      const pt = prim.fromXY(x, y);
      return pt ? snap(pt) : null;
    };
    const commitDraft = () => {
      const d = prim.ctx.draft;
      prim.update({ draft: null });
      drag = null;
      if (!d) return;
      if (d.type === "long" || d.type === "short") {
        const [e, tg] = d.pts;
        d.pts = [e, tg, { t: tg.t, p: e.p - (tg.p - e.p) }];
      }
      const p = propsRef.current;
      p.onDrawingsChange([...p.drawings, d]);
      p.onSelect(d.id);
      if (d.type === "text") p.onEditText(d.id);
      if (!p.stayInDrawMode) p.onToolDone();
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const p = propsRef.current;
      const { x, y } = local(e);
      if (!inMainPane(x, y)) return;

      if (p.tool !== "cursor") {
        e.stopPropagation();
        e.preventDefault();
        swallow = true;
        const pt = ptAt(x, y);
        if (!pt) return;
        const type = p.tool;
        if (type === "brush") {
          prim.update({ draft: { id: uid(), type, pts: [pt], color: DEFAULT_COLOR[type] } });
          drag = { kind: "brush" };
          return;
        }
        const need = POINTS[type];
        const draft = prim.ctx.draft;
        if (draft && drag?.kind === "draft") {
          draft.pts[drag.clicks] = pt;
          drag.clicks++;
          if (drag.clicks >= need) commitDraft();
          else {
            draft.pts[drag.clicks] = pt;
            prim.update({ draft });
          }
          return;
        }
        const d: Drawing = { id: uid(), type, pts: need === 1 ? [pt] : [pt, pt], color: DEFAULT_COLOR[type], text: type === "text" ? "Note" : undefined };
        prim.update({ draft: d });
        if (need === 1) commitDraft();
        else drag = { kind: "draft", clicks: 1, downX: x, downY: y };
        return;
      }

      if (p.drawingsLocked) return;
      const hit = prim.findAt(x, y);
      if (hit) {
        e.stopPropagation();
        e.preventDefault();
        swallow = true;
        p.onSelect(hit.drawing.id);
        const start = prim.fromXY(x, y);
        if (start) drag = { kind: "move", id: hit.drawing.id, handle: hit.handle, start, orig: hit.drawing.pts.map((q) => ({ ...q })), moved: false };
      } else if (p.selectedId) {
        p.onSelect(null);
      }
    };

    const onMove = (e: PointerEvent) => {
      const { x, y } = local(e);
      if (!drag) {
        const p = propsRef.current;
        if (p.tool === "cursor" && !p.drawingsLocked) {
          const hit = inMainPane(x, y) ? prim.findAt(x, y) : null;
          el.style.cursor = hit ? (hit.handle !== null ? "grab" : "move") : "";
        } else {
          el.style.cursor = p.tool === "cursor" ? "" : "crosshair";
        }
        return;
      }
      if (drag.kind === "brush") {
        const pt = prim.fromXY(x, y);
        const d = prim.ctx.draft;
        if (pt && d) {
          d.pts.push(pt);
          prim.update({ draft: d });
        }
        return;
      }
      if (drag.kind === "draft") {
        const pt = ptAt(x, y);
        const d = prim.ctx.draft;
        if (pt && d) {
          d.pts[drag.clicks] = pt;
          prim.update({ draft: d });
        }
        return;
      }
      // Moving an existing drawing
      const pt = prim.fromXY(x, y);
      if (!pt) return;
      drag.moved = true;
      const p = propsRef.current;
      const idx = prim.ctx.index;
      const next = p.drawings.map((d) => {
        if (d.id !== (drag as { id: string }).id) return d;
        const mv = drag as Extract<Drag, { kind: "move" }>;
        if (mv.handle !== null) {
          const pts = mv.orig.map((q) => ({ ...q }));
          pts[mv.handle] = snap(pt);
          return { ...d, pts };
        }
        const dl = idx.toLogical(pt.t) - idx.toLogical(mv.start.t);
        const dp = pt.p - mv.start.p;
        return { ...d, pts: mv.orig.map((q) => ({ t: idx.toTime(idx.toLogical(q.t) + dl), p: q.p + dp })) };
      });
      prim.update({ drawings: next });
    };

    const onUp = (e: PointerEvent) => {
      if (!drag) return;
      if (drag.kind === "brush") {
        commitDraft();
        return;
      }
      if (drag.kind === "draft") {
        const { x, y } = local(e);
        // Drag-to-draw: releasing far from the press completes a two-point tool.
        if (drag.clicks === 1 && Math.hypot(x - drag.downX, y - drag.downY) > 6) {
          drag.clicks = 2;
          const d = prim.ctx.draft!;
          if (POINTS[d.type] <= 2) commitDraft();
          else {
            d.pts[2] = d.pts[1];
            prim.update({ draft: d });
          }
        }
        return;
      }
      if (drag.kind === "move") {
        if (drag.moved) propsRef.current.onDrawingsChange(prim.ctx.drawings);
        drag = null;
      }
    };

    const onDbl = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const hit = prim.findAt(e.clientX - r.left, e.clientY - r.top);
      if (hit?.drawing.type === "text") {
        e.stopPropagation();
        propsRef.current.onEditText(hit.drawing.id);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && prim.ctx.draft) {
        prim.update({ draft: null });
        drag = null;
      }
    };

    el.addEventListener("pointerdown", onDown, true);
    el.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    el.addEventListener("dblclick", onDbl, true);
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      el.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      el.removeEventListener("dblclick", onDbl, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Cancel a half-finished drawing when the tool changes.
  useEffect(() => {
    if (primitiveRef.current.ctx.draft) primitiveRef.current.update({ draft: null });
  }, [props.tool]);

  useImperativeHandle(ref, () => ({
    screenshot: () => chartRef.current?.takeScreenshot(true) ?? null,
    resetView: () => {
      const n = propsRef.current.bars.length;
      chartRef.current?.timeScale().setVisibleLogicalRange({ from: Math.max(-5, n - 160) as Logical, to: (n + 8) as Logical });
      mainRef.current?.priceScale().applyOptions({ autoScale: true });
    },
    lastCrosshairPrice: () => crossPriceRef.current,
    toXY: (pt) => primitiveRef.current.toXY(pt),
    showFrom: (time) => {
      const bars = propsRef.current.bars;
      const ts = chartRef.current?.timeScale();
      if (!ts || bars.length === 0) return;
      if (time === null) return ts.fitContent();
      const from = bars.findIndex((b) => b.time >= time);
      ts.setVisibleLogicalRange({ from: Math.max(0, from) - 0.5 as Logical, to: (bars.length - 1 + 4) as Logical });
    },
  }));

  // ---------------------------------------------------------------------
  // Legend
  // ---------------------------------------------------------------------
  const { bars, priceDigits } = props;
  const idx = hoverIdx !== null && hoverIdx >= 0 && hoverIdx < bars.length ? hoverIdx : bars.length - 1;
  const bar = bars[idx];
  const prev = bars[idx - 1];
  const fmt = (v: number) => formatPrice(v, priceDigits);

  const rowsByPane: Record<number, LegendRow[]> = {};
  for (const { inst, out, pane } of computedRef.current) {
    const def = INDICATOR_BY_ID[inst.id];
    if (!def) continue;
    const args = def.params.filter((p) => !p.options).map((p) => inst.params[p.key]);
    (rowsByPane[pane] ||= []).push({
      uid: inst.uid,
      label: `${def.short}${args.length ? ` ${args.join(" ")}` : ""}`,
      hidden: !!inst.hidden,
      values: def.plots
        .map((pl) => {
          const v = out[pl.key]?.[idx];
          const neg = pl.type === "histogram" ? v !== null && v !== undefined && v < 0 : pl.signKey ? (out[pl.signKey]?.[idx] ?? 1) < 0 : false;
          return { color: neg ? pl.colorDown || pl.color : pl.color, text: v === null || v === undefined ? "" : def.overlay ? fmt(v) : Math.abs(v) >= 1e5 ? formatVolume(v) : v.toFixed(2) };
        })
        .filter((v) => v.text),
    });
  }

  const legendRow = (r: LegendRow) => (
    <div key={r.uid} className="group flex items-center gap-2 pointer-events-auto w-fit max-w-full">
      <span className={`text-[11px] ${r.hidden ? "text-lq-muted/60" : "text-lq-text-2"}`}>{r.label}</span>
      {!r.hidden && r.values.map((v, i) => (
        <span key={i} className="text-[11px] tabular-nums" style={{ color: v.color }}>{v.text}</span>
      ))}
      <span className="hidden group-hover:flex items-center gap-0.5 ml-1">
        <button type="button" title={r.hidden ? "Show" : "Hide"} onClick={() => props.onToggleIndicator(r.uid)} className="p-0.5 rounded text-lq-muted hover:text-lq-text hover:bg-lq-surface-2">
          {r.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button type="button" title="Settings" onClick={() => props.onEditIndicator(r.uid)} className="p-0.5 rounded text-lq-muted hover:text-lq-text hover:bg-lq-surface-2">
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Remove" onClick={() => props.onRemoveIndicator(r.uid)} className="p-0.5 rounded text-lq-muted hover:text-lq-down hover:bg-lq-surface-2">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    </div>
  );

  return (
    <div className="relative w-full h-full">
      <div ref={wrapRef} className="absolute inset-0" />
      {bar && (
        <div className="absolute left-3 right-24 top-2 z-10 font-mono pointer-events-none flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
            {props.legendTitle}
            {(() => {
              const up = bar.close >= bar.open;
              const col = up ? "text-lq-up" : "text-lq-down";
              const ch = prev ? bar.close - prev.close : 0;
              const pct = prev ? (ch / prev.close) * 100 : 0;
              return (
                <span className="flex flex-wrap gap-x-2.5 tabular-nums">
                  <span className="text-lq-muted">O<span className={`ml-1 ${col}`}>{fmt(bar.open)}</span></span>
                  <span className="text-lq-muted">H<span className={`ml-1 ${col}`}>{fmt(bar.high)}</span></span>
                  <span className="text-lq-muted">L<span className={`ml-1 ${col}`}>{fmt(bar.low)}</span></span>
                  <span className="text-lq-muted">C<span className={`ml-1 ${col}`}>{fmt(bar.close)}</span></span>
                  <span className={ch >= 0 ? "text-lq-up" : "text-lq-down"}>
                    {ch >= 0 ? "+" : ""}{fmt(ch)} ({ch >= 0 ? "+" : ""}{pct.toFixed(2)}%)
                  </span>
                  {props.showVolume && <span className="text-lq-muted">Vol<span className="ml-1 text-lq-text-2">{formatVolume(bar.volume)}</span></span>}
                </span>
              );
            })()}
          </div>
          {(rowsByPane[0] || []).map(legendRow)}
        </div>
      )}
      {paneTops.slice(1).map((top, i) => (
        <div key={i} className="absolute left-3 right-24 z-10 font-mono pointer-events-none flex flex-col gap-0.5" style={{ top: top + 4 }}>
          {(rowsByPane[i + 1] || []).map(legendRow)}
        </div>
      ))}
    </div>
  );
});

export default ChartCanvas;
