import React, { useState, useMemo } from "react";
import { Ticker } from "../types";
import { Search, Download, PlusCircle, ArrowUpDown, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface ScreenerTabProps {
  tickers: Ticker[];
  onSelectTicker: (tickerId: string) => void;
  onAlertMessage?: (msg: string) => void;
}

type SortField = 'id' | 'price' | 'chg' | 'volSurge' | 'pe' | 'rsi';

export default function ScreenerTab({ tickers, onSelectTicker, onAlertMessage }: ScreenerTabProps) {
  // Filter form states
  const [peMin, setPeMin] = useState<string>("");
  const [peMax, setPeMax] = useState<string>("");
  const [marketCap, setMarketCap] = useState<string>("any");
  const [roeMin, setRoeMin] = useState<number>(0); // ROE range slider
  const [rsiMin, setRsiMin] = useState<string>("");
  const [rsiMax, setRsiMax] = useState<string>("");
  const [volSurgeOnly, setVolSurgeOnly] = useState<boolean>(false);
  const [macdOnly, setMacdOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Accordion groups toggle
  const [fundamentalsOpen, setFundamentalsOpen] = useState(true);
  const [technicalsOpen, setTechnicalsOpen] = useState(true);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;

  // Active preset state indicator
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Quick Preset Handlers
  const applyPreset = (presetName: string) => {
    setActivePreset(presetName);
    setCurrentPage(1);

    if (presetName === "value_traps") {
      setPeMin("35");
      setPeMax("");
      setMarketCap("any");
      setRoeMin(0);
      setRsiMin("");
      setRsiMax("");
      setVolSurgeOnly(false);
      setMacdOnly(false);
      onAlertMessage?.("Applied 'Value Traps' Preset Filter: High P/E valuations.");
    } else if (presetName === "growth_leaders") {
      setPeMin("");
      setPeMax("80");
      setMarketCap("any");
      setRoeMin(25);
      setRsiMin("");
      setRsiMax("");
      setVolSurgeOnly(true);
      setMacdOnly(true);
      onAlertMessage?.("Applied 'Growth Leaders' Preset Filter: High ROE and volume surges.");
    } else if (presetName === "oversold_rsi") {
      setPeMin("");
      setPeMax("");
      setMarketCap("any");
      setRoeMin(0);
      setRsiMin("0");
      setRsiMax("45");
      setVolSurgeOnly(false);
      setMacdOnly(true);
      onAlertMessage?.("Applied 'Oversold RSI Bounce' Preset Filter: RSI <= 45 and active MACD cross.");
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setPeMin("");
    setPeMax("");
    setMarketCap("any");
    setRoeMin(0);
    setRsiMin("");
    setRsiMax("");
    setVolSurgeOnly(false);
    setMacdOnly(false);
    setSearchQuery("");
    setActivePreset(null);
    setCurrentPage(1);
    onAlertMessage?.("All screener filters and search fields reset.");
  };

  // Compute filtered tickers list
  const filteredTickers = useMemo(() => {
    if (!Array.isArray(tickers)) return [];
    return tickers.filter((t) => {
      // Search Box Filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesQuery = t.id.toLowerCase().includes(query) || t.name.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // P/E Ratio filter min
      if (peMin) {
        const minVal = parseFloat(peMin);
        if (!isNaN(minVal) && (t.pe === null || t.pe < minVal)) return false;
      }

      // P/E Ratio filter max
      if (peMax) {
        const maxVal = parseFloat(peMax);
        if (!isNaN(maxVal) && (t.pe === null || t.pe > maxVal)) return false;
      }

      // Market Cap filter
      if (marketCap !== "any") {
        // Cap bands are in USD; stocks without a known cap are excluded.
        if (t.mktCapValue === null) return false;
        if (marketCap === "mega") {
          // Mega cap is > 200B ($200,000,000,000)
          if (t.mktCapValue < 200000000000) return false;
        } else if (marketCap === "large") {
          // Large cap is 10B - 200B
          if (t.mktCapValue < 10000000000 || t.mktCapValue >= 200000000000) return false;
        } else if (marketCap === "mid") {
          // Mid cap is 2B - 10B
          if (t.mktCapValue < 2000000000 || t.mktCapValue >= 10000000000) return false;
        }
      }

      // ROE minimum filter
      if (roeMin > 0) {
        if (t.roe === null || t.roe < roeMin) return false;
      }

      // RSI (14) Minimum filter
      if (rsiMin) {
        const minVal = parseFloat(rsiMin);
        if (!isNaN(minVal) && t.rsi < minVal) return false;
      }

      // RSI (14) Maximum filter
      if (rsiMax) {
        const maxVal = parseFloat(rsiMax);
        if (!isNaN(maxVal) && t.rsi > maxVal) return false;
      }

      // Volume Surge status
      if (volSurgeOnly) {
        if (t.volSurge < 1.25) return false;
      }

      // MACD Bull Cross status
      if (macdOnly) {
        if (!t.macdCross) return false;
      }

      return true;
    });
  }, [tickers, searchQuery, peMin, peMax, marketCap, roeMin, rsiMin, rsiMax, volSurgeOnly, macdOnly]);

  // Compute sorted and paginated tickers
  const sortedTickers = useMemo(() => {
    return [...filteredTickers].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Missing values (e.g. P/E for NSE stocks) always sort last.
      if (valA === null || valB === null) {
        return valA === valB ? 0 : valA === null ? 1 : -1;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [filteredTickers, sortField, sortAsc]);

  const totalMatches = sortedTickers.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / itemsPerPage));

  const paginatedTickers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedTickers.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedTickers, currentPage]);

  const handlePageChange = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  // Export full screened database as JSON download representation
  const handleExportData = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredTickers, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `lumina_quant_screener_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      onAlertMessage?.(`Successfully exported data for ${filteredTickers.length} screened matches.`);
    } catch {
      onAlertMessage?.("System failed to build export file.");
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto px-6 py-8 gap-6 font-sans">
      
      {/* LEFT SIDEBAR: FILTERS PANEL */}
      <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6 select-none">
        
        {/* Preset Screens (Bento Panel) */}
        <div className="bg-[#050505] border border-white/10 rounded-2xl p-5 shadow-xl bg-gradient-to-b from-white/[0.03] to-transparent">
          <h3 className="text-[#F2F2F2] font-serif font-light text-base mb-4 tracking-wide">Preset Screens</h3>
          <div className="flex flex-col gap-2">
            {[
              { id: "value_traps", label: "Value Traps" },
              { id: "growth_leaders", label: "Growth Leaders" },
              { id: "oversold_rsi", label: "Oversold RSI Bounce" }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs uppercase tracking-wider font-semibold transition-all duration-300 scale-99 active:scale-95 cursor-pointer ${
                  activePreset === p.id 
                    ? "bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]" 
                    : "bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/10 text-white/50"
                }`}
              >
                <span>{p.label}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
          </div>
        </div>

        {/* Custom Filters (Form Panel) */}
        <div className="bg-[#050505] border border-white/10 rounded-2xl p-5 flex-1 flex flex-col gap-5 shadow-xl bg-gradient-to-b from-white/[0.03] to-transparent max-h-[700px] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-[#F2F2F2] font-serif font-light text-base tracking-wide">Custom Filters</h3>
            <button 
              onClick={resetFilters}
              className="font-mono text-[9px] tracking-[0.2em] font-bold text-[#D4AF37] hover:text-[#F5E6CA] transition-colors uppercase cursor-pointer"
            >
              Reset
            </button>
          </div>

          {/* Fundamentals Accordion Group */}
          <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
            <button 
              type="button"
              onClick={() => setFundamentalsOpen(!fundamentalsOpen)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors text-left"
            >
              <span className="text-xs uppercase tracking-widest font-bold text-gray-200">Fundamentals</span>
              <span className={`text-gray-400 text-xs transform transition-transform duration-300 ${fundamentalsOpen ? "rotate-180" : ""}`}>▼</span>
            </button>
            
            {fundamentalsOpen && (
              <div className="p-4 border-t border-white/10 flex flex-col gap-4">
                {/* P/E Ratio */}
                <div>
                  <label className="font-mono text-[9px] tracking-[0.15em] text-white/40 block mb-1.5 uppercase font-bold">P/E Ratio</label>
                  <div className="flex gap-2.5">
                    <input 
                      type="number"
                      placeholder="Min"
                      value={peMin}
                      onChange={(e) => { setPeMin(e.target.value); setActivePreset(null); setCurrentPage(1); }}
                      className="w-full bg-[#050505] border border-white/10 rounded-lg text-xs p-2 text-white placeholder:text-gray-700 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none"
                    />
                    <input 
                      type="number"
                      placeholder="Max"
                      value={peMax}
                      onChange={(e) => { setPeMax(e.target.value); setActivePreset(null); setCurrentPage(1); }}
                      className="w-full bg-[#050505] border border-white/10 rounded-lg text-xs p-2 text-white placeholder:text-gray-700 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Market Cap */}
                <div>
                  <label className="font-mono text-[9px] tracking-[0.15em] text-white/40 block mb-1.5 uppercase font-bold">Market Cap</label>
                  <select 
                    value={marketCap}
                    onChange={(e) => { setMarketCap(e.target.value); setActivePreset(null); setCurrentPage(1); }}
                    className="w-full bg-[#050505] border border-white/10 rounded-lg text-xs p-2 text-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none cursor-pointer"
                  >
                    <option value="any" className="bg-[#050505]">Any Cap</option>
                    <option value="mega" className="bg-[#050505]">Mega (&gt; $200B)</option>
                    <option value="large" className="bg-[#050505]">Large ($10B - $200B)</option>
                    <option value="mid" className="bg-[#050505]">Mid ($2B - $10B)</option>
                  </select>
                </div>

                {/* ROE */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-mono text-[9px] tracking-[0.15em] text-white/40 uppercase font-bold">ROE (Min %)</label>
                    <span className="font-mono text-xs text-[#D4AF37] font-bold">{roeMin}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    value={roeMin}
                    onChange={(e) => { setRoeMin(parseInt(e.target.value)); setActivePreset(null); setCurrentPage(1); }}
                    className="w-full accent-[#D4AF37] h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Technicals Accordion Group */}
          <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
            <button 
              type="button"
              onClick={() => setTechnicalsOpen(!technicalsOpen)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors text-left"
            >
              <span className="text-xs uppercase tracking-widest font-bold text-gray-200">Technicals</span>
              <span className={`text-gray-400 text-xs transform transition-transform duration-300 ${technicalsOpen ? "rotate-180" : ""}`}>▼</span>
            </button>
            
            {technicalsOpen && (
              <div className="p-4 border-t border-white/10 flex flex-col gap-4">
                {/* RSI (14) */}
                <div>
                  <label className="font-mono text-[9px] tracking-[0.15em] text-white/40 block mb-1.5 uppercase font-bold">RSI (14)</label>
                  <div className="flex gap-2.5">
                    <input 
                      type="number"
                      placeholder="Min 0"
                      value={rsiMin}
                      onChange={(e) => { setRsiMin(e.target.value); setActivePreset(null); setCurrentPage(1); }}
                      className="w-full bg-[#050505] border border-white/10 rounded-lg text-xs p-2 text-white placeholder:text-gray-700 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none"
                    />
                    <input 
                      type="number"
                      placeholder="Max 100"
                      value={rsiMax}
                      onChange={(e) => { setRsiMax(e.target.value); setActivePreset(null); setCurrentPage(1); }}
                      className="w-full bg-[#050505] border border-white/10 rounded-lg text-xs p-2 text-white placeholder:text-gray-700 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Volume Surge checkbox */}
                <div className="flex items-center justify-between mt-1">
                  <label htmlFor="surge-check" className="font-mono text-[9px] tracking-[0.15em] text-white/40 uppercase font-bold cursor-pointer select-none">Volume Surge</label>
                  <input 
                    type="checkbox"
                    id="surge-check"
                    checked={volSurgeOnly}
                    onChange={(e) => { setVolSurgeOnly(e.target.checked); setActivePreset(null); setCurrentPage(1); }}
                    className="rounded border-white/20 bg-black text-[#D4AF37] focus:ring-[#D4AF37]/30 w-4 h-4 cursor-pointer accent-[#D4AF37]"
                  />
                </div>

                {/* MACD Bull Cross checkbox */}
                <div className="flex items-center justify-between mt-1">
                  <label htmlFor="macd-check" className="font-mono text-[9px] tracking-[0.15em] text-white/40 uppercase font-bold cursor-pointer select-none">MACD Bull Cross</label>
                  <input 
                    type="checkbox"
                    id="macd-check"
                    checked={macdOnly}
                    onChange={(e) => { setMacdOnly(e.target.checked); setActivePreset(null); setCurrentPage(1); }}
                    className="rounded border-white/20 bg-black text-[#D4AF37] focus:ring-[#D4AF37]/30 w-4 h-4 cursor-pointer accent-[#D4AF37]"
                  />
                </div>
              </div>
            )}
          </div>

          <button 
            type="button" 
            onClick={resetFilters}
            className="mt-6 w-full bg-gradient-to-tr from-[#D4AF37] to-[#F5E6CA] text-black font-semibold text-xs py-3 px-4 rounded-full hover:opacity-90 transition-opacity uppercase font-mono tracking-widest cursor-pointer shadow-[0_4px_12px_rgba(212,175,55,0.25)]"
          >
            Clear Filters
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN DATA GRID VIEW */}
      <div className="flex-grow flex flex-col gap-4 min-w-0">
        
        {/* Top Action Filter Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
            <input 
              type="text"
              placeholder="Search tickers, companies, or concepts..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-black border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-xs focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none text-[#F2F2F2] placeholder:text-gray-600 transition-all font-sans"
            />
          </div>
          
          <button 
            onClick={handleExportData}
            className="w-full md:w-auto bg-[#050505] border border-white/10 text-[#F2F2F2] px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/5 transition-all flex items-center justify-center gap-2 select-none active:scale-95 duration-200 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#D4AF37]" /> Export matches
          </button>
        </div>

        {/* Dense tabular database visualization */}
        <div className="bg-[#050505] border border-white/10 rounded-2xl overflow-hidden flex-1 flex flex-col shadow-xl">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              
              <thead className="bg-black/80 border-b border-white/10 sticky top-0 z-10 select-none">
                <tr className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/40">
                  <th 
                    onClick={() => handleSortChange('id')}
                    className="py-4.5 px-5 font-bold cursor-pointer hover:text-[#D4AF37] group transition-colors"
                  >
                    Ticker <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th 
                    onClick={() => handleSortChange('price')}
                    className="py-4.5 px-5 font-bold cursor-pointer hover:text-[#D4AF37] group transition-colors"
                  >
                    Price <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th 
                    onClick={() => handleSortChange('chg')}
                    className="py-4.5 px-5 font-bold cursor-pointer hover:text-[#D4AF37] group transition-colors"
                  >
                    Chg % <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th 
                    onClick={() => handleSortChange('volSurge')}
                    className="py-4.5 px-5 font-bold cursor-pointer hover:text-[#D4AF37] group transition-colors"
                  >
                    Vol surge <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th 
                    onClick={() => handleSortChange('pe')}
                    className="py-4.5 px-5 font-bold cursor-pointer hover:text-[#D4AF37] group transition-colors"
                  >
                    P/E (TTM) <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="py-4.5 px-5 font-bold text-white/40">Mkt Cap</th>
                  <th 
                    onClick={() => handleSortChange('rsi')}
                    className="py-4.5 px-5 font-bold cursor-pointer hover:text-[#D4AF37] group transition-colors"
                  >
                    RSI (14) <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="py-4.5 px-5 font-bold text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5 font-mono text-xs text-[#F2F2F2]">
                {paginatedTickers.length > 0 ? (
                  paginatedTickers.map((t) => {
                    const isBull = t.chg >= 0;
                    return (
                      <tr 
                        key={t.id} 
                        className="hover:bg-white/[0.02] transition-colors duration-150 group cursor-pointer"
                      >
                        {/* Selecting a row instantly prompts open detailed charts inside current run */}
                        <td 
                          onClick={() => onSelectTicker(t.id)}
                          className="py-3.5 px-5 font-serif font-light text-sm text-[#D4AF37] hover:underline"
                        >
                          {t.id}
                          {t.market === "IN" && (
                            <span className="ml-2 align-middle font-mono text-[8px] tracking-wider text-white/40 border border-white/15 rounded px-1 py-px">NSE</span>
                          )}
                          {t.source === "mock" && (
                            <span title="Live data unavailable; showing sample values" className="ml-1 align-middle font-mono text-[8px] tracking-wider text-red-300 border border-red-400/30 rounded px-1 py-px">SAMPLE</span>
                          )}
                        </td>
                        <td 
                          onClick={() => onSelectTicker(t.id)}
                          className="py-3.5 px-5 text-white/80"
                        >
                          {t.currency}{t.price.toFixed(2)}
                          {t.delayed && t.source !== "mock" && (
                            <span title="Delayed quote (Yahoo Finance)" className="ml-1.5 font-mono text-[8px] text-white/30">DLY</span>
                          )}
                        </td>
                        <td 
                          onClick={() => onSelectTicker(t.id)}
                          className="py-3.5 px-5"
                        >
                          <span className={`px-2 py-0.5 rounded-sm inline-flex items-center gap-0.5 text-[10px] ${
                            isBull ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                          }`}>
                            {isBull ? "▲" : "▼"} {Math.abs(t.chg).toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-white/50">{t.volSurge.toFixed(1)}x</td>
                        <td className="py-3.5 px-5 text-white/70" title={t.fundamentalsSource === "sample" ? "Sample fundamentals; add FINANCIAL_MODELING_API for live values" : undefined}>
                          {t.pe === null ? "—" : t.pe.toFixed(1)}
                          {t.fundamentalsSource === "sample" && t.pe !== null && <span className="text-white/30">*</span>}
                        </td>
                        <td className="py-3.5 px-5 text-white/70">{t.mktCap}</td>
                        <td className="py-3.5 px-5">
                          <span className={`${t.rsi >= 70 ? "text-[#D4AF37]" : t.rsi <= 35 ? "text-cyan-400" : "text-white/60"}`}>
                            {t.rsi.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTicker(t.id);
                              onAlertMessage?.(`Selected ${t.id} for charting & order execution.`);
                            }}
                            className="text-white/40 hover:text-[#D4AF37] transition-colors p-1"
                            title="Analyze / Trade"
                          >
                            <PlusCircle className="w-4.5 h-4.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-white/30 font-serif text-sm">
                      No matching quantitative assets fit the active custom search criteria.
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="border-t border-white/10 p-4 flex flex-col md:flex-row items-center justify-between bg-black/60 gap-3 select-none">
            <span className="font-sans text-[11px] text-white/40">
              Showing {paginatedTickers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredTickers.length)} of {filteredTickers.length} matches
            </span>
            
            <div className="flex gap-1.5 items-center">
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1.5 rounded-md bg-[#050505] hover:bg-white/5 border border-white/10 text-white/50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageIdx) => (
                <button
                  key={pageIdx}
                  onClick={() => handlePageChange(pageIdx)}
                  className={`px-3 py-1 rounded font-mono text-[11px] font-bold border transition-colors cursor-pointer ${
                    currentPage === pageIdx 
                      ? "bg-[#D4AF37] text-black border-[#D4AF37]" 
                      : "bg-[#050505] hover:bg-white/5 text-white/50 border-white/10"
                  }`}
                >
                  {pageIdx}
                </button>
              ))}

              <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1.5 rounded-md bg-[#050505] hover:bg-white/5 border border-white/10 text-white/50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
