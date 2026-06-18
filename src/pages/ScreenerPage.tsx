import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Filter, ChevronDown, ChevronUp, Search, ArrowUpDown } from 'lucide-react';
import { fetchIndianStocks, INDIAN_SYMBOLS } from '../lib/api';
import StockDrawer from '../components/screener/StockDrawer';
import PaperTradeModal from '../components/screener/PaperTradeModal';
import type { Stock, MarketCapCategory } from '../types';

interface Filters {
  marketCap: MarketCapCategory;
  rsiMin: number; rsiMax: number;
  macdSignal: string;
  sector: string;
  breakout52w: boolean;
}

const defaultFilters: Filters = {
  marketCap: 'Any', rsiMin: 0, rsiMax: 100,
  macdSignal: 'Any', sector: 'Any', breakout52w: false,
};

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition">
        <span className="text-xs font-semibold text-white/50">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-white/25" /> : <ChevronDown className="w-3.5 h-3.5 text-white/25" />}
      </button>
      {open && <div className="p-3 pt-0 space-y-3">{children}</div>}
    </div>
  );
}

export default function ScreenerPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [sortKey, setSortKey] = useState<keyof Stock>('symbol');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showTradeModal, setShowTradeModal] = useState<Stock | null>(null);

  useEffect(() => {
    fetchIndianStocks().then(data => { if (data.length) setStocks(data); setLoading(false); });
  }, []);

  const sectors = useMemo(() => ['Any', ...new Set(INDIAN_SYMBOLS.map(s => s.sector))], []);

  const filteredStocks = useMemo(() => {
    let result = stocks.filter(s => {
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filters.sector !== 'Any' && s.sector !== filters.sector) return false;
      return true;
    });
    result.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
    return result;
  }, [stocks, filters, sortKey, sortDir, searchQuery]);

  const handleSort = (key: keyof Stock) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortHeader = ({ label, field }: { label: string; field: keyof Stock }) => (
    <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition select-none text-xs" onClick={() => handleSort(field)}>
      <span className="flex items-center gap-1">{label}<ArrowUpDown className="w-3 h-3" /></span>
    </th>
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">Stock Screener</h1>
        <p className="text-white/30 text-sm mt-1">Filter and discover stocks with real-time data</p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Filters */}
        <div className="lg:w-[280px] shrink-0 space-y-3">
          <div className="flex items-center gap-2 text-white/40 text-xs mb-2"><Filter className="w-3.5 h-3.5" /><span className="font-semibold">Filters</span></div>
          <CollapsibleSection title="Fundamental">
            <div className="space-y-1"><p className="text-xs text-white/30">Sector</p>
              <select value={filters.sector} onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-orange/40">
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </CollapsibleSection>
          <button onClick={() => setFilters(defaultFilters)} className="w-full py-2 text-xs text-white/25 hover:text-white/50 border border-white/5 rounded-xl hover:bg-white/5 transition">Reset Filters</button>
        </div>

        {/* Table */}
        <div className="flex-1 min-w-0">
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input type="text" placeholder="Search stocks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/8 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent-orange/30 transition" />
          </div>

          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-white/20 text-sm">Loading stock data...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-white/25 border-b border-white/5">
                      <SortHeader label="Stock" field="symbol" />
                      <SortHeader label="Price" field="price" />
                      <SortHeader label="Chg%" field="changePercent" />
                      <SortHeader label="Sector" field="sector" />
                      <th className="px-4 py-3 text-xs font-medium">Trade</th>
                    </tr></thead>
                    <tbody>
                      {filteredStocks.map(stock => (
                        <tr key={stock.symbol}
                          className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
                          onClick={() => setSelectedStock(stock)}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-white">{stock.name}</p>
                            <p className="text-xs text-white/25">{stock.symbol}</p>
                          </td>
                          <td className="text-right px-4 py-3 text-white/70 font-medium">₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td className={`text-right px-4 py-3 font-bold ${stock.changePercent >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                          </td>
                          <td className="text-right px-4 py-3 text-white/30 text-xs">{stock.sector}</td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowTradeModal(stock)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-orange/10 text-accent-orange border border-accent-orange/20 hover:bg-accent-orange/20 transition">
                              Trade
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!filteredStocks.length && <tr><td colSpan={5} className="text-center py-8 text-white/20">No stocks found</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-white/5 text-xs text-white/20">{filteredStocks.length} stocks</div>
              </>
            )}
          </div>
        </div>
      </div>

      <StockDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} onTrade={() => {}} />
      {showTradeModal && <PaperTradeModal stock={showTradeModal} onClose={() => setShowTradeModal(null)} onTrade={() => setShowTradeModal(null)} />}
    </div>
  );
}
