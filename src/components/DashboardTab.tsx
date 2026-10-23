import React, { useEffect, useRef, useState } from "react";
import { Ticker } from "../types";
import { TrendingUp, TrendingDown, RefreshCw, Layers, ShieldAlert, Award, Zap } from "lucide-react";

interface DashboardTabProps {
  tickers: Ticker[];
  onSelectTicker: (tickerId: string) => void;
}

export default function DashboardTab({ tickers, onSelectTicker }: DashboardTabProps) {
  // Quote cycling matching screenshot behaviour
  const quotes = [
    "Information is the first investment.",
    "Every insight adds a little more edge to your portfolio.",
    "Markets move on data. Conviction moves on understanding it."
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const qInterval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 6000);
    return () => clearInterval(qInterval);
  }, []);

  // WebGL Shader Animation Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return;

    // Resize handling
    const resizeCanvas = () => {
      const w = canvas.parentElement?.clientWidth || 800;
      const h = canvas.parentElement?.clientHeight || 450;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      varying vec2 v_texCoord;

      void main() {
        vec2 uv = v_texCoord;
        float d1 = 1.0 - length(uv - vec2(0.5 + 0.3 * sin(u_time * 0.5), 0.5 + 0.2 * cos(u_time * 0.3))) * 2.0;
        float d2 = 1.0 - length(uv - vec2(0.3 + 0.25 * cos(u_time * 0.4), 0.4 + 0.3 * sin(u_time * 0.6))) * 1.5;
        float noise = clamp(d1 + d2, 0.0, 1.0);

        // Sophisticated Dark Luxury Gold to Cream gradients
        vec3 color1 = vec3(0.83, 0.68, 0.21); // #D4AF37 Gold
        vec3 color2 = vec3(0.96, 0.90, 0.79); // #F5E6CA Cream
        vec3 bg = vec3(0.02, 0.02, 0.02);     // #050505 Deep Luxury Black

        vec3 mixedColor = mix(bg, mix(color1, color2, uv.y), noise * 0.45);
        gl_FragColor = vec4(mixedColor, 1.0);
      }
    `;

    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posAttr = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRes = gl.getUniformLocation(program, "u_resolution");

    let animationFrameId: number;
    const render = (time: number) => {
      gl.uniform1f(uTime, time * 0.001);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationFrameId = requestAnimationFrame(render);
    };
    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Live Real-time simulation of Quantitative Trading Feed
  const [newsSignals, setNewsSignals] = useState([
    { id: 1, time: "10:42 AM", type: "BULLISH", text: "Unusual options volume detected in NVDA 900 CE. Volume spike +340% above normal levels.", active: true },
    { id: 2, time: "10:15 AM", type: "BEARISH", text: "Macro inflation read printed slightly hotter than consensus. Core CPI 3.4% YoY vs 3.3% expected.", active: true },
    { id: 3, time: "09:30 AM", type: "NEUTRAL", text: "NYSE Opening breadth positive (+65% advancing issues). Volume remains concentrated in mega caps.", active: true },
  ]);

  const [fearGreed, setFearGreed] = useState<{ value: number; classification: string }>({ value: 72, classification: "GREED" });
  const [macroInfo, setMacroInfo] = useState<any>(null);

  useEffect(() => {
    // Call the endpoints setup in routes.ts
    fetch("/api/fear-greed")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        if (data && typeof data.value === "number") {
          setFearGreed({ value: data.value, classification: data.classification });
        }
      })
      .catch(() => {});

    fetch("/api/macro")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        if (data) setMacroInfo(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const symbols = ["NVDA", "AAPL", "MSFT", "TSLA", "AMD", "LLY", "XOM", "RELIANCE"];
    const actions = ["block trade executed", "breakout from consolidation channel", "MA cross detected on 15m interval", "order book size imbalance observed"];

    const intervalVal = setInterval(() => {
      const matchedSym = symbols[Math.floor(Math.random() * symbols.length)];
      const matchedAct = actions[Math.floor(Math.random() * actions.length)];
      const matchedType = Math.random() > 0.5 ? "BULLISH" : "BEARISH";
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newAlert = {
        id: Date.now(),
        time: timeStr,
        type: matchedType,
        text: `Automated Quant Alert: ${matchedSym} ${matchedType === "BULLISH" ? "positive" : "negative"} ${matchedAct}. Check chart terminal for verification.`
      };

      setNewsSignals((prev) => [newAlert, ...prev.slice(0, 5)]);
    }, 12000);

    return () => clearInterval(intervalVal);
  }, []);

  // Sort tickers to display top gainers / premium movers
  const topGainers = Array.isArray(tickers)
    ? [...tickers].sort((a, b) => b.chg - a.chg).slice(0, 5)
    : [];

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1600px] mx-auto px-6 py-8 font-sans">
      
      {/* SECTION 1: HERO SHADER WITH QUOTE ROTATION */}
      <section className="relative h-[280px] w-full rounded-2xl overflow-hidden border border-white/15 flex items-center justify-center p-8 select-none bg-[#050505]">
        
        {/* Animated shader backdrop */}
        <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
        
        {/* Luminous overlay for high contrast readability */}
        <div className="absolute inset-0 bg-black/55 z-0"></div>

        {/* Dynamic rotating quote overlay */}
        <div className="relative z-10 text-center max-w-4xl px-4 flex flex-col items-center justify-center">
          <span className="font-mono text-[10px] tracking-[0.4em] text-[#D4AF37] font-bold mb-5 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" /> LUMINA QUANT STRATEGIC INTEL
          </span>
          <h1 className="text-xl md:text-2xl lg:text-3.5xl font-light font-serif italic text-[#F2F2F2] leading-relaxed transition-all duration-1000 ease-out select-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            "{quotes[quoteIndex]}"
          </h1>
        </div>

        {/* Scroll notification hint */}
        <div className="absolute bottom-4 flex items-center gap-1.5 opacity-70 text-white/50 text-[10px]">
          <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="font-mono tracking-[0.2em]">CORE INTEGRITY ONLINE</span>
        </div>
      </section>

      {/* INFINITE INDEX TICKER */}
      <div className="w-full bg-black border-y border-white/10 py-3.5 overflow-hidden select-none">
        <div className="animate-ticker-loop flex gap-16 font-mono text-[11px] uppercase tracking-[0.15em] text-white/50">
          {/* Double elements to form a seamless infinite loop scrolling effect */}
          {[1, 2].map((loopIdx) => (
            <React.Fragment key={loopIdx}>
              <span className="flex items-center gap-3.5 whitespace-nowrap">
                <span className="font-bold text-[#F2F2F2] font-serif italic normal-case">Nifty 50</span>
                <span className="text-white/80">22,453.30</span>
                <span className="text-[#D4AF37] font-semibold flex items-center gap-1">
                  +1.20% <TrendingUp className="w-3 h-3" />
                </span>
              </span>
              <span className="flex items-center gap-3.5 whitespace-nowrap">
                <span className="font-bold text-[#F2F2F2] font-serif italic normal-case">S&P 500</span>
                <span className="text-white/80">5,147.21</span>
                <span className="text-red-400 font-semibold flex items-center gap-1">
                  -0.40% <TrendingDown className="w-3 h-3" />
                </span>
              </span>
              <span className="flex items-center gap-3.5 whitespace-nowrap">
                <span className="font-bold text-[#F2F2F2] font-serif italic normal-case">Nasdaq 100</span>
                <span className="text-white/80">18,120.45</span>
                <span className="text-[#D4AF37] font-semibold flex items-center gap-1">
                  +0.85% <TrendingUp className="w-3 h-3" />
                </span>
              </span>
              <span className="flex items-center gap-3.5 whitespace-nowrap">
                <span className="font-bold text-[#F2F2F2] font-serif italic normal-case">Gold Spot</span>
                <span className="text-white/80">$2,165.40</span>
                <span className="text-[#D4AF37] font-semibold flex items-center gap-1">
                  +0.80% <TrendingUp className="w-3 h-3" />
                </span>
              </span>
              <span className="flex items-center gap-3.5 whitespace-nowrap">
                <span className="font-bold text-[#F2F2F2] font-serif italic normal-case">BTC/USD</span>
                <span className="text-white/80">$68,432.10</span>
                <span className="text-[#D4AF37] font-semibold flex items-center gap-1">
                  +3.50% <TrendingUp className="w-3 h-3" />
                </span>
              </span>
              <span className="flex items-center gap-3.5 whitespace-nowrap">
                <span className="font-bold text-[#F2F2F2] font-serif italic normal-case">Nifty Bank</span>
                <span className="text-white/80">47,321.50</span>
                <span className="text-[#D4AF37] font-semibold flex items-center gap-1">
                  +0.90% <TrendingUp className="w-3 h-3" />
                </span>
              </span>
              <span className="flex items-center gap-3.5 whitespace-nowrap">
                <span className="font-bold text-[#F2F2F2] font-serif italic normal-case">Crude Oil</span>
                <span className="text-white/80">$81.24</span>
                <span className="text-[#D4AF37] font-semibold flex items-center gap-1">
                  +1.50% <TrendingUp className="w-3 h-3" />
                </span>
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* SECTION 2 & 3: DETAILS BENTO MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* S&P 500 Market Sentiment (Bento 1 - Greed Gauge) */}
        <div className="lg:col-span-4 bg-[#050505] border border-white/10 p-6 rounded-2xl flex flex-col justify-between items-center relative overflow-hidden bg-gradient-to-b from-white/[0.03] to-transparent">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-[#D4AF37]" />
          
          <div className="w-full flex items-center justify-between mb-4">
            <span className="font-mono text-[9px] text-[#D4AF37] tracking-[0.25em] font-bold">QUANT INDICATORS</span>
            <span className="text-[10px] uppercase tracking-wider text-white/40">Fear & Greed</span>
          </div>

          <h3 className="font-serif text-lg font-light text-[#F2F2F2] tracking-wide">Market Sentiment</h3>

          {/* Semi-circle dial representation */}
          <div className="relative w-48 h-24 mt-6 overflow-hidden">
            {/* The circular color boundaries */}
            <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[14px] border-white/5 box-border" />
            
            {/* Value fill representing dynamic Greed */}
            <svg className="absolute top-0 left-0 w-48 h-48" viewBox="0 0 100 100">
              <path 
                d="M 10 50 A 40 40 0 1 1 90 50" 
                fill="none" 
                stroke="rgba(255,255,255,0.03)" 
                strokeWidth="8" 
              />
              <path 
                d="M 10 50 A 40 40 0 1 1 90 50" 
                fill="none" 
                stroke="url(#sentimentGrad)" 
                strokeWidth="8" 
                strokeDasharray="125" 
                strokeDashoffset={125 - (125 * fearGreed.value) / 100}
              />
              <defs>
                <linearGradient id="sentimentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="60%" stopColor="#D4AF37" />
                  <stop offset="100%" stopColor="#F5E6CA" />
                </linearGradient>
              </defs>
            </svg>

            {/* Needle */}
            <div 
              className="absolute bottom-0 left-11/12 w-1 h-15 bg-[#D4AF37] rounded-full transform origin-bottom -translate-x-1/2 transition-transform duration-1000"
              style={{ transform: `rotate(${(fearGreed.value / 100) * 180 - 90}deg)` }}
            />
            {/* Pin */}
            <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-black rounded-full transform -translate-x-1/2 translate-y-1/2 border-2 border-[#D4AF37]" />
          </div>

          <div className="text-center mt-4">
            <span className="text-4xl font-serif font-light text-[#D4AF37] block tracking-tight">{fearGreed.value}</span>
            <span className="font-mono text-[9px] text-[#D4AF37] tracking-[0.25em] font-bold uppercase mt-1 inline-block">{fearGreed.classification}</span>
          </div>

          <p className="text-[11px] text-white/50 text-center mt-4 pt-4 border-t border-white/5 w-full leading-relaxed font-light">
            {macroInfo 
              ? `Real-world economic data (FRED): Fed Rates: ${macroInfo.interestRate.value}${macroInfo.interestRate.unit} | YoY CPI: ${macroInfo.inflationRate.value}${macroInfo.inflationRate.unit} | GDP Change: ${macroInfo.gdpGrowth.value}${macroInfo.gdpGrowth.unit} | Unrate: ${macroInfo.unemployment.value}${macroInfo.unemployment.unit}.`
              : "Technical indices indicate high institutional momentum. Standard deviations point to steady continuation of current trends."}
          </p>
        </div>

        {/* Nifty 50 Top Movers (Bento 2) */}
        <div className="lg:col-span-4 bg-[#050505] border border-white/10 p-6 rounded-2xl flex flex-col justify-between bg-gradient-to-b from-white/[0.03] to-transparent">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-[9px] text-[#D4AF37] tracking-[0.25em] font-bold">SYS CORE SCREEN</span>
              <span className="text-[10px] uppercase tracking-wider text-white/40">Constituents</span>
            </div>
            <h3 className="font-serif text-lg font-light text-[#F2F2F2] tracking-wide mb-6">Top Market Movers</h3>
            
            <div className="flex flex-col gap-3">
              {topGainers.map((t) => {
                const isBull = t.chg >= 0;
                return (
                  <div 
                    key={t.id} 
                    onClick={() => onSelectTicker(t.id)}
                    className="flex justify-between items-center py-2.5 px-3 rounded-xl hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-200 cursor-pointer group"
                  >
                    <div>
                      <span className="font-serif font-light text-[#F2F2F2] group-hover:text-[#D4AF37] transition-colors block text-sm">{t.id}</span>
                      <span className="text-[10px] text-white/40 max-w-[150px] truncate block leading-none mt-1">{t.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs text-[#F2F2F2]/90 block">{t.price.toFixed(2)}</span>
                      <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] rounded-sm px-1.5 py-0.2 mt-1 ${
                        isBull ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"
                      }`}>
                        {isBull ? "+" : ""}{t.chg.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/5 select-none">
            <span className="text-[10px] text-white/40 block text-center font-light">Click individual assets to open interactive charts.</span>
          </div>
        </div>

        {/* Active Alpha Live Signals (Bento 3) */}
        <div className="lg:col-span-4 bg-[#050505] border border-white/10 p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-white/[0.03] to-transparent">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-[9px] text-[#D4AF37] tracking-[0.25em] font-bold">ALERTS RADAR</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </div>
            <h3 className="font-serif text-lg font-light text-[#F2F2F2] tracking-wide mb-6">Live AI Alpha Signals</h3>
            
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[290px] pr-1">
              {newsSignals.map((sig) => (
                <div 
                  key={sig.id} 
                  className="bg-black/60 border border-white/15 p-3.5 rounded-xl hover:border-white/30 transition-colors duration-200"
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-mono text-[10px] text-white/40">{sig.time}</span>
                    <span className={`text-[9px] uppercase tracking-wider font-mono px-2 py-0.2 rounded font-bold ${
                      sig.type === "BULLISH" 
                        ? "bg-green-500/10 text-green-400" 
                        : sig.type === "BEARISH"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-white/10 text-[#F2F2F2]"
                    }`}>
                      {sig.type}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-white/80 leading-relaxed font-light">
                    {sig.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/5">
            <span className="text-[10px] text-white/40 block text-center font-light">Quant feeds refresh continuously on current microstructures.</span>
          </div>
        </div>

      </div>

      {/* SECTION 4: DEEP CORRELATION GENOME MAP */}
      <section className="bg-[#050505] border border-white/10 p-6 rounded-2xl flex flex-col gap-4 mt-2">
        <div className="flex justify-between items-start md:items-end flex-col md:flex-row gap-4">
          <div>
            <h3 className="font-serif text-xl font-light text-[#F2F2F2] tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#D4AF37]" /> Market Genome Correlation Preview
            </h3>
            <p className="text-xs text-white/50 mt-1 leading-relaxed font-light">
              Visualizes real-time quantitative relationships across the primary market indices. Shift to the <strong className="text-[#D4AF37] font-medium">Correlation Web</strong> tab to fully explore.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-black/50 px-4 py-2 border border-white/10 rounded-xl text-[10px] font-mono tracking-wider">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
              <span className="text-white/40">Positive Vector</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-white/40">Negative Vector</span>
            </div>
          </div>
        </div>

        {/* Beautiful genome graphic nodes linking display utilizing SVG */}
        <div className="h-[210px] bg-black/60 border border-white/5 rounded-xl flex items-center justify-center relative overflow-hidden select-none group">
          <svg className="w-full h-full opacity-65 group-hover:opacity-90 transition-opacity duration-700 pointer-events-none" viewBox="0 0 800 200">
            {/* Vector connectors with gold theme variables */}
            <line x1="120" y1="100" x2="240" y2="40" stroke="#D4AF37" strokeWidth="1.5" strokeDasharray="4 2" />
            <line x1="240" y1="40" x2="380" y2="120" stroke="#3B82F6" strokeWidth="1" />
            <line x1="380" y1="120" x2="520" y2="60" stroke="#D4AF37" strokeWidth="2" />
            <line x1="520" y1="60" x2="680" y2="110" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="240" y1="40" x2="520" y2="60" stroke="#D4AF37" strokeWidth="1" opacity="0.3" />
            <line x1="120" y1="100" x2="380" y2="120" stroke="#D4AF37" strokeWidth="1.5" />
            <line x1="380" y1="120" x2="680" y2="110" stroke="#3B82F6" strokeWidth="1" opacity="0.3" />

            {/* Glowing orbs representing core indices with style settings from Sophisticated Dark template */}
            <g transform="translate(120, 100)">
              <circle r="22" fill="#050505" stroke="#D4AF37" strokeWidth="2" />
              <circle r="3" fill="#D4AF37" />
              <text y="34" className="font-mono text-[9px] text-white/50 tracking-widest uppercase font-bold" textAnchor="middle" fill="#F2F2F2">RELIANCE</text>
            </g>

            <g transform="translate(240, 40)">
              <circle r="18" fill="#050505" stroke="#F5E6CA" strokeWidth="1.5" />
              <text y="28" className="font-mono text-[9px] text-white/50 tracking-widest uppercase font-bold" textAnchor="middle" fill="#F2F2F2">AAPL</text>
            </g>

            <g transform="translate(380, 120)">
              <circle r="25" fill="#050505" stroke="#D4AF37" strokeWidth="2.5" />
              <circle r="4" fill="#D4AF37" />
              <text y="37" className="font-mono text-[9px] text-white/50 tracking-widest uppercase font-bold" textAnchor="middle" fill="#F2F2F2">NVDA</text>
            </g>

            <g transform="translate(520, 60)">
              <circle r="20" fill="#050505" stroke="#F5E6CA" strokeWidth="1.5" />
              <text y="30" className="font-mono text-[9px] text-white/50 tracking-widest uppercase font-bold" textAnchor="middle" fill="#F2F2F2">MSFT</text>
            </g>

            <g transform="translate(680, 110)">
              <circle r="21" fill="#050505" stroke="#3B82F6" strokeWidth="1.5" />
              <circle r="3" fill="#3B82F6" />
              <text y="32" className="font-mono text-[9px] text-white/50 tracking-widest uppercase font-bold" textAnchor="middle" fill="#F2F2F2">TSLA</text>
            </g>
          </svg>

          {/* Institutional banner overlay details */}
          <div className="absolute top-3 left-3 bg-black/85 border border-white/10 py-1.5 px-3 rounded-lg pointer-events-none select-none">
            <span className="font-mono text-[9px] tracking-[0.1em] text-[#D4AF37] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" /> SECTOR CORRELATION MAPPING: CONSTITUENT VECTORS
            </span>
          </div>
        </div>
      </section>

      {/* FOOTER SPECS matching Aether footer format */}
      <footer className="mt-12 h-14 border-t border-white/10 flex items-center justify-between bg-black px-6 select-none">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">© 2026 LUMINA QUANT TERMINAL</span>
        <div className="flex space-x-6 text-[9px] uppercase tracking-[0.3em] text-white/30">
          <span>London</span>
          <span>•</span>
          <span>Tokyo</span>
          <span>•</span>
          <span>Mumbai</span>
        </div>
      </footer>

    </div>
  );
}
