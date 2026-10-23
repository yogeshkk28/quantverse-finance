import React, { useEffect, useState, useMemo } from "react";
import { Ticker, HistoryPoint } from "../types";
import { Send, Sparkles, TrendingUp, TrendingDown, Layers, HelpCircle, Check, Play, ShieldAlert, Cpu, RefreshCw } from "lucide-react";

interface ChartsTabProps {
  tickers: Ticker[];
  activeTickerId: string;
  onSelectTicker: (tickerId: string) => void;
  onAlertMessage?: (msg: string) => void;
  onTradeExectued?: (ticker: string, side: "buy" | "sell", orderType: string, qty: number, price: number) => void;
}

export default function ChartsTab({ tickers, activeTickerId, onSelectTicker, onAlertMessage, onTradeExectued }: ChartsTabProps) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Overlays state
  const [bollingerActive, setBollingerActive] = useState<boolean>(true);
  const [ichimokuActive, setIchimokuActive] = useState<boolean>(false);
  const [vwapActive, setVwapActive] = useState<boolean>(false);
  const [sma50Active, setSma50Active] = useState<boolean>(true);
  const [sma200Active, setSma200Active] = useState<boolean>(false);

  // Tabs on Side Panel: "controls" | "fundamentals" | "financials" | "ai"
  const [activeSideTab, setActiveSideTab] = useState<"controls" | "fundamentals" | "financials" | "ai">("controls");

  // Timeframe choice
  const [timeframe, setTimeframe] = useState<string>("1W");

  // Indicator view tab: "rsi" | "macd" | "volume"
  const [activeIndicatorTab, setActiveIndicatorTab] = useState<"rsi" | "macd" | "volume">("rsi");

  // Gemini state and prompts
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Trade Modal overlay
  const [tradeModalOpen, setTradeModalOpen] = useState<boolean>(false);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<string>("limit");
  const [tradeQty, setTradeQty] = useState<number>(10);
  const [limitPrice, setLimitPrice] = useState<number>(0);

  // Retrieve current active ticker config
  const activeTicker = useMemo(() => {
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return { id: "NVDA", name: "NVIDIA Corporation", price: 875.28, chg: 2.45, volSurge: 1.8, pe: 74.2, mktCap: "2.18T", mktCapValue: 2180000000000, rsi: 72.4, roe: 38.5, sector: "Technology", beta: 1.62, macdCross: true, market: "US", currency: "$", source: "mock", delayed: true, fundamentalsSource: "sample", asOf: "" } as Ticker;
    }
    return tickers.find((t) => t.id === activeTickerId.toUpperCase()) || tickers[0];
  }, [tickers, activeTickerId]);

  // Handle Limit default price update
  useEffect(() => {
    if (activeTicker) {
      setLimitPrice(parseFloat(activeTicker.price.toFixed(2)));
    }
  }, [activeTicker]);

  // Fetch candles on mounting active ticker
  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        setLoading(true);
        const res = await fetch(`/api/chart/${activeTicker.id}`);
        const data = await res.json();
        if (active) {
          setHistory(data.history || []);
        }
      } catch (err) {
        console.error("Failed to load historical charts:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadHistory();
    return () => {
      active = false;
    };
  }, [activeTicker]);

  // Function to call Gemini server route
  const triggerAiModelAnalysis = async () => {
    try {
      setAiLoading(true);
      setAiAnalysis("");
      
      const activeOverlays = [];
      if (bollingerActive) activeOverlays.push("Bollinger Bands");
      if (ichimokuActive) activeOverlays.push("Ichimoku Cloud");
      if (vwapActive) activeOverlays.push("VWAP");
      if (sma50Active) activeOverlays.push("SMA 50");
      if (sma200Active) activeOverlays.push("SMA 200");

      const res = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: activeTicker.id,
          timeframe,
          overlays: activeOverlays,
          indicators: [activeIndicatorTab]
        })
      });

      const data = await res.json();
      if (data.error) {
        setAiAnalysis(`AI Analysis returned an error: ${data.error}`);
      } else {
        setAiAnalysis(data.analysis || "No strategic feedback provided.");
      }
    } catch (err: any) {
      setAiAnalysis(`Failed to connect to quantum analysis servers: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Re-trigger analysis when AI Tab is selected
  useEffect(() => {
    if (activeSideTab === "ai" && !aiAnalysis && !aiLoading) {
      triggerAiModelAnalysis();
    }
  }, [activeSideTab, activeTicker]);

  // Core drawing of Candlestick charts with pure React SVG
  const priceSvgContent = useMemo(() => {
    if (history.length === 0) return null;

    const width = 640;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 20, left: 45 };

    const prices = history.map(h => [h.high, h.low, h.open, h.close]).flat();
    const minPrice = Math.min(...prices) * 0.98;
    const maxPrice = Math.max(...prices) * 1.02;

    const getX = (index: number) => {
      return margin.left + (index / (history.length - 1)) * (width - margin.left - margin.right);
    };

    const getY = (priceValue: number) => {
      return height - margin.bottom - ((priceValue - minPrice) / (maxPrice - minPrice)) * (height - margin.top - margin.bottom);
    };

    // Calculate SMA lines mathematically
    const getSMAPoints = (period: number) => {
      const points = [];
      for (let i = 0; i < history.length; i++) {
        if (i < period) continue;
        let sum = 0;
        for (let j = i - period; j < i; j++) {
          sum += history[j].close;
        }
        points.push({ x: getX(i), y: getY(sum / period) });
      }
      return points;
    };

    const sma50Points = getSMAPoints(5); // Smaller window since dataset is 30 points
    const sma200Points = getSMAPoints(12);

    return {
      width,
      height,
      margin,
      getX,
      getY,
      minPrice,
      maxPrice,
      sma50Points,
      sma200Points,
    };
  }, [history]);

  // Execute quantitative trade
  const handleMarketExecuteTrade = (e: React.FormEvent) => {
    e.preventDefault();
    onTradeExectued?.(activeTicker.id, tradeSide, orderType, tradeQty, limitPrice);
    setTradeModalOpen(false);
    onAlertMessage?.(`Order standard log: ${tradeSide.toUpperCase()} ${tradeQty} of ${activeTicker.id} filled successfully.`);
  };

  return (
    <div className="flex-1 flex flex-col xl:flex-row w-full max-w-[1600px] mx-auto px-6 py-8 gap-6 font-sans">
      
      {/* LEFT PORTION: HEADER AND PRICE GRAPH */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        
        {/* Ticker Briefing Panel (Bento Container) */}
        <div className="bg-[#050505] border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-6 shadow-xl bg-gradient-to-b from-white/[0.03] to-transparent">
          
          {/* Company Briefing */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-[#D4AF37]/15 to-[#F5E6CA]/15 p-1 flex items-center justify-center border border-[#D4AF37]/20 select-none">
              <span className="font-serif font-light text-[#D4AF37] text-lg uppercase">
                {activeTicker.id.substring(0, 2)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-serif font-light text-[#F2F2F2] m-0 tracking-wide">{activeTicker.id}</h1>
                <span className="bg-[#D4AF37]/5 border border-[#D4AF37]/25 rounded px-2 py-0.5 text-[8px] font-mono text-[#D4AF37] font-bold tracking-widest uppercase">NASDAQ</span>
              </div>
              <p className="text-xs text-white/50 font-medium mt-1">{activeTicker.name}</p>
            </div>
          </div>

          {/* Pricing & Ratios display */}
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            
            {/* Live Price index */}
            <div className="text-right">
              <span className="text-3xl font-light font-sans text-[#F2F2F2] block tracking-tight">
                {activeTicker.currency}{activeTicker.price.toFixed(2)}
              </span>
              <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider rounded-sm px-2 py-0.5 mt-1 ${
                activeTicker.chg >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
              }`}>
                {activeTicker.chg >= 0 ? "▲" : "▼"} {activeTicker.chg.toFixed(2)}%
              </span>
              <span className="block font-mono text-[9px] tracking-wider text-white/35 mt-1 uppercase">
                {activeTicker.source === "finnhub" ? "Live · Finnhub" : activeTicker.source === "yahoo" ? "Delayed · Yahoo" : "Sample data"}
              </span>
            </div>

            {/* Core Ratios Metas */}
            <div className="hidden sm:flex gap-6 max-w-sm border-l border-white/10 pl-6 font-mono text-[10px] select-none">
              <div className="flex flex-col">
                <span className="tracking-[0.12em] text-white/40 uppercase font-bold">Beta (1Y)</span>
                <span className="text-white/80 mt-1 font-semibold">{activeTicker.beta}</span>
              </div>
              <div className="flex flex-col">
                <span className="tracking-[0.12em] text-white/40 uppercase font-bold">P/E Ratio</span>
                <span className="text-white/80 mt-1 font-semibold">{activeTicker.pe === null ? "—" : activeTicker.pe.toFixed(1)}</span>
              </div>
              <div className="flex flex-col">
                <span className="tracking-[0.12em] text-white/40 uppercase font-bold">RSI (14)</span>
                <span className="text-white/80 mt-1 font-semibold">{activeTicker.rsi}</span>
              </div>
            </div>

          </div>

        </div>

        {/* Primary Interactive Chart Canvas */}
        <div className="bg-[#050505] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-xl select-none relative">
          
          {/* Chart Header Bar */}
          <div className="flex flex-wrap justify-between items-center px-4 py-3 bg-black/80 border-b border-white/10 gap-3">
            {/* Timeframe Selectors */}
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold">
              {["1D", "1W", "1M", "3M", "1Y", "ALL"].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                    timeframe === tf
                      ? "bg-[#D4AF37] text-black border border-[#D4AF37]"
                      : "text-white/55 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Indicator overlays shortcuts */}
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold bg-white/[0.02] px-3 py-1.5 border border-white/5 rounded-lg text-white/50">
              <span className="tracking-wider text-white/30 uppercase mr-1">Toggles:</span>
              <button 
                onClick={() => setBollingerActive(!bollingerActive)}
                className={`transition-colors cursor-pointer ${bollingerActive ? "text-[#D4AF37] font-bold" : "hover:text-[#F2F2F2]"}`}
              >
                Bollinger
              </button>
              <span className="opacity-10 border-r border-[#fff] h-3"></span>
              <button 
                onClick={() => setIchimokuActive(!ichimokuActive)}
                className={`transition-colors cursor-pointer ${ichimokuActive ? "text-[#D4AF37] font-bold" : "hover:text-[#F2F2F2]"}`}
              >
                Ichimoku
              </button>
              <span className="opacity-10 border-r border-[#fff] h-3"></span>
              <button 
                onClick={() => setVwapActive(!vwapActive)}
                className={`transition-colors cursor-pointer ${vwapActive ? "text-[#D4AF37] font-bold" : "hover:text-[#F2F2F2]"}`}
              >
                VWAP
              </button>
            </div>
          </div>

          {/* Canvas Plotting */}
          <div className="flex-1 w-full bg-black/60 border-b border-white/5 p-4 flex items-center justify-center relative min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center gap-2.5 font-mono text-xs text-white/40">
                <RefreshCw className="w-5 h-5 animate-spin text-[#D4AF37]" />
                <span>Simulating pricing ticks & candlesticks...</span>
              </div>
            ) : priceSvgContent ? (
              <svg 
                className="w-full h-full max-h-[340px]" 
                viewBox={`0 0 ${priceSvgContent.width} ${priceSvgContent.height}`}
                preserveAspectRatio="none"
              >
                {/* Horizontal gridlines */}
                {[0.2, 0.4, 0.6, 0.8].map((ratio, gridIdx) => {
                  const yVal = priceSvgContent.margin.top + ratio * (priceSvgContent.height - priceSvgContent.margin.top - priceSvgContent.margin.bottom);
                  const priceLabel = priceSvgContent.maxPrice - ratio * (priceSvgContent.maxPrice - priceSvgContent.minPrice);
                  return (
                    <g key={gridIdx}>
                      <line 
                        x1={priceSvgContent.margin.left} 
                        y1={yVal} 
                        x2={priceSvgContent.width - priceSvgContent.margin.right} 
                        y2={yVal} 
                        stroke="rgba(255,255,255,0.03)" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={priceSvgContent.margin.left - 8} 
                        y={yVal + 3} 
                        fill="rgba(255,255,255,0.25)" 
                        className="font-mono text-[8px] font-bold" 
                        textAnchor="end"
                      >
                        {activeTicker.currency}{priceLabel.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* Bollinger Bands Overlay Path */}
                {bollingerActive && (
                  <g>
                    {/* Bollinger upper band */}
                    <path
                      d={`M ${history.map((h, i) => `${priceSvgContent.getX(i)},${priceSvgContent.getY(h.high * 1.012)}`).join(" L ")}`}
                      fill="none"
                      stroke="rgba(212,175,55,0.3)"
                      strokeWidth="1.2"
                      strokeDasharray="4 2"
                    />
                    {/* Bollinger lower band */}
                    <path
                      d={`M ${history.map((h, i) => `${priceSvgContent.getX(i)},${priceSvgContent.getY(h.low * 0.988)}`).join(" L ")}`}
                      fill="none"
                      stroke="rgba(212,175,55,0.3)"
                      strokeWidth="1.2"
                      strokeDasharray="4 2"
                    />
                  </g>
                )}

                {/* Ichimoku Cloud representation */}
                {ichimokuActive && (
                  <path
                    d={`M ${history.map((h, i) => `${priceSvgContent.getX(i)},${priceSvgContent.getY(h.close * 1.008)}`).join(" L ")} 
                        L ${[...history].reverse().map((h, i) => `${priceSvgContent.getX(history.length - 1 - i)},${priceSvgContent.getY(h.close * 0.992)}`).join(" L ")} Z`}
                    fill="rgba(212,175,55,0.03)"
                    stroke="none"
                  />
                )}

                {/* VWAP Overlay Line */}
                {vwapActive && (
                  <path
                    d={`M ${history.map((h, i) => `${priceSvgContent.getX(i)},${priceSvgContent.getY((h.high + h.low + h.close) / 3)}`).join(" L ")}`}
                    fill="none"
                    stroke="#D4AF37"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    className="opacity-60"
                  />
                )}

                {/* SMA 50 Line */}
                {sma50Active && priceSvgContent.sma50Points.length > 0 && (
                  <path
                    d={`M ${priceSvgContent.sma50Points.map(p => `${p.x},${p.y}`).join(" L ")}`}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                    className="opacity-70"
                  />
                )}

                {/* SMA 200 Line */}
                {sma200Active && priceSvgContent.sma200Points.length > 0 && (
                  <path
                    d={`M ${priceSvgContent.sma200Points.map(p => `${p.x},${p.y}`).join(" L ")}`}
                    fill="none"
                    stroke="#fb923c"
                    strokeWidth="1.2"
                    className="opacity-70"
                  />
                )}

                {/* Candlesticks loop */}
                {history.map((candle, idx) => {
                  const x = priceSvgContent.getX(idx);
                  const oY = priceSvgContent.getY(candle.open);
                  const cY = priceSvgContent.getY(candle.close);
                  const hY = priceSvgContent.getY(candle.high);
                  const lY = priceSvgContent.getY(candle.low);

                  const isBull = candle.close >= candle.open;
                  const strokeColor = isBull ? "#22c55e" : "#ef4444";
                  const fillColor = isBull ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.3)";

                  return (
                    <g key={idx} className="hover:opacity-80 transition-opacity">
                      {/* Wick Line */}
                      <line x1={x} y1={hY} x2={x} y2={lY} stroke={strokeColor} strokeWidth="1" />
                      {/* Candle Body Rect */}
                      <rect
                        x={x - 4}
                        y={Math.min(oY, cY)}
                        width="8"
                        height={Math.max(1.5, Math.abs(oY - cY))}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth="1"
                      />
                    </g>
                  );
                })}
              </svg>
            ) : (
              <span className="text-white/30 text-xs font-serif">Pricing history unavailable.</span>
            )}

            {/* Watermark detail */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 opacity-20 select-none pointer-events-none">
              <Cpu className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
              <span className="font-mono text-[8px] tracking-[0.15em] text-[#fff] uppercase font-bold">
                {activeTicker.id} 1W REALTIME GRAPH PLOT
              </span>
            </div>
          </div>

          {/* Indicator choice pane */}
          <div className="bg-black/40 border-t border-white/5 flex flex-col">
            <div className="flex border-b border-white/5 bg-[#050505] px-4 font-mono text-[9px] font-semibold text-white/40 uppercase">
              {[
                { id: "rsi", label: "RSI (14)" },
                { id: "macd", label: "MACD" },
                { id: "volume", label: "Volume" }
              ].map((indTab) => (
                <button
                  key={indTab.id}
                  onClick={() => setActiveIndicatorTab(indTab.id as any)}
                  className={`py-2.5 px-4 transition-colors font-bold tracking-widest cursor-pointer ${
                    activeIndicatorTab === indTab.id
                      ? "text-[#D4AF37] border-b border-[#D4AF37] font-black"
                      : "hover:text-white"
                  }`}
                >
                  {indTab.label}
                </button>
              ))}
            </div>

            {/* Drawn indicator SVG plotting */}
            <div className="h-28 bg-black/80 p-4 flex items-center justify-center relative overflow-hidden">
              {loading ? (
                <span className="text-white/20 font-mono text-[9px]">Processing indicators...</span>
              ) : priceSvgContent && history.length > 0 ? (
                <svg
                  className="w-full h-full"
                  viewBox={`0 0 ${priceSvgContent.width} 80`}
                  preserveAspectRatio="none"
                >
                  {activeIndicatorTab === "rsi" && (
                    <g>
                      {/* RSI 30 & 70 extreme markers */}
                      <line x1={priceSvgContent.margin.left} y1="24" x2={priceSvgContent.width} y2="24" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1={priceSvgContent.margin.left} y1="56" x2={priceSvgContent.width} y2="56" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
                      
                      <text x={priceSvgContent.margin.left - 6} y="26" fill="rgba(255,255,255,0.2)" className="font-mono text-[8px]" textAnchor="end">70</text>
                      <text x={priceSvgContent.margin.left - 6} y="58" fill="rgba(255,255,255,0.2)" className="font-mono text-[8px]" textAnchor="end">30</text>

                      {/* RSI line plotting */}
                      <path
                        d={`M ${history.map((h, i) => `${priceSvgContent.getX(i)},${80 - (h.rsi / 100) * 80}`).join(" L ")}`}
                        fill="none"
                        stroke="#D4AF37"
                        strokeWidth="1.2"
                      />
                    </g>
                  )}

                  {activeIndicatorTab === "macd" && (
                    <g>
                      {/* Zero base line */}
                      <line x1={priceSvgContent.margin.left} y1="40" x2={priceSvgContent.width} y2="40" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      
                      {/* Histogram bars */}
                      {history.map((h, idx) => {
                        const x = priceSvgContent.getX(idx);
                        const hY = 40 - (h.histogram * 3);
                        return (
                          <line
                            key={idx}
                            x1={x}
                            y1="40"
                            x2={x}
                            y2={hY}
                            stroke={h.histogram >= 0 ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}
                            strokeWidth="3.5"
                          />
                        );
                      })}

                      {/* MACD active lines */}
                      <path
                        d={`M ${history.map((h, i) => `${priceSvgContent.getX(i)},${40 - (h.macd * 3)}`).join(" L ")}`}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="1"
                        className="opacity-75"
                      />
                      <path
                        d={`M ${history.map((h, i) => `${priceSvgContent.getX(i)},${40 - (h.signal * 3)}`).join(" L ")}`}
                        fill="none"
                        stroke="#fb923c"
                        strokeWidth="1"
                        className="opacity-75"
                      />
                    </g>
                  )}

                  {activeIndicatorTab === "volume" && (
                    <g>
                      {history.map((h, idx) => {
                        const x = priceSvgContent.getX(idx);
                        const volHeight = (h.volume / 2000000) * 60; // Max volume approximation
                        const candle = history[idx];
                        const barColor = candle.close >= candle.open ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)";
                        return (
                          <rect
                            key={idx}
                            x={x - 3.5}
                            y={80 - volHeight}
                            width="7"
                            height={volHeight}
                            fill={barColor}
                          />
                        );
                      })}
                    </g>
                  )}
                </svg>
              ) : null}
            </div>
          </div>

        </div>

      </div>

      {/* RIGHT PORTION: QUANT ANALYSIS CONSOLE */}
      <aside className="w-full xl:w-80 flex-shrink-0 flex flex-col bg-[#050505] border border-white/10 rounded-2xl overflow-hidden shadow-xl min-h-[500px]">
        
        {/* Console Header */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3 select-none">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          <div>
            <h2 className="text-[#F2F2F2] font-serif font-light text-sm tracking-wide m-0">Analysis Console</h2>
            <span className="text-[8px] text-[#D4AF37] font-mono tracking-[0.18em] block uppercase font-bold mt-1">Terminal Active</span>
          </div>
        </div>

        {/* Sidebar Nav Tabs */}
        <div className="flex border-b border-white/15 bg-black/60 text-[9px] font-mono font-bold text-white/40 uppercase select-none">
          {[
            { id: "controls", label: "Controls" },
            { id: "fundamentals", label: "Fundamentals" },
            { id: "financials", label: "Financials" },
            { id: "ai", label: "AI Intel" }
          ].map((sTab) => (
            <button
              key={sTab.id}
              onClick={() => setActiveSideTab(sTab.id as any)}
              className={`flex-1 py-3 text-center border-r border-white/10 last:border-0 truncate transition-colors cursor-pointer ${
                activeSideTab === sTab.id ? "text-[#D4AF37] bg-white/[0.03] font-bold" : "hover:text-white"
              }`}
            >
              {sTab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents Frame */}
        <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
          
          {activeSideTab === "controls" && (
            <div className="flex flex-col gap-4">
              
              {/* Overlays config */}
              <div className="bg-black/60 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
                <span className="font-mono text-[9px] tracking-wider text-white/45 uppercase font-bold">Overlays</span>
                
                <div className="flex flex-col gap-2.5">
                  {[
                    { id: "bollinger", label: "Bollinger Bands", active: bollingerActive, setter: setBollingerActive },
                    { id: "ichimoku", label: "Ichimoku Cloud", active: ichimokuActive, setter: setIchimokuActive },
                    { id: "vwap", label: "VWAP Line", active: vwapActive, setter: setVwapActive }
                  ].map((overlay) => (
                    <label 
                      key={overlay.id} 
                      className="flex items-center gap-2.5 cursor-pointer group"
                    >
                      <input 
                        type="checkbox"
                        checked={overlay.active}
                        onChange={(e) => overlay.setter(e.target.checked)}
                        className="rounded border-white/20 bg-black text-[#D4AF37] focus:ring-[#D4AF37]/30 w-4 h-4 cursor-pointer accent-[#D4AF37]"
                      />
                      <span className="text-xs text-[#F2F2F2]/60 font-medium group-hover:text-[#D4AF37] transition-colors">
                        {overlay.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Moving Averages config */}
              <div className="bg-black/60 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
                <span className="font-mono text-[9px] tracking-wider text-white/45 uppercase font-bold">Moving Averages</span>
                
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={sma50Active}
                        onChange={(e) => setSma50Active(e.target.checked)}
                        className="rounded border-white/20 bg-black text-[#D4AF37] focus:ring-[#D4AF37]/30 w-4 h-4 cursor-pointer accent-[#D4AF37]"
                      />
                      <span className="text-white/60 group-hover:text-[#D4AF37] transition-colors">SMA 50</span>
                    </label>
                    <span className="w-8 h-1 bg-blue-500 rounded-full inline-block" />
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={sma200Active}
                        onChange={(e) => setSma200Active(e.target.checked)}
                        className="rounded border-white/20 bg-black text-[#D4AF37] focus:ring-[#D4AF37]/30 w-4 h-4 cursor-pointer accent-[#D4AF37]"
                      />
                      <span className="text-white/60 group-hover:text-[#D4AF37] transition-colors">SMA 200</span>
                    </label>
                    <span className="w-8 h-1 bg-[#fb923c] rounded-full inline-block" />
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeSideTab === "fundamentals" && (
            <div className="flex flex-col gap-3 font-mono text-[11px]">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Asset sector</span>
                <span className="text-[#F2F2F2] font-semibold">{activeTicker.sector}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">ROE %</span>
                <span className="text-[#F2F2F2] font-semibold">{activeTicker.roe === null ? "—" : `${activeTicker.roe}%`}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">P/E (TTM)</span>
                <span className="text-[#F2F2F2] font-semibold">{activeTicker.pe ?? "—"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Volume Surge</span>
                <span className="text-[#F2F2F2] font-semibold">{activeTicker.volSurge}x</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Beta Coeff</span>
                <span className="text-[#F2F2F2] font-semibold">{activeTicker.beta}</span>
              </div>
            </div>
          )}

          {activeSideTab === "financials" && (
            <div className="flex flex-col gap-3 font-mono text-[11px]">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Revenue (Sim TTM)</span>
                <span className="text-[#F2F2F2] font-semibold">$12.45B</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Gross Margin</span>
                <span className="text-[#F2F2F2] font-semibold">68.42%</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Operating Income</span>
                <span className="text-[#F2F2F2] font-semibold">$3.85B</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">Debt/Equity</span>
                <span className="text-[#F2F2F2] font-semibold">0.45</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/40">EPS (TTM)</span>
                <span className="text-[#F2F2F2] font-semibold">$4.85</span>
              </div>
            </div>
          )}

          {activeSideTab === "ai" && (
            <div className="flex-1 flex flex-col justify-between">
              
              <div className="flex-1 overflow-y-auto max-h-[190px] mb-3">
                {aiLoading ? (
                  <div className="flex flex-col items-center gap-3 text-center text-white/30 p-4 font-mono text-[10px]">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                    <span>Gemini analyzing quantitative variables and computing strategic risk-stop model...</span>
                  </div>
                ) : aiAnalysis ? (
                  <div className="text-xs text-[#F2F2F2]/80 leading-relaxed text-left max-w-full overflow-hidden select-text whitespace-pre-line font-sans p-1">
                    {aiAnalysis}
                  </div>
                ) : (
                  <div className="text-xs text-white/30 text-center py-8 font-sans">
                    No strategic intelligence computed. Trigger analysis to load live.
                  </div>
                )}
              </div>

              <button
                onClick={triggerAiModelAnalysis}
                disabled={aiLoading}
                className="w-full bg-[#0d0d0d] hover:bg-white/[0.04] border border-white/10 text-[#D4AF37] py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-2 backdrop-blur-md active:scale-95 duration-200 transition-all cursor-pointer font-sans"
              >
                <Sparkles className="w-4 h-4 text-[#D4AF37]" /> 
                {aiLoading ? "Modeling..." : "Trigger AI Strategy"}
              </button>

            </div>
          )}

        </div>

        {/* Console Action bottom trigger (Execute Trade) */}
        <div className="p-4 border-t border-white/10 select-none">
          <button
            onClick={() => setTradeModalOpen(true)}
            className="w-full bg-gradient-to-tr from-[#D4AF37] to-[#F5E6CA] hover:opacity-90 text-black font-semibold py-3 px-4 rounded-xl transition-all shadow-[0_4px_16px_rgba(212,175,55,0.2)] flex justify-center items-center gap-2 duration-300 scale-100 hover:scale-[1.01] active:scale-98 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-black" />
            <span className="font-semibold uppercase tracking-widest text-[10px]">Execute Trade</span>
          </button>
        </div>

      </aside>

      {/* QUICK QUANTITATIVE TRADING MODAL */}
      {tradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md select-none font-sans px-4">
          <div className="bg-[#050505] border border-white/15 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl flex flex-col gap-4">
            
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4.5 h-4.5 text-[#D4AF37]" />
                <h3 className="font-serif font-light text-base text-[#F2F2F2] uppercase tracking-wide">Limit Order Entry</h3>
              </div>
              <button 
                onClick={() => setTradeModalOpen(false)}
                className="text-white/40 hover:text-white transition-colors text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMarketExecuteTrade} className="flex flex-col gap-4">
              
              {/* Buy Sell toggle */}
              <div className="grid grid-cols-2 gap-2 bg-black p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setTradeSide("buy")}
                  className={`py-2 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer ${
                    tradeSide === "buy" ? "bg-[#D4AF37] text-black shadow-lg" : "text-white/40 hover:text-white"
                  }`}
                >
                  Buy / Long
                </button>
                <button
                  type="button"
                  onClick={() => setTradeSide("sell")}
                  className={`py-2 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer ${
                    tradeSide === "sell" ? "bg-red-500 text-white shadow-lg" : "text-white/40 hover:text-white"
                  }`}
                >
                  Sell / Short
                </button>
              </div>

              {/* Order type */}
              <div>
                <label className="font-mono text-[9px] tracking-wider text-white/40 block mb-1 uppercase font-bold">Execution Type</label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg text-xs p-2.5 text-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none cursor-pointer"
                >
                  <option value="limit">Limit Order</option>
                  <option value="market">Market Order</option>
                  <option value="stop_loss">Stop Loss</option>
                </select>
              </div>

              {/* Limit Price */}
              {orderType === "limit" && (
                <div>
                  <label className="font-mono text-[9px] tracking-wider text-white/40 block mb-1 uppercase font-bold">Limit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black border border-white/10 rounded-lg text-xs p-2.5 text-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none"
                  />
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className="font-mono text-[9px] tracking-wider text-white/40 block mb-1 uppercase font-bold">Quantity (Shares)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={tradeQty}
                  onChange={(e) => setTradeQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-black border border-white/10 rounded-lg text-xs p-2.5 text-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none"
                />
              </div>

              {/* Portfolio summary estimation */}
              <div className="bg-black/40 p-3 rounded-lg border border-white/5 font-mono text-[10px] text-white/40 flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>Gross Cost Estimation:</span>
                  <span className="text-white/80">${(tradeQty * (orderType === "limit" ? limitPrice : activeTicker.price)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Brokerage Fees:</span>
                  <span className="text-cyan-400">$0.00 (Zero Fee)</span>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full font-semibold py-3 rounded-full uppercase text-[10px] tracking-widest transition-opacity hover:opacity-90 cursor-pointer font-sans mt-2 shadow-[0_4px_12px_rgba(212,175,55,0.15)] ${
                  tradeSide === "buy" ? "bg-gradient-to-tr from-[#D4AF37] to-[#F5E6CA] text-black" : "bg-red-500 text-white"
                }`}
              >
                Transmit order to clearing desk
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
