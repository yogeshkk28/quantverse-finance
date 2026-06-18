import type { MarketIndex } from '../../types';
import SparklineChart from '../ui/SparklineChart';

function TickerCard({ index }: { index: MarketIndex }) {
  const isPositive = index.changePercent >= 0;
  return (
    <div className="glass-card-sm px-5 py-3 flex items-center gap-4 min-w-[260px] shrink-0 hover:border-accent-orange/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-white/40 text-xs font-medium truncate">{index.name}</p>
        <p className="text-lg font-extrabold text-white">{index.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold ${isPositive ? 'text-gain' : 'text-loss'}`}>
            {isPositive ? '+' : ''}{index.change.toFixed(2)}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-md ${isPositive ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}>
            {isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
      <SparklineChart data={index.sparkline} width={70} height={32} positive={isPositive} />
    </div>
  );
}

export default function MarketTicker({ data }: { data: MarketIndex[] }) {
  if (!data.length) return null;
  const doubled = [...data, ...data];
  return (
    <div className="overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-dark-900 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-dark-900 to-transparent z-10 pointer-events-none" />
      <div className="flex gap-4 animate-scroll-ticker" style={{ width: 'max-content' }}>
        {doubled.map((idx, i) => <TickerCard key={`${idx.symbol}-${i}`} index={idx} />)}
      </div>
    </div>
  );
}
