/**
 * Per-symbol chart page (/app/chart/:symbol): toolbar, drawing rail, the chart,
 * range presets with the exchange clock, and the quote/tools panel on the right.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightFromLine,
  Bell,
  Brush,
  Camera,
  ChartArea,
  ChartCandlestick,
  ChartColumn,
  ChartLine,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Magnet,
  Maximize2,
  Minimize2,
  MousePointer2,
  MoveHorizontal,
  MoveUpRight,
  MoveVertical,
  PanelRight,
  PenLine,
  RefreshCw,
  Redo2,
  Rows3,
  Ruler,
  Sigma,
  Slash,
  Square,
  Trash2,
  TrendingDown,
  TrendingUp,
  Type,
  Undo2,
  AlignVerticalSpaceAround,
  Baseline,
  Spline,
  Pencil,
} from "lucide-react";
import type { Ticker } from "../../types";
import ChartCanvas, { ChartHandle, ChartType, IndicatorInstance, ScaleMode } from "./ChartCanvas";
import { Bar, INDICATOR_BY_ID, defaultParams } from "./indicators";
import { DEFAULT_COLOR, Drawing, ToolId } from "./drawings";
import { IndicatorPicker, IndicatorSettings, TradeTicket } from "./Dialogs";
import InfoPanel, { QuoteInfo } from "./InfoPanel";

type Interval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D" | "1W" | "1M";

const INTERVALS: Array<{ id: Interval; label: string; long: string; seconds: number }> = [
  { id: "1m", label: "1m", long: "1 minute", seconds: 60 },
  { id: "5m", label: "5m", long: "5 minutes", seconds: 300 },
  { id: "15m", label: "15m", long: "15 minutes", seconds: 900 },
  { id: "30m", label: "30m", long: "30 minutes", seconds: 1800 },
  { id: "1h", label: "1H", long: "1 hour", seconds: 3600 },
  { id: "4h", label: "4H", long: "4 hours", seconds: 14_400 },
  { id: "1D", label: "D", long: "1 day", seconds: 86_400 },
  { id: "1W", label: "W", long: "1 week", seconds: 604_800 },
  { id: "1M", label: "M", long: "1 month", seconds: 2_592_000 },
];

const CHART_TYPES: Array<{ id: ChartType; label: string; icon: React.ElementType }> = [
  { id: "candles", label: "Candles", icon: ChartCandlestick },
  { id: "hollow", label: "Hollow candles", icon: ChartCandlestick },
  { id: "heikin", label: "Heikin Ashi", icon: ChartCandlestick },
  { id: "bars", label: "OHLC bars", icon: ChartColumn },
  { id: "line", label: "Line", icon: ChartLine },
  { id: "area", label: "Area", icon: ChartArea },
  { id: "baseline", label: "Baseline", icon: Baseline },
];

/** Range presets pick an interval and zoom to a window, with full history still loaded. */
const PRESETS: Array<{ id: string; interval: Interval; from: (last: number) => number | null }> = [
  { id: "1D", interval: "1m", from: (t) => Math.floor(t / 86_400) * 86_400 },
  { id: "5D", interval: "5m", from: (t) => t - 7 * 86_400 },
  { id: "1M", interval: "30m", from: (t) => t - 31 * 86_400 },
  { id: "3M", interval: "1h", from: (t) => t - 92 * 86_400 },
  { id: "6M", interval: "1D", from: (t) => t - 183 * 86_400 },
  { id: "YTD", interval: "1D", from: (t) => Date.UTC(new Date(t * 1000).getUTCFullYear(), 0, 1) / 1000 },
  { id: "1Y", interval: "1D", from: (t) => t - 366 * 86_400 },
  { id: "5Y", interval: "1W", from: (t) => t - 5 * 366 * 86_400 },
  { id: "All", interval: "1M", from: () => null },
];

