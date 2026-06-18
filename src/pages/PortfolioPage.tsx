import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchIndianStocks } from '../lib/api';
import type { Stock } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, ShieldAlert, LogIn, ArrowLeftRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const COLORS = ['#F97316', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444', '#6366F1', '#22D3EE', '#A855F7', '#84CC16'];

interface TradeRow {
  id: string;
  symbol: string;
  company_name: string;
  trade_type: string;
  quantity: number;
  price: number;
  total_value: number;
  created_at: string;
}

function AddHoldingModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { user } = useAuth();
  const [symbol, setSymbol] = useState('');
  const [qty, setQty] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);
  const [sector, setSector] = useState('IT');
  const [submitting, setSubmitting] = useState(false);
  const sectors = ['Energy', 'IT', 'Banking', 'Telecom', 'Infrastructure', 'Consumer', 'Auto', 'Power', 'Mining', 'FMCG', 'Pharma', 'Financial Services'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    await supabase.from('portfolios').insert({ user_id: user.id, symbol: symbol.toUpperCase(), qty: Number(qty), buy_price: Number(buyPrice), buy_date: buyDate, sector });
    onAdded();
    onClose();
    setSubmitting(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="glass-card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="font-extrabold text-lg text-white mb-5">Add Holding</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="text-xs text-white/30">Symbol</label><input type="text" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="RELIANCE" className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent-orange/40" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/30">Qty</label><input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="10" className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent-orange/40" required min="1" /></div>
            <div><label className="text-xs text-white/30">Buy Price</label><input type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="2500" className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent-orange/40" required min="0" step="0.01" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/30">Date</label><input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-orange/40" required /></div>
            <div><label className="text-xs text-white/30">Sector</label><select value={sector} onChange={e => setSector(e.target.value)} className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-orange/40">{sectors.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-white/8 rounded-xl text-white/40 hover:bg-white/5 transition text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-gradient-orange rounded-xl text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-40">{submitting ? 'Adding...' : 'Add'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function PortfolioPage() {
  const { user, loading: authLoading } = useAuth();
  const [holdings, setHoldings] = useState<{ id: string; symbol: string; qty: number; buy_price: number; sector: string }[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [wallet, setWallet] = useState<{ balance: number; total_invested: number }>({ balance: 1000000, total_invested: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'holdings' | 'trades'>('holdings');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [holdRes, tradeRes, walletRes] = await Promise.all([
      supabase.from('portfolios').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('paper_trades').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('paper_wallet').select('*').eq('user_id', user.id).single(),
    ]);
    if (holdRes.data) setHoldings(holdRes.data);
    if (tradeRes.data) setTrades(tradeRes.data as TradeRow[]);
    if (walletRes.data) setWallet({ balance: Number(walletRes.data.balance), total_invested: Number(walletRes.data.total_invested) });
    else {
      await supabase.from('paper_wallet').insert({ user_id: user.id, balance: 1000000, total_invested: 0 });
      setWallet({ balance: 1000000, total_invested: 0 });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchIndianStocks().then(d => d.length && setAllStocks(d)); }, []);

  const enrichedHoldings = useMemo(() => holdings.map(h => {
    const s = allStocks.find(a => a.symbol === h.symbol || a.symbol === h.symbol + '.NS');
    const currentPrice = s?.price ?? h.buy_price;
    const pnl = (currentPrice - h.buy_price) * h.qty;
    const pnlPercent = ((currentPrice - h.buy_price) / h.buy_price) * 100;
    return { ...h, currentPrice, pnl, pnlPercent };
  }), [holdings, allStocks]);

  const totalInvested = enrichedHoldings.reduce((s, h) => s + h.buy_price * h.qty, 0);
  const currentValue = enrichedHoldings.reduce((s, h) => s + h.currentPrice * h.qty, 0);
  const totalPnL = currentValue - totalInvested;

  const assetAllocation = useMemo(() => {
    const map: Record<string, number> = {};
    enrichedHoldings.forEach(h => { map[h.symbol] = (map[h.symbol] || 0) + h.currentPrice * h.qty; });
    return Object.entries(map).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(0)) }));
  }, [enrichedHoldings]);

  const sectorAllocation = useMemo(() => {
    const map: Record<string, number> = {};
    enrichedHoldings.forEach(h => { map[h.sector] = (map[h.sector] || 0) + h.currentPrice * h.qty; });
    return Object.entries(map).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(0)) }));
  }, [enrichedHoldings]);

  if (authLoading) return null;
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 text-center max-w-md">
          <LogIn className="w-12 h-12 text-accent-orange mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-white mb-2">Sign In Required</h2>
          <p className="text-white/40 text-sm mb-4">Please sign in to access your portfolio</p>
          <Link to="/auth" className="inline-block bg-gradient-orange text-white font-bold px-6 py-2.5 rounded-xl hover:opacity-90 transition">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl md:text-3xl font-extrabold text-white">Portfolio</h1><p className="text-white/30 text-sm mt-1">Track investments & paper trades</p></div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-gradient-orange text-white px-4 py-2.5 rounded-xl hover:opacity-90 transition text-sm font-bold"><Plus className="w-4 h-4" />Add Holding</button>
      </motion.div>

      {/* Wallet + Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-accent-amber" /><span className="text-xs text-white/30">Paper Wallet</span></div>
          <p className="text-2xl font-extrabold text-white">₹{wallet.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-white/20 mt-1">Available balance</p>
        </div>
        {[
          { label: 'Invested', value: `₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: TrendingUp, isGain: undefined as boolean | undefined },
          { label: 'Current Value', value: `₹${currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: TrendingUp, isGain: undefined as boolean | undefined },
          { label: 'Total P&L', value: `₹${totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: totalPnL >= 0 ? TrendingUp : TrendingDown, isGain: totalPnL >= 0 },
        ].map(({ label, value, icon: Icon, isGain }) => (
          <div key={label} className="glass-card p-5">
            <div className="flex items-center gap-2 mb-2"><Icon className={`w-4 h-4 ${isGain === true ? 'text-gain' : isGain === false ? 'text-loss' : 'text-white/30'}`} /><span className="text-xs text-white/30">{label}</span></div>
            <p className={`text-lg font-extrabold ${isGain === true ? 'text-gain' : isGain === false ? 'text-loss' : 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('holdings')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === 'holdings' ? 'bg-accent-orange/15 text-accent-orange' : 'text-white/30 hover:text-white/50'}`}>Holdings</button>
        <button onClick={() => setActiveTab('trades')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === 'trades' ? 'bg-accent-orange/15 text-accent-orange' : 'text-white/30 hover:text-white/50'}`}>Paper Trades</button>
      </div>

      {activeTab === 'holdings' && (
        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-8 text-center text-white/20">Loading...</div> : !enrichedHoldings.length ? <div className="p-8 text-center text-white/20">No holdings yet</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/25 border-b border-white/5">
                  <th className="text-left px-4 py-2 font-medium">Stock</th><th className="text-right px-4 py-2 font-medium">Qty</th><th className="text-right px-4 py-2 font-medium">Buy</th><th className="text-right px-4 py-2 font-medium">Current</th><th className="text-right px-4 py-2 font-medium">P&L</th><th className="text-right px-4 py-2 font-medium">Sector</th><th className="px-4 py-2"></th>
                </tr></thead>
                <tbody>
                  {enrichedHoldings.map(h => (
                    <tr key={h.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-3 font-semibold text-white">{h.symbol}</td>
                      <td className="text-right px-4 py-3 text-white/50">{h.qty}</td>
                      <td className="text-right px-4 py-3 text-white/50">₹{h.buy_price.toLocaleString()}</td>
                      <td className="text-right px-4 py-3 text-white/70">₹{h.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className={`text-right px-4 py-3 font-bold ${h.pnl >= 0 ? 'text-gain' : 'text-loss'}`}>{h.pnl >= 0 ? '+' : ''}₹{h.pnl.toFixed(0)}</td>
                      <td className="text-right px-4 py-3 text-white/25 text-xs">{h.sector}</td>
                      <td className="px-4 py-3"><button onClick={async () => { await supabase.from('portfolios').delete().eq('id', h.id); fetchData(); }} className="p-1 hover:bg-loss/10 rounded-lg text-white/20 hover:text-loss transition"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'trades' && (
        <div className="glass-card overflow-hidden">
          {!trades.length ? <div className="p-8 text-center text-white/20">No paper trades yet. Use the Screener to trade!</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/25 border-b border-white/5">
                  <th className="text-left px-4 py-2 font-medium">Stock</th><th className="text-center px-4 py-2 font-medium">Type</th><th className="text-right px-4 py-2 font-medium">Qty</th><th className="text-right px-4 py-2 font-medium">Price</th><th className="text-right px-4 py-2 font-medium">Value</th><th className="text-right px-4 py-2 font-medium">Date</th>
                </tr></thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-3"><p className="font-semibold text-white">{t.symbol}</p><p className="text-xs text-white/25">{t.company_name}</p></td>
                      <td className="text-center px-4 py-3"><span className={`px-2 py-1 rounded-lg text-xs font-bold ${t.trade_type === 'BUY' ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}>{t.trade_type}</span></td>
                      <td className="text-right px-4 py-3 text-white/60">{t.quantity}</td>
                      <td className="text-right px-4 py-3 text-white/60">₹{Number(t.price).toLocaleString()}</td>
                      <td className="text-right px-4 py-3 text-white/70 font-medium">₹{Number(t.total_value).toLocaleString()}</td>
                      <td className="text-right px-4 py-3 text-white/25 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {enrichedHoldings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <h3 className="font-bold text-white text-sm mb-4">Asset Allocation</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={assetAllocation} innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>{assetAllocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2">{assetAllocation.map((a, i) => <span key={a.name} className="flex items-center gap-1 text-xs text-white/40"><span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{a.name}</span>)}</div>
          </div>
          <div className="glass-card p-5">
            <h3 className="font-bold text-white text-sm mb-4">Sector Allocation</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={sectorAllocation} innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>{sectorAllocation.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}</Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2">{sectorAllocation.map((a, i) => <span key={a.name} className="flex items-center gap-1 text-xs text-white/40"><span className="w-2 h-2 rounded-full" style={{ background: COLORS[(i + 3) % COLORS.length] }} />{a.name}</span>)}</div>
          </div>
        </div>
      )}

      {showAddModal && <AddHoldingModal onClose={() => setShowAddModal(false)} onAdded={fetchData} />}
    </div>
  );
}
