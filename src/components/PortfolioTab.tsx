import React, { useMemo } from "react";
import { Ticker } from "../types";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, RefreshCw, BarChart2, PieChart as PieIcon, Activity } from "lucide-react";

interface PortfolioTabProps {
  tickers: Ticker[];
  portfolio: {
    cash: number;
    positions: { [tickerId: string]: { qty: number; avgCost: number } };
  };
  onSelectTicker: (tickerId: string) => void;
  onClearPortfolio?: () => void;
  onAlertMessage?: (msg: string) => void;
}

export default function PortfolioTab({ tickers, portfolio, onSelectTicker, onClearPortfolio, onAlertMessage }: PortfolioTabProps) {
  
  // Calculate allocations and holdings dynamically based on current live stock prices
  const holdings = useMemo(() => {
    if (!Array.isArray(tickers)) return [];
    return Object.entries(portfolio.positions).map(([tickerId, pos]) => {
      const stock = tickers.find((t) => t.id === tickerId.toUpperCase()) || {
        id: tickerId,
        name: "Unknown Corp",
        price: pos.avgCost,
        chg: 0,
        sector: "Other"
      };
      
      const currentVal = pos.qty * stock.price;
      const costBasis = pos.qty * pos.avgCost;
      const profitLossVal = currentVal - costBasis;
      const profitLossPct = costBasis > 0 ? (profitLossVal / costBasis) * 100 : 0;

      return {
        id: tickerId,
        name: stock.name,
        qty: pos.qty,
        avgCost: pos.avgCost,
        currentPrice: stock.price,
        currentValue: currentVal,
        profitLoss: profitLossVal,
        profitLossPercent: profitLossPct,
        sector: stock.sector
      };
    }).filter(h => h.qty > 0);
  }, [portfolio.positions, tickers]);

  // Aggregate stats
  const totalHoldingsValue = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.currentValue, 0);
  }, [holdings]);

  const netPortfolioValue = parseFloat((portfolio.cash + totalHoldingsValue).toFixed(2));

  // Compute sector allocations for the Recharts Donut Pie
  const sectorData = useMemo(() => {
    const sectorsMap: { [sec: string]: number } = {};
    holdings.forEach((h) => {
      sectorsMap[h.sector] = (sectorsMap[h.sector] || 0) + h.currentValue;
    });

    if (holdings.length === 0) {
      return [{ name: "Cash Only", value: portfolio.cash }];
    }

    const data = Object.entries(sectorsMap).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2))
    }));
    
    // Add cash as a sector division representing safety parameters
    data.push({ name: "Cash Reserve", value: portfolio.cash });
    return data;
  }, [holdings, portfolio.cash]);

  // Sector colors matching the premium theme palette with elegant gold variants
  const SECTOR_COLORS = ["#D4AF37", "#F5E6CA", "#9A7B31", "#3b82f6", "#22c55e", "#64748b"];

  // 30-day realistic portfolio growth simulation curve
  const growthCurve = useMemo(() => {
    const points = [];
    const baseValue = netPortfolioValue * 0.95;
    for (let i = 0; i < 30; i++) {
      const noise = 1 + Math.sin(i * 0.4) * 0.02 + Math.cos(i * 0.1) * 0.015;
      points.push({
        date: `Day ${i + 1}`,
        Value: parseFloat((baseValue * (1 + (i * 0.002)) * noise).toFixed(2))
      });
    }
    // Make last point exactly match current value
    points[points.length - 1].Value = netPortfolioValue;
    return points;
  }, [netPortfolioValue]);

  return (
    <div className="flex-grow flex flex-col gap-6 w-full max-w-[1600px] mx-auto px-6 py-8 font-sans">
      
      {/* SECTION 1: GLOBAL METRICS HEADER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 select-none">
        
        {/* Net Asset Value card */}
        <div className="bg-[#050505] border border-white/10 rounded-2xl p-5 shadow-xl bg-gradient-to-b from-white/[0.03] to-transparent">
          <span className="font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase font-bold block">Net Asset Value (NAV)</span>
          <h2 className="text-2xl font-light text-[#F2F2F2] font-sans tracking-tight mt-2.5">
            ${netPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <span className="text-[10px] text-white/40 mt-1.5 block">Combined cash & equities balance.</span>
        </div>

        {/* Free Cash card */}
        <div className="bg-[#050505] border border-white/10 rounded-2xl p-5 shadow-xl bg-gradient-to-b from-white/[0.03] to-transparent">
          <span className="font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase font-bold block">Available Cash reserve</span>
          <h2 className="text-2xl font-light text-[#D4AF37] font-sans tracking-tight mt-2.5">
            ${portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <span className="text-[10px] text-green-400 font-semibold inline-flex items-center gap-1 mt-1.5 uppercase font-mono tracking-wider">
            Ready for allocation <Activity className="w-3 h-3 text-green-400" />
          </span>
        </div>

        {/* Equities Exposure */}
        <div className="bg-[#050505] border border-white/10 rounded-2xl p-5 shadow-xl bg-gradient-to-b from-white/[0.03] to-transparent">
          <span className="font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase font-bold block">Equities exposure</span>
          <h2 className="text-2xl font-light text-[#F5E6CA] font-sans tracking-tight mt-2.5">
            ${totalHoldingsValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <span className="text-[10px] text-[#D4AF37] font-mono uppercase tracking-wider mt-1.5 block">
            {netPortfolioValue > 0 ? ((totalHoldingsValue / netPortfolioValue) * 100).toFixed(1) : 0}% aggregate weight.
          </span>
        </div>

        {/* Action card: Reset or balance config */}
        <div className="bg-[#050505] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col justify-between bg-gradient-to-b from-white/[0.03] to-transparent">
          <div>
            <span className="font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase font-bold block">Clearing desk controls</span>
            <p className="text-[10px] text-white/40 mt-1 select-none">Resets portfolio balance to initial $100,000.00 cash benchmark.</p>
          </div>
          <button 
            type="button"
            onClick={() => {
              onClearPortfolio?.();
              onAlertMessage?.("Reset portfolio to original standard state ($100,000.00 cash).");
            }}
            className="w-full bg-[#0d0d0d] hover:bg-white/[0.04] border border-white/10 text-[#D4AF37] py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center block whitespace-nowrap mt-3 uppercase tracking-wider duration-200"
          >
            Reset Portfolio
          </button>
        </div>

      </div>

      {/* SECTION 2: GRAPH VISUALIZATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Growth Line Chart (Bento 1) */}
        <div className="lg:col-span-8 bg-[#050505] border border-white/10 p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <div className="flex justify-between items-center select-none mb-2">
            <h3 className="font-serif text-sm font-light tracking-wide text-[#F2F2F2] flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#D4AF37]" /> NAV Performance Curve (30D)
            </h3>
            <span className="text-[8px] text-[#D4AF37] font-mono font-bold tracking-[0.15em] uppercase">USD HISTORIC EQUITIES</span>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthCurve} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.08)" fontSize={9} fontClassName="font-mono" hide />
                <YAxis stroke="rgba(255,255,255,0.15)" fontSize={9} fontClassName="font-mono" domain={["auto", "auto"]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#050505", borderColor: "rgba(255,255,255,0.15)", borderRadius: "8px" }}
                  labelStyle={{ color: "#888", fontSize: "10px", fontFamily: "monospace" }}
                  itemStyle={{ color: "#D4AF37", fontSize: "11px", fontWeight: "bold" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Value" 
                  stroke="#D4AF37" 
                  strokeWidth={1.5} 
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector Allocation card (Bento 2) */}
        <div className="lg:col-span-4 bg-[#050505] border border-white/10 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-center select-none mb-4">
            <h3 className="font-serif text-sm font-light tracking-wide text-[#F2F2F2] flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[#D4AF37]" /> Sector Allocations
            </h3>
          </div>

          {/* Recharts allocation donut */}
          <div className="h-44 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {sectorData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={SECTOR_COLORS[idx % SECTOR_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#050505", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px" }}
                  itemStyle={{ fontSize: "11px", color: "#F2F2F2" }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center percentage watermark labels */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-mono text-[8px] text-white/40 uppercase tracking-[0.16em]">allocated</span>
              <span className="font-sans text-lg font-light text-[#F2F2F2] mt-0.5">
                {netPortfolioValue > 0 ? ((totalHoldingsValue / netPortfolioValue) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>

          {/* Dynamic legends index */}
          <div className="grid grid-cols-2 gap-2 mt-4 text-[9px] font-mono select-none">
            {sectorData.map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span 
                  className="w-2 h-2 rounded-full inline-block" 
                  style={{ backgroundColor: SECTOR_COLORS[idx % SECTOR_COLORS.length] }} 
                />
                <span className="text-white/45 font-semibold truncate max-w-[100px]">{entry.name}</span>
                <span className="text-[#D4AF37] font-bold">({((entry.value / netPortfolioValue) * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTION 3: DETAILED ACTIVE POSITIONS LISTING */}
      <div className="bg-[#050505] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        
        <div className="p-4 border-b border-white/10 bg-black/60 select-none">
          <h3 className="font-serif text-sm font-light tracking-wide text-[#F2F2F2] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#D4AF37] animate-pulse" /> Active Positions Index
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-[#020202] border-b border-white/10 select-none">
              <tr className="font-mono text-[9px] tracking-[0.15em] text-white/45 uppercase font-bold">
                <th className="py-3.5 px-5 font-bold">Ticker</th>
                <th className="py-3.5 px-5 font-bold">Company</th>
                <th className="py-3.5 px-5 font-bold">Sector</th>
                <th className="py-3.5 px-5 font-bold">Avg Cost</th>
                <th className="py-3.5 px-5 font-bold">Current Price</th>
                <th className="py-3.5 px-5 font-bold">Current Value</th>
                <th className="py-3.5 px-5 font-bold">Total return</th>
                <th className="py-3.5 px-5 font-bold text-center">Chart</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-white/5 font-mono text-xs text-[#F2F2F2]/80">
              {holdings.length > 0 ? (
                holdings.map((h) => {
                  const gain = h.profitLoss >= 0;
                  return (
                    <tr key={h.id} className="hover:bg-white/[0.02] transition-all duration-150 group">
                      <td 
                        onClick={() => onSelectTicker(h.id)} 
                        className="py-3.5 px-5 font-black text-[#D4AF37] hover:underline cursor-pointer"
                      >
                        {h.id}
                      </td>
                      <td className="py-3.5 px-5 text-[#F2F2F2]/60 max-w-[190px] truncate">{h.name}</td>
                      <td className="py-3.5 px-5 text-white/40 text-[10px]">{h.sector}</td>
                      <td className="py-3.5 px-5 text-[#F2F2F2]/60">${h.avgCost.toFixed(2)}</td>
                      <td className="py-3.5 px-5 text-[#F2F2F2]/60">${h.currentPrice.toFixed(2)}</td>
                      <td className="py-3.5 px-5 text-[#F2F2F2] font-semibold">${h.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-5">
                        <span className={`px-2 py-0.5 rounded-sm inline-flex items-center text-[10px] font-bold ${
                          gain ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                        }`}>
                          {gain ? "+" : ""}${h.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 1 })} ({gain ? "+" : ""}{h.profitLossPercent.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTicker(h.id);
                            onAlertMessage?.(`Directed Terminal focus to live chart: ${h.id}`);
                          }}
                          className="text-[#D4AF37]/60 hover:text-[#D4AF37] hover:underline transition-colors py-1 cursor-pointer"
                          title="View Chart & Technical Indices"
                        >
                          Chart
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-white/30 font-serif text-xs">
                    No active positions currently assigned. Transmit limit trades in the **Charts** tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* SECTION 4: INSTITUTIONAL RATIOS WATERMARK */}
      <div className="bg-[#030303] p-4 rounded-xl border border-white/5 font-mono text-[9px] tracking-wide text-white/30 flex flex-wrap gap-[6px] justify-between shadow-inner select-none pointer-events-none mt-2">
        <span>Alpha rating (Simulated Vs SPY): +1.42%</span>
        <span className="opacity-10 border-r border-[#fff] h-3 hidden sm:inline"></span>
        <span>Corporate beta Coefficient: 1.08</span>
        <span className="opacity-15 border-r border-[#fff] h-3 hidden sm:inline"></span>
        <span>Sharpe Optimization Ratio: 1.84</span>
        <span className="opacity-15 border-r border-[#fff] h-3 hidden sm:inline"></span>
        <span>Treynor volatility indicator index: 14.12</span>
        <span className="opacity-15 border-r border-[#fff] h-3 hidden sm:inline"></span>
        <span>Sortino Downside deviation index: 2.15</span>
      </div>

    </div>
  );
}
