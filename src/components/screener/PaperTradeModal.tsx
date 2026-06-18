import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Stock } from '../../types';

interface Props {
  stock: Stock;
  onClose: () => void;
  onTrade: () => void;
}

export default function PaperTradeModal({ stock, onClose, onTrade }: Props) {
  const { user } = useAuth();
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('1');
  const [balance, setBalance] = useState(1000000);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('paper_wallet').select('balance').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setBalance(Number(data.balance));
      else supabase.from('paper_wallet').insert({ user_id: user.id, balance: 1000000, total_invested: 0 });
    });
  }, [user]);

  const qty = parseInt(quantity) || 0;
  const totalCost = qty * stock.price;
  const canAfford = tradeType === 'BUY' ? totalCost <= balance : qty > 0;

  const handleSubmit = async () => {
    if (!user || !canAfford || qty <= 0) return;
    setSubmitting(true);
    const totalValue = tradeType === 'BUY' ? -totalCost : totalCost;
    await supabase.from('paper_trades').insert({
      user_id: user.id, symbol: stock.symbol, company_name: stock.name,
      trade_type: tradeType, quantity: qty, price: stock.price, total_value: Math.abs(totalCost),
    });
    const newBalance = tradeType === 'BUY' ? balance - totalCost : balance + totalCost;
    const newInvested = tradeType === 'BUY' ? totalCost : 0;
    await supabase.from('paper_wallet').upsert({
      user_id: user.id,
      balance: newBalance,
      total_invested: newInvested,
    });
    onTrade();
    onClose();
    setSubmitting(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-extrabold text-lg text-white">Paper Trade</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition"><X className="w-4 h-4 text-white/40" /></button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className="font-bold text-white">{stock.name}</span>
          <span className="text-white/30 text-sm">{stock.symbol}</span>
          <span className="ml-auto font-extrabold text-white">₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        </div>

        {/* BUY/SELL toggle */}
        <div className="flex gap-2 mb-5">
          <button onClick={() => setTradeType('BUY')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${tradeType === 'BUY' ? 'bg-gain/20 text-gain border border-gain/30' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
            <TrendingUp className="w-4 h-4 inline mr-1" />BUY
          </button>
          <button onClick={() => setTradeType('SELL')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${tradeType === 'SELL' ? 'bg-loss/20 text-loss border border-loss/30' : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'}`}>
            <TrendingDown className="w-4 h-4 inline mr-1" />SELL
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/30 mb-1 block">Quantity</label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-accent-orange/50 transition" />
          </div>
          <div className="flex justify-between items-center py-3 border-y border-white/5">
            <span className="text-white/40 text-sm">Total Cost</span>
            <span className={`font-extrabold text-lg ${tradeType === 'BUY' && !canAfford ? 'text-loss' : 'text-white'}`}>₹{totalCost.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="w-4 h-4 text-accent-amber" />
            <span className="text-white/40">Wallet Balance:</span>
            <span className="font-bold text-white">₹{balance.toLocaleString('en-IN')}</span>
          </div>
          {tradeType === 'BUY' && !canAfford && <p className="text-loss text-xs">Insufficient balance</p>}
        </div>

        <button onClick={handleSubmit} disabled={submitting || !canAfford || qty <= 0}
          className={`w-full mt-5 py-3 rounded-xl font-bold text-white transition disabled:opacity-40 ${tradeType === 'BUY' ? 'bg-gradient-orange' : 'bg-loss'}`}>
          {submitting ? 'Processing...' : `${tradeType} ${stock.symbol}`}
        </button>
      </motion.div>
    </motion.div>
  );
}