type ToolDef = { id: Exclude<ToolId, "cursor">; label: string; icon: React.ElementType; key?: string };
const TOOL_GROUPS: Array<{ id: string; label: string; tools: ToolDef[] }> = [
  {
    id: "lines",
    label: "Lines",
    tools: [
      { id: "trend", label: "Trend line", icon: Slash, key: "T" },
      { id: "ray", label: "Ray", icon: MoveUpRight },
      { id: "extended", label: "Extended line", icon: Spline },
      { id: "hline", label: "Horizontal line", icon: MoveHorizontal, key: "H" },
      { id: "hray", label: "Horizontal ray", icon: ArrowRightFromLine },
      { id: "vline", label: "Vertical line", icon: MoveVertical, key: "V" },
    ],
  },
  {
    id: "channels",
    label: "Channels & Fibonacci",
    tools: [
      { id: "channel", label: "Parallel channel", icon: Rows3, key: "C" },
      { id: "fib", label: "Fib retracement", icon: AlignVerticalSpaceAround, key: "F" },
    ],
  },
  {
    id: "shapes",
    label: "Shapes & notes",
    tools: [
      { id: "rect", label: "Rectangle", icon: Square, key: "R" },
      { id: "brush", label: "Brush", icon: Brush, key: "B" },
      { id: "text", label: "Text note", icon: Type, key: "N" },
    ],
  },
  {
    id: "measure",
    label: "Measure & positions",
    tools: [
      { id: "measure", label: "Price range", icon: Ruler, key: "M" },
      { id: "long", label: "Long position", icon: TrendingUp, key: "L" },
      { id: "short", label: "Short position", icon: TrendingDown, key: "S" },
    ],
  },
];
const ALL_TOOLS = TOOL_GROUPS.flatMap((g) => g.tools);

const SWATCHES = ["#5ab0ff", "#d4af37", "#4ade80", "#f87171", "#d27cff", "#2ed3c6", "#ffb547", "#f3efe6"];

interface CandleResponse {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  market: "US" | "IN" | "OTHER";
  currencySymbol: string;
  interval: Interval;
  source: "yahoo" | "sample";
  gmtOffset: number;
  timezone: string;
  price: number;
  previousClose: number;
  dayHigh: number | null;
  dayLow: number | null;
  dayVolume: number | null;
  high52: number | null;
  low52: number | null;
  asOf: string;
  candles: Bar[];
}

// ---------------------------------------------------------------------------
// Persistence helpers (per-browser conveniences; failures are harmless)
// ---------------------------------------------------------------------------
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

const newUid = () => Math.random().toString(36).slice(2, 10);
const DEFAULT_INDICATORS: IndicatorInstance[] = [
  { uid: "d-ema", id: "ema", params: { length: 21, src: 0 } },
  { uid: "d-sma", id: "sma", params: { length: 50, src: 0 } },
  { uid: "d-rsi", id: "rsi", params: { length: 14, ma: 14, src: 0 } },
];

function digitsFor(price: number, symbol: string) {
  if (price >= 10) return 2;
  if (price >= 1) return symbol.endsWith("=X") ? 4 : 3;
  if (price >= 0.01) return 4;
  return 6;
}

function offsetLabel(sec: number) {
  const sign = sec >= 0 ? "+" : "−";
  const a = Math.abs(sec);
  const h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60);
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

function marketState(data: CandleResponse | null, now: number): { label: string; open: boolean } {
  if (!data) return { label: "", open: false };
  if (/-USD$/.test(data.symbol)) return { label: "24/7 market", open: true };
  const local = new Date((now + data.gmtOffset) * 1000);
  const dow = local.getUTCDay();
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  const session = data.market === "IN" ? [555, 930] : data.market === "US" ? [570, 960] : null;
  if (!session) return { label: "", open: false };
  const open = dow > 0 && dow < 6 && mins >= session[0] && mins < session[1];
  return { label: open ? "Market open" : "Market closed", open };
}

// ---------------------------------------------------------------------------

interface Props {
  symbol: string;
  tickers: Ticker[];
  onTradeExecuted?: (ticker: string, side: "buy" | "sell", orderType: string, qty: number, price: number) => void;
  onAlertMessage?: (msg: string) => void;
}

