import React, { useEffect, useMemo } from "react";
import { Ticker } from "../types";
import type { Portfolio } from "../app/usePortfolio";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, RefreshCw, BarChart2, PieChart as PieIcon, Activity } from "lucide-react";

interface PortfolioTabProps {
  tickers: Ticker[];
  portfolio: Portfolio;
  onSelectTicker: (tickerId: string) => void;
  onClearPortfolio?: () => void;
  onAlertMessage?: (msg: string) => void;
  /** Saves today's account value to the user's equity curve. */
  onRecordNav?: (value: number) => void;
}

export default function PortfolioTab({ tickers, portfolio, onSelectTicker, onClearPortfolio, onAlertMessage, onRecordNav }: PortfolioTabProps) {
  
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

  // Real equity curve: one point per day of the paper account's value, saved to the account.
  useEffect(() => {
    // Wait for prices so the snapshot doesn't record positions at cost.
    if (tickers.length && Number.isFinite(netPortfolioValue) && netPortfolioValue > 0) onRecordNav?.(netPortfolioValue);
  }, [netPortfolioValue, tickers.length, onRecordNav]);
  const growthCurve = useMemo(
    () => (portfolio.nav ?? []).slice(-30).map((p) => ({ date: p.date, Value: p.value })),
    [portfolio.nav]
  );

  return (
    <div className="flex-grow flex flex-col gap-6 w-full max-w-[1600px] mx-auto px-6 py-8 font-sans">
      
      {/* SECTION 1: GLOBAL METRICS HEADER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 select-none">
        
        {/* Net Asset Value card */}
        <div className="lq-panel  p-5 shadow-xl bg-gradient-to-b from-white/[0.03] to-transparent">
          <span className="font-mono text-[11px] tracking-[0.16em] text-lq-muted uppercase font-bold block">Net Asset Value (NAV)</span>
          <h2 className="text-2xl font-light text-lq-text font-sans tracking-tight mt-2.5">
            ${netPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <span className="text-[11px] text-lq-muted mt-1.5 block">Combined cash & equities balance.</span>
        </div>

        {/* Free Cash card */}
        <div className="lq-panel  p-5 shadow-xl bg-gradient-to-b from-white/[0.03] to-transparent">
          <span className="font-mono text-[11px] tracking-[0.16em] text-lq-muted uppercase font-bold block">Available Cash reserve</span>
          <h2 className="text-2xl font-light text-lq-gold font-sans tracking-tight mt-2.5">
            ${portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <span className="text-[11px] text-lq-up font-semibold inline-flex items-center gap-1 mt-1.5 uppercase font-mono tracking-wider">
            Ready for allocation <Activity className="w-3 h-3 text-lq-up" />
          </span>
        </div>

        {/* Equities Exposure */}
        <div className="lq-panel  p-5 shadow-xl bg-gradient-to-b from-white/[0.03] to-transparent">
          <span className="font-mono text-[11px] tracking-[0.16em] text-lq-muted uppercase font-bold block">Equities exposure</span>
          <h2 className="text-2xl font-light text-lq-gold-soft font-sans tracking-tight mt-2.5">
            ${totalHoldingsValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <span className="text-[11px] text-lq-gold font-mono uppercase tracking-wider mt-1.5 block">
            {netPortfolioValue > 0 ? ((totalHoldingsValue / netPortfolioValue) * 100).toFixed(1) : 0}% aggregate weight.
          </span>
        </div>

        {/* Action card: Reset or balance config */}
        <div className="lq-panel  p-5 shadow-xl flex flex-col justify-between bg-gradient-to-b from-white/[0.03] to-transparent">
          <div>
            <span className="font-mono text-[11px] tracking-[0.16em] text-lq-muted uppercase font-bold block">Paper account controls</span>
            <p className="text-[11px] text-lq-muted mt-1 select-none">
              Clears positions and trade history and restores your ${portfolio.startingCash.toLocaleString(undefined, { minimumFractionDigits: 2 })} starting balance.
            </p>
          </div>
          <button 
            type="button"
            onClick={() => {
              if (!window.confirm("Reset your paper portfolio? Positions and trade history will be cleared.")) return;
              onClearPortfolio?.();
            }}
            className="w-full bg-lq-surface hover:bg-lq-surface-2 border border-lq-line text-lq-gold py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center block whitespace-nowrap mt-3 uppercase tracking-wider duration-200"
          >
            Reset Portfolio
          </button>
        </div>

      </div>

      {/* SECTION 2: GRAPH VISUALIZATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Growth Line Chart (Bento 1) */}
        <div className="lg:col-span-8 lq-panel p-6  shadow-xl flex flex-col gap-4">
          <div className="flex justify-between items-center select-none mb-2">
            <h3 className="font-serif text-sm font-light tracking-wide text-lq-text flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-lq-gold" /> Equity curve (last 30 days)
            </h3>
            <span className="text-[11px] text-lq-gold font-mono font-bold tracking-[0.15em] uppercase">Saved to your account</span>
          </div>

          {growthCurve.length < 2 && (
            <p className="text-[12px] text-lq-muted m-0">
              Your equity curve starts today. A point is recorded each day you open the paper portfolio.
            </p>
          )}
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthCurve} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.08)" fontSize={9} hide />
                <YAxis stroke="rgba(255,255,255,0.15)" fontSize={9} domain={["auto", "auto"]} />
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
        <div className="lg:col-span-4 lq-panel p-6  shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-center select-none mb-4">
            <h3 className="font-serif text-sm font-light tracking-wide text-lq-text flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-lq-gold" /> Sector Allocations
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
              <span className="font-mono text-[11px] text-lq-muted uppercase tracking-[0.16em]">allocated</span>
              <span className="font-sans text-lg font-light text-lq-text mt-0.5">
                {netPortfolioValue > 0 ? ((totalHoldingsValue / netPortfolioValue) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>

          {/* Dynamic legends index */}
          <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] font-mono select-none">
            {sectorData.map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span 
                  className="w-2 h-2 rounded-full inline-block" 
                  style={{ backgroundColor: SECTOR_COLORS[idx % SECTOR_COLORS.length] }} 
                />
                <span className="text-lq-muted font-semibold truncate max-w-[100px]">{entry.name}</span>
                <span className="text-lq-gold font-bold">({((entry.value / netPortfolioValue) * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTION 3: DETAILED ACTIVE POSITIONS LISTING */}
      <div className="lq-panel  overflow-hidden shadow-xl">
        
        <div className="p-4 border-b border-lq-line bg-lq-bg-2/60 select-none">
          <h3 className="font-serif text-sm font-light tracking-wide text-lq-text flex items-center gap-2">
            <Activity className="w-4 h-4 text-lq-gold animate-pulse" /> Active Positions Index
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-lq-surface border-b border-lq-line select-none">
              <tr className="font-mono text-[11px] tracking-[0.15em] text-lq-muted uppercase font-bold">
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
            
            <tbody className="divide-y divide-lq-line font-mono text-xs text-lq-text/80">
              {holdings.length > 0 ? (
                holdings.map((h) => {
                  const gain = h.profitLoss >= 0;
                  return (
                    <tr key={h.id} className="hover:bg-lq-surface-2 transition-all duration-150 group">
                      <td 
                        onClick={() => onSelectTicker(h.id)} 
                        className="py-3.5 px-5 font-black text-lq-gold hover:underline cursor-pointer"
                      >
                        {h.id}
                      </td>
                      <td className="py-3.5 px-5 text-lq-text/60 max-w-[190px] truncate">{h.name}</td>
                      <td className="py-3.5 px-5 text-lq-muted text-[11px]">{h.sector}</td>
                      <td className="py-3.5 px-5 text-lq-text/60">${h.avgCost.toFixed(2)}</td>
                      <td className="py-3.5 px-5 text-lq-text/60">${h.currentPrice.toFixed(2)}</td>
                      <td className="py-3.5 px-5 text-lq-text font-semibold">${h.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-5">
                        <span className={`px-2 py-0.5 rounded-sm inline-flex items-center text-[11px] font-bold ${
                          gain ? "bg-lq-up/10 text-lq-up" : "bg-lq-down/10 text-lq-down"
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
                          className="text-lq-gold/60 hover:text-lq-gold hover:underline transition-colors py-1 cursor-pointer"
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
                  <td colSpan={8} className="py-12 text-center text-lq-muted font-serif text-xs">
                    No active positions currently assigned. Transmit limit trades in the **Charts** tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      <p className="lq-card p-4 text-[12px] text-lq-muted m-0 mt-2">
        Paper portfolio: positions, cash and returns are simulated with virtual money at delayed prices. Nothing is
        sent to a broker. Risk ratios such as Sharpe and beta appear here once enough daily equity history is recorded.
      </p>

    </div>
  );
}
