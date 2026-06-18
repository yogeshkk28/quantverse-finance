import type { Stock } from '../../types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  stocks: Stock[];
  onStockClick: (stock: Stock) => void;
}

export default function GainersLosers({ stocks, onStockClick }: Props) {
  const gainers = [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const losers = [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

  function Table({ items, title, isGainer }: { items: Stock[]; title: string; isGainer: boolean }) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center gap-2">
          {isGainer ? <TrendingUp className="w-4 h-4 text-gain" /> : <TrendingDown className="w-4 h-4 text-loss" />}
          <h3 className="font-bold text-white text-sm">{title}</h3>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-white/30 border-b border-white/5">
            <th className="text-left px-4 py-2 font-medium">Stock</th>
            <th className="text-right px-4 py-2 font-medium">Price</th>
            <th className="text-right px-4 py-2 font-medium">Chg%</th>
            <th className="text-right px-4 py-2 font-medium">Volume</th>
          </tr></thead>
          <tbody>
            {items.map(stock => (
              <tr key={stock.symbol} onClick={() => onStockClick(stock)} className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
                <td className="px-4 py-3"><p className="font-medium text-white">{stock.name}</p><p className="text-xs text-white/30">{stock.symbol}</p></td>
                <td className="text-right px-4 py-3 text-white/80">₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td className={`text-right px-4 py-3 font-semibold ${stock.changePercent >= 0 ? 'text-gain' : 'text-loss'}`}>{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</td>
                <td className="text-right px-4 py-3 text-white/40">{stock.volume ? (stock.volume / 1000000).toFixed(1) + 'M' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Table items={gainers} title="Top Gainers" isGainer />
      <Table items={losers} title="Top Losers" isGainer={false} />
    </div>
  );
}