export default function ChartPage({ symbol: rawSymbol, tickers, onTradeExecuted, onAlertMessage }: Props) {
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();
  const chartRef = useRef<ChartHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);

  // Layout prefs (shared across symbols)
  const [interval, setIntervalId] = useState<Interval>(() => load("lq_chart_interval", "1D"));
  const [chartType, setChartType] = useState<ChartType>(() => load("lq_chart_type", "candles"));
  const [scaleMode, setScaleMode] = useState<ScaleMode>(() => load("lq_chart_scale", "normal"));
  const [indicators, setIndicators] = useState<IndicatorInstance[]>(() => load("lq_chart_indicators", DEFAULT_INDICATORS));
  const [showVolume, setShowVolume] = useState<boolean>(() => load("lq_chart_volume", true));
  const [panelOpen, setPanelOpen] = useState<boolean>(() => load("lq_chart_panel", true));
  useEffect(() => save("lq_chart_interval", interval), [interval]);
  useEffect(() => save("lq_chart_type", chartType), [chartType]);
  useEffect(() => save("lq_chart_scale", scaleMode), [scaleMode]);
  useEffect(() => save("lq_chart_indicators", indicators), [indicators]);
  useEffect(() => save("lq_chart_volume", showVolume), [showVolume]);
  useEffect(() => save("lq_chart_panel", panelOpen), [panelOpen]);

  // Drawing state (per symbol)
  const [tool, setTool] = useState<ToolId>("cursor");
  const [groupTool, setGroupTool] = useState<Record<string, ToolDef["id"]>>({ lines: "trend", channels: "channel", shapes: "rect", measure: "measure" });
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [magnet, setMagnet] = useState<boolean>(() => load("lq_chart_magnet", false));
  const [stayDraw, setStayDraw] = useState(false);
  const [drawingsHidden, setDrawingsHidden] = useState(false);
  const [locked, setLocked] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [undo, setUndo] = useState<Drawing[][]>([]);
  const [redo, setRedo] = useState<Drawing[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<number[]>([]);
  useEffect(() => save("lq_chart_magnet", magnet), [magnet]);

  useEffect(() => {
    setDrawings(load(`lq_chart_drawings_${symbol}`, []));
    setAlerts(load(`lq_chart_alerts_${symbol}`, []));
    setUndo([]);
    setRedo([]);
    setSelectedId(null);
  }, [symbol]);

  const commitDrawings = useCallback(
    (next: Drawing[]) => {
      setUndo((u) => [...u.slice(-49), drawings]);
      setRedo([]);
      setDrawings(next);
      save(`lq_chart_drawings_${symbol}`, next);
    },
    [drawings, symbol]
  );
  const updateAlerts = (next: number[]) => {
    setAlerts(next);
    save(`lq_chart_alerts_${symbol}`, next);
  };

  // Dialogs
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<string | null>(null);
  const [ticket, setTicket] = useState<"buy" | "sell" | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------
  const [data, setData] = useState<CandleResponse | null>(null);
  const [daily, setDaily] = useState<CandleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingFrom = useRef<((last: number) => number | null) | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const intraday = INTERVALS.find((i) => i.id === interval)!.seconds < 86_400;
    const fetchOnce = async (first: boolean) => {
      if (first) setLoading(true);
      try {
        const res = await fetch(`/api/candles/${encodeURIComponent(symbol)}?interval=${interval}`);
        const json = await res.json();
        if (!alive) return;
        if (!res.ok || !Array.isArray(json.candles)) throw new Error(json.error || "No data");
        setData(json);
        setError(null);
      } catch (e: any) {
        if (alive && first) setError(e.message || "Could not load chart data.");
      } finally {
        if (alive && first) setLoading(false);
      }
    };
    fetchOnce(true);
    const id = window.setInterval(() => document.visibilityState === "visible" && fetchOnce(false), intraday ? 15_000 : 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [symbol, interval]);

  useEffect(() => {
    let alive = true;
    const go = () =>
      fetch(`/api/candles/${encodeURIComponent(symbol)}?interval=1D&range=2y`)
        .then((r) => r.json())
        .then((j) => alive && Array.isArray(j.candles) && setDaily(j))
        .catch(() => {});
    setDaily(null);
    go();
    const id = window.setInterval(() => document.visibilityState === "visible" && go(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [symbol]);

  const current = data && data.id === symbol && data.interval === interval ? data : null;
  const shift = (c: CandleResponse | null) =>
    c ? c.candles.filter((b) => [b.open, b.high, b.low, b.close].every((v) => typeof v === "number" && isFinite(v))).map((b) => ({ ...b, time: b.time + c.gmtOffset })) : [];
  const bars = useMemo(() => shift(current), [current]);
  const dailyBars = useMemo(() => shift(daily && daily.id === symbol ? daily : null), [daily, symbol]);
  const step = INTERVALS.find((i) => i.id === interval)!.seconds;
  const intraday = step < 86_400;

  const quoteSrc = daily && daily.id === symbol ? daily : current;
  const quote: QuoteInfo | null = quoteSrc
    ? {
        name: quoteSrc.name,
        exchange: quoteSrc.exchange,
        symbol: quoteSrc.symbol,
        currencySymbol: quoteSrc.currencySymbol,
        price: current?.price ?? quoteSrc.price,
        previousClose: quoteSrc.previousClose,
        dayHigh: quoteSrc.dayHigh,
        dayLow: quoteSrc.dayLow,
        dayVolume: quoteSrc.dayVolume,
        high52: quoteSrc.high52,
        low52: quoteSrc.low52,
        source: (current ?? quoteSrc).source,
        asOf: (current ?? quoteSrc).asOf,
      }
    : null;
  const digits = digitsFor(quote?.price ?? 100, symbol);
  const ticker = tickers.find((t) => t.id === symbol);

  // Zoom to a preset window once its interval's bars arrive.
  useEffect(() => {
    if (!pendingFrom.current || bars.length === 0) return;
    const fn = pendingFrom.current;
    pendingFrom.current = null;
    requestAnimationFrame(() => chartRef.current?.showFrom(fn(bars[bars.length - 1].time)));
  }, [bars]);

  // Price alerts: notify once when price crosses a level, then clear it.
  const lastPrice = useRef<number | null>(null);
  useEffect(() => {
    const p = current?.price;
    if (p === undefined) return;
    const prev = lastPrice.current;
    lastPrice.current = p;
    if (prev === null || prev === p) return;
    const hit = alerts.filter((a) => (prev < a && p >= a) || (prev > a && p <= a));
    if (hit.length) {
      hit.forEach((a) => onAlertMessage?.(`Price alert: ${symbol} crossed ${current!.currencySymbol}${a.toFixed(digits)} (now ${p.toFixed(digits)}).`));
      updateAlerts(alerts.filter((a) => !hit.includes(a)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.price]);
  useEffect(() => {
    lastPrice.current = null;
  }, [symbol]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const pickInterval = (id: Interval) => {
    setActivePreset(null);
    setIntervalId(id);
  };
  const pickPreset = (p: (typeof PRESETS)[number]) => {
    setActivePreset(p.id);
    pendingFrom.current = p.from;
    if (p.interval === interval && bars.length) {
      pendingFrom.current = null;
      chartRef.current?.showFrom(p.from(bars[bars.length - 1].time));
    } else setIntervalId(p.interval);
  };
  const addIndicator = (id: string) => {
    const def = INDICATOR_BY_ID[id];
    if (!def) return;
    setIndicators((list) => [...list, { uid: newUid(), id, params: defaultParams(def) }]);
  };
  const removeSelected = () => {
    if (!selectedId) return;
    commitDrawings(drawings.filter((d) => d.id !== selectedId));
    setSelectedId(null);
  };
  const doUndo = () => {
    if (!undo.length) return;
    setRedo((r) => [...r, drawings]);
    const prev = undo[undo.length - 1];
    setUndo(undo.slice(0, -1));
    setDrawings(prev);
    save(`lq_chart_drawings_${symbol}`, prev);
  };
  const doRedo = () => {
    if (!redo.length) return;
    setUndo((u) => [...u, drawings]);
    const next = redo[redo.length - 1];
    setRedo(redo.slice(0, -1));
    setDrawings(next);
    save(`lq_chart_drawings_${symbol}`, next);
  };
  const screenshot = () => {
    const canvas = chartRef.current?.screenshot();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${symbol}-${interval}-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const armTool = (id: ToolId) => {
    setOpenGroup(null);
    setTool((t) => (t === id && id !== "cursor" ? "cursor" : id));
    const g = TOOL_GROUPS.find((gr) => gr.tools.some((tl) => tl.id === id));
    if (g) setGroupTool((m) => ({ ...m, [g.id]: id as ToolDef["id"] }));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        doRedo();
      } else if (e.key === "Escape") {
        setTool("cursor");
        setSelectedId(null);
        setOpenGroup(null);
      } else if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const t = ALL_TOOLS.find((tl) => tl.key && e.code === `Key${tl.key}`);
        if (t) {
          e.preventDefault();
          armTool(t.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selected = drawings.find((d) => d.id === selectedId) || null;
  const editing = drawings.find((d) => d.id === editingText) || null;
  const editPos = editing ? chartRef.current?.toXY(editing.pts[0]) : null;
  const intervalDef = INTERVALS.find((i) => i.id === interval)!;
  const typeDef = CHART_TYPES.find((c) => c.id === chartType)!;

  // Clock
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => window.clearInterval(id);
  }, []);
  const tzSrc = current ?? daily;
  const clock = tzSrc ? new Date((now + tzSrc.gmtOffset) * 1000).toISOString().slice(11, 19) : "";
  const mkt = marketState(tzSrc, now);

  const btn = "h-8 px-2 rounded-md text-[12px] flex items-center gap-1.5 text-lq-text-2 hover:text-lq-text hover:bg-lq-surface-2 transition-colors";
  const btnOn = "text-lq-gold bg-lq-gold/10 hover:text-lq-gold";
  const railBtn = (on: boolean) =>
    `relative w-9 h-9 rounded-md flex items-center justify-center transition-colors ${on ? "text-lq-gold bg-lq-gold/10" : "text-lq-text-2 hover:text-lq-text hover:bg-lq-surface-2"}`;

  // Fill the viewport below the header and market strip.
  const [avail, setAvail] = useState<number | null>(null);
  useEffect(() => {
    const measure = () => {
      const top = rootRef.current ? rootRef.current.getBoundingClientRect().top + window.scrollY : 0;
      setAvail(window.innerHeight - top);
    };
    measure();
    const t = window.setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={rootRef} className="shrink-0 w-full flex flex-col bg-lq-bg" style={{ height: fullscreen ? "100vh" : avail ? `${avail}px` : "calc(100vh - 110px)", minHeight: 560 }}>
      {/* ===== Top toolbar ===== */}
      <div className="flex items-center gap-1 px-2 h-11 border-b border-lq-line bg-lq-bg-2 overflow-x-auto shrink-0">
        <div className="flex items-center gap-2 pl-1 pr-3 mr-1 border-r border-lq-line h-full shrink-0">
          <span className="font-mono text-[13px] font-semibold text-lq-text">{symbol}</span>
          {quote && <span className="text-[12px] text-lq-muted max-w-[180px] truncate hidden md:inline">{quote.name}</span>}
        </div>

        <div className="flex items-center shrink-0" role="group" aria-label="Interval">
          {INTERVALS.map((iv) => (
            <button key={iv.id} type="button" title={iv.long} onClick={() => pickInterval(iv.id)} className={`${btn} !px-2 font-mono ${interval === iv.id ? btnOn : ""}`}>
              {iv.label}
            </button>
          ))}
        </div>
        <span className="w-px h-5 bg-lq-line mx-1 shrink-0" />

        <div className="relative shrink-0">
          <button type="button" className={btn} onClick={() => setTypeOpen(!typeOpen)} aria-expanded={typeOpen} title="Chart type">
            <typeDef.icon className="w-4 h-4" />
            <span className="hidden lg:inline">{typeDef.label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {typeOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setTypeOpen(false)} />
              <ul className="absolute z-50 top-9 left-0 w-48 m-0 p-1 list-none bg-lq-surface border border-lq-line-2 rounded-lg shadow-2xl">
                {CHART_TYPES.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setChartType(c.id);
                        setTypeOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] ${chartType === c.id ? "text-lq-gold bg-lq-gold/10" : "text-lq-text-2 hover:bg-lq-surface-2"}`}
                    >
                      <c.icon className="w-4 h-4" /> {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <button type="button" className={`${btn} shrink-0`} onClick={() => setPickerOpen(true)} title="Indicators">
          <Sigma className="w-4 h-4" /> <span>Indicators</span>
          {indicators.length > 0 && <span className="font-mono text-[10px] text-lq-gold">{indicators.length}</span>}
        </button>
        <button type="button" className={`${btn} shrink-0 ${showVolume ? btnOn : ""}`} onClick={() => setShowVolume(!showVolume)} title="Volume">
          <ChartColumn className="w-4 h-4" /> <span className="hidden lg:inline">Volume</span>
        </button>
        <button
          type="button"
          className={`${btn} shrink-0`}
          title="Add price alert at the last price"
          onClick={() => quote && updateAlerts([...alerts, Number(quote.price.toFixed(digits))])}
        >
          <Bell className="w-4 h-4" /> <span className="hidden lg:inline">Alert</span>
        </button>
        <span className="w-px h-5 bg-lq-line mx-1 shrink-0" />
        <button type="button" className={`${btn} shrink-0`} onClick={doUndo} disabled={!undo.length} title="Undo (Ctrl+Z)">
          <Undo2 className={`w-4 h-4 ${undo.length ? "" : "opacity-40"}`} />
        </button>
        <button type="button" className={`${btn} shrink-0`} onClick={doRedo} disabled={!redo.length} title="Redo (Ctrl+Y)">
          <Redo2 className={`w-4 h-4 ${redo.length ? "" : "opacity-40"}`} />
        </button>

        <div className="flex-1" />
        <button type="button" className={`${btn} shrink-0`} onClick={screenshot} title="Save chart image">
          <Camera className="w-4 h-4" />
        </button>
        <button type="button" className={`${btn} shrink-0`} onClick={toggleFullscreen} title="Full screen">
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button type="button" className={`${btn} shrink-0 ${panelOpen ? btnOn : ""}`} onClick={() => setPanelOpen(!panelOpen)} title="Details panel">
          <PanelRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* ===== Drawing rail ===== */}
        <div className="w-11 shrink-0 border-r border-lq-line bg-lq-bg-2 flex flex-col items-center gap-0.5 py-1.5 overflow-y-auto overflow-x-visible">
          <button type="button" title="Cursor (Esc)" className={railBtn(tool === "cursor")} onClick={() => armTool("cursor")}>
            <MousePointer2 className="w-[18px] h-[18px]" />
          </button>
          {TOOL_GROUPS.map((g) => {
            const cur = g.tools.find((t) => t.id === groupTool[g.id]) || g.tools[0];
            const on = g.tools.some((t) => t.id === tool);
            return (
              <div key={g.id} className="relative group/tg">
                <button type="button" title={cur.label} className={railBtn(on)} onClick={() => armTool(cur.id)}>
                  <cur.icon className="w-[18px] h-[18px]" />
                </button>
                {g.tools.length > 1 && (
                  <button
                    type="button"
                    aria-label={`More ${g.label.toLowerCase()}`}
                    onClick={() => setOpenGroup(openGroup === g.id ? null : g.id)}
                    className="absolute right-0 bottom-0 w-3 h-3 flex items-center justify-center text-lq-muted hover:text-lq-gold"
                  >
                    <ChevronDown className="w-2.5 h-2.5 -rotate-45" />
                  </button>
                )}
                {openGroup === g.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenGroup(null)} />
                    <ul className="fixed z-50 m-0 p-1 list-none w-56 bg-lq-surface border border-lq-line-2 rounded-lg shadow-2xl" style={{ left: 52, marginTop: -36 }}>
                      <li className="px-2.5 pt-1.5 pb-1 lq-lbl text-[10px]">{g.label}</li>
                      {g.tools.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => armTool(t.id)}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] ${tool === t.id ? "text-lq-gold bg-lq-gold/10" : "text-lq-text-2 hover:bg-lq-surface-2"}`}
                          >
                            <t.icon className="w-4 h-4" />
                            <span className="flex-1 text-left">{t.label}</span>
                            {t.key && <kbd className="font-mono text-[10px] text-lq-muted">Alt+{t.key}</kbd>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
          <span className="w-6 h-px bg-lq-line my-1.5" />
          <button type="button" title="Magnet: snap to open/high/low/close" className={railBtn(magnet)} onClick={() => setMagnet(!magnet)}>
            <Magnet className="w-[18px] h-[18px]" />
          </button>
          <button type="button" title="Keep drawing mode after each drawing" className={railBtn(stayDraw)} onClick={() => setStayDraw(!stayDraw)}>
            <Pencil className="w-[18px] h-[18px]" />
          </button>
          <button type="button" title={locked ? "Unlock drawings" : "Lock drawings"} className={railBtn(locked)} onClick={() => setLocked(!locked)}>
            {locked ? <Lock className="w-[18px] h-[18px]" /> : <LockOpen className="w-[18px] h-[18px]" />}
          </button>
          <button type="button" title={drawingsHidden ? "Show drawings" : "Hide drawings"} className={railBtn(drawingsHidden)} onClick={() => setDrawingsHidden(!drawingsHidden)}>
            {drawingsHidden ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
          </button>
          <button
            type="button"
            title="Remove all drawings"
            className={railBtn(false)}
            onClick={() => drawings.length && window.confirm(`Remove all ${drawings.length} drawings on ${symbol}?`) && commitDrawings([])}
          >
            <Trash2 className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* ===== Chart ===== */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            ref={chartAreaRef}
            className="relative flex-1 min-h-0"
            onClickCapture={(e) => {
              if (!e.altKey) return;
              const p = chartRef.current?.lastCrosshairPrice();
              if (p && p > 0) updateAlerts([...alerts, Number(p.toFixed(digits))]);
            }}
          >
            <ChartCanvas
              ref={chartRef}
              bars={bars}
              step={step}
              dataKey={`${symbol}|${interval}`}
              intraday={intraday}
              chartType={chartType}
              scaleMode={scaleMode}
              indicators={indicators}
              showVolume={showVolume}
              priceDigits={digits}
              watermark={symbol}
              legendTitle={
                <span className="flex items-center gap-2 text-lq-text">
                  <span className="font-semibold">{symbol}</span>
                  <span className="text-lq-muted">· {intervalDef.long}{quote?.exchange ? ` · ${quote.exchange}` : ""}</span>
                </span>
              }
              alerts={alerts}
              tool={tool}
              magnet={magnet}
              stayInDrawMode={stayDraw}
              drawings={drawings}
              drawingsHidden={drawingsHidden}
              drawingsLocked={locked}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDrawingsChange={commitDrawings}
              onToolDone={() => setTool("cursor")}
              onEditText={(id) => setEditingText(id)}
              onEditIndicator={(id) => setEditingIndicator(id)}
              onRemoveIndicator={(id) => setIndicators((l) => l.filter((x) => x.uid !== id))}
              onToggleIndicator={(id) => setIndicators((l) => l.map((x) => (x.uid === id ? { ...x, hidden: !x.hidden } : x)))}
            />

            {/* Selected drawing toolbar */}
            {selected && !editing && (
              <div className="absolute z-20 top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-lq-surface/95 border border-lq-line-2 shadow-xl">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    onClick={() => commitDrawings(drawings.map((d) => (d.id === selected.id ? { ...d, color: c } : d)))}
                    className={`w-5 h-5 rounded-full border ${selected.color === c ? "border-lq-text" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
                <span className="w-px h-4 bg-lq-line mx-1" />
                {selected.type === "text" && (
                  <button type="button" title="Edit text" onClick={() => setEditingText(selected.id)} className="p-1 text-lq-text-2 hover:text-lq-text">
                    <PenLine className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  title="Reset colour"
                  onClick={() => commitDrawings(drawings.map((d) => (d.id === selected.id ? { ...d, color: DEFAULT_COLOR[d.type] } : d)))}
                  className="px-1.5 text-[11px] text-lq-muted hover:text-lq-text"
                >
                  Reset
                </button>
                <button type="button" title="Delete (Del)" onClick={removeSelected} className="p-1 text-lq-text-2 hover:text-lq-down">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Inline text editor for notes */}
            {editing && editPos && (
              <input
                autoFocus
                defaultValue={editing.text}
                className="absolute z-30 bg-lq-surface border border-lq-gold-line rounded px-2 py-1 text-[13px] text-lq-text outline-none w-56"
                style={{ left: editPos.x - 6, top: editPos.y - 22 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
                }}
                onBlur={(e) => {
                  const text = e.target.value.trim() || "Note";
                  commitDrawings(drawings.map((d) => (d.id === editing.id ? { ...d, text } : d)));
                  setEditingText(null);
                }}
              />
            )}

            {(loading || error) && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-lq-bg/60 pointer-events-none">
                {loading ? (
                  <span className="flex items-center gap-2 text-[12px] font-mono text-lq-muted">
                    <RefreshCw className="w-4 h-4 animate-spin text-lq-gold" /> Loading {symbol} · {intervalDef.long}
                  </span>
                ) : (
                  <span className="text-[13px] text-lq-text-2 max-w-sm text-center px-4">
                    Couldn't load {symbol}. {error}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ===== Bottom bar ===== */}
          <div className="h-9 shrink-0 border-t border-lq-line bg-lq-bg-2 flex items-center gap-1 px-2 overflow-x-auto">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => pickPreset(p)} className={`${btn} !h-7 font-mono shrink-0 ${activePreset === p.id ? btnOn : ""}`}>
                {p.id}
              </button>
            ))}
            <div className="flex-1" />
            {current?.source === "sample" && <span className="lq-tag shrink-0 mr-2">Sample data</span>}
            {mkt.label && (
              <span className="flex items-center gap-1.5 text-[11px] text-lq-muted shrink-0 mr-2">
                <span className={`w-1.5 h-1.5 rounded-full ${mkt.open ? "bg-lq-up" : "bg-lq-muted/60"}`} />
                {mkt.label}
              </span>
            )}
            {clock && (
              <span className="font-mono text-[11px] text-lq-text-2 shrink-0 mr-2 tabular-nums">
                {clock} {offsetLabel(tzSrc!.gmtOffset)}
              </span>
            )}
            <span className="w-px h-4 bg-lq-line mx-1 shrink-0" />
            {(["percent", "log"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setScaleMode(scaleMode === m ? "normal" : m)}
                className={`${btn} !h-7 font-mono shrink-0 ${scaleMode === m ? btnOn : ""}`}
                title={m === "log" ? "Logarithmic scale" : "Percent scale"}
              >
                {m === "log" ? "log" : "%"}
              </button>
            ))}
            <button type="button" onClick={() => setScaleMode("normal")} className={`${btn} !h-7 font-mono shrink-0 ${scaleMode === "normal" ? btnOn : ""}`} title="Regular price scale">
              auto
            </button>
            <button type="button" onClick={() => chartRef.current?.resetView()} className={`${btn} !h-7 shrink-0`} title="Reset view">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ===== Right panel ===== */}
        {panelOpen && (
          <aside className="hidden md:flex w-[300px] xl:w-[320px] shrink-0 border-l border-lq-line bg-lq-bg-2 flex-col overflow-y-auto">
            {quote ? (
              <InfoPanel
                quote={quote}
                daily={dailyBars}
                chartBars={bars}
                intervalLabel={intervalDef.long}
                digits={digits}
                ticker={ticker}
                alerts={alerts}
                onAddAlert={(p) => !alerts.includes(p) && updateAlerts([...alerts, p])}
                onRemoveAlert={(p) => updateAlerts(alerts.filter((a) => a !== p))}
                onTrade={(side) => setTicket(side)}
              />
            ) : (
              <div className="p-6 text-[12px] text-lq-muted">Loading quote…</div>
            )}
            <p className="mt-auto px-4 py-3 text-[10px] text-lq-muted/80 border-t border-lq-line m-0">
              Chart rendering by{" "}
              <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer" className="underline hover:text-lq-text-2">
                Lightweight Charts™
              </a>{" "}
              (Apache-2.0). Prices from Yahoo Finance, usually delayed.
            </p>
          </aside>
        )}
      </div>

      {pickerOpen && <IndicatorPicker active={indicators} onAdd={addIndicator} onClose={() => setPickerOpen(false)} />}
      {editingIndicator &&
        (() => {
          const inst = indicators.find((i) => i.uid === editingIndicator);
          return inst ? (
            <IndicatorSettings
              inst={inst}
              onClose={() => setEditingIndicator(null)}
              onSave={(params) => {
                setIndicators((l) => l.map((x) => (x.uid === inst.uid ? { ...x, params } : x)));
                setEditingIndicator(null);
              }}
            />
          ) : null;
        })()}
      {ticket && quote && (
        <TradeTicket
          symbol={symbol}
          price={quote.price}
          currencySymbol={quote.currencySymbol}
          initialSide={ticket}
          onClose={() => setTicket(null)}
          onSubmit={(side, orderType, qty, price) => {
            onTradeExecuted?.(symbol, side, orderType, qty, price);
            setTicket(null);
          }}
        />
      )}
    </div>
  );
}
