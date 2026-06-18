import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Stock, Timeframe } from '../../types';
import { fetchCandles } from '../../lib/api';
import { createChart, ColorType } from 'lightweight-charts';
import type { IChartApi, UTCTimestamp } from 'lightweight-charts';
import PaperTradeModal from './PaperTradeModal';

function computeEMA(data: { close: number; time: number }[], period: number) {
  const result: { time: UTCTimestamp; value: number }[] = [];
  if (data.length < period) return result;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
  for (let i = period - 1; i < data.length; i++) {
    if (i === period - 1) { result.push({ time: data[i].time as UTCTimestamp, value: parseFloat(ema.toFixed(2)) }); }
    else { ema = data[i].close * k + ema * (1 - k); result.push({ time: data[i].time as UTCTimestamp, value: parseFloat(ema.toFixed(2)) }); }
  }
  return result;
}

interface Props {
  stock: Stock | null;
  onClose: () => void;
  onTrade: () => void;
}

export default function StockDrawer({ stock, onClose, onTrade }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('3M');
  const [candleLoading, setCandleLoading] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);

  useEffect(() => {
    if (!stock || !chartContainerRef.current) return;
    setCandleLoading(true);

    const now = Math.floor(Date.now() / 1000);
    const resolutionMap: Record<Timeframe, string> = { '1D': '60', '1W': 'D', '1M': 'D', '3M': 'D', '1Y': 'W' };
    const fromMap: Record<Timeframe, number> = {
      '1D': now - 86400, '1W': now - 7 * 86400, '1M': now - 30 * 86400, '3M': now - 90 * 86400, '1Y': now - 365 * 86400,
    };

    fetchCandles(stock.symbol, resolutionMap[timeframe], fromMap[timeframe], now).then(candleData => {
      if (!chartContainerRef.current || !candleData.length) { setCandleLoading(false); return; }

      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

      const container = chartContainerRef.current;
      const chart = createChart(container, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(255,255,255,0.3)', fontSize: 11 },
        grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
        width: container.clientWidth,
        height: 300,
        timeVisible: true,
      });
      chartRef.current = chart;

      const cs = chart.addCandlestickSeries({
        upColor: '#10B981', downColor: '#EF4444', borderUpColor: '#10B981', borderDownColor: '#EF4444', wickUpColor: '#10B981', wickDownColor: '#EF4444',
      });
      cs.setData(candleData.map(d => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })));

      const vs = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
      vs.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      vs.setData(candleData.map(d => ({ time: d.time as UTCTimestamp, value: d.volume, color: d.close >= d.open ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' })));

      chart.addLineSeries({ color: '#F97316', lineWidth: 1, title: 'EMA 20' }).setData(computeEMA(candleData, 20));
      chart.addLineSeries({ color: '#06B6D4', lineWidth: 1, title: 'EMA 50' }).setData(computeEMA(candleData, 50));
      chart.addLineSeries({ color: '#F59E0B', lineWidth: 1, title: 'EMA 200' }).setData(computeEMA(candleData, 200));
      chart.timeScale().fitContent();

      const handleResize = () => chart.applyOptions({ width: container.clientWidth });
      window.addEventListener('resize', handleResize);
      setCandleLoading(false);

      return () => { window.removeEventListener('resize', handleResize); chart.remove(); chartRef.current = null; };
    });
  }, [stock, timeframe]);

  if (!stock) return null;

  const isPositive = stock.changePercent >= 0;
  const timeframes: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y'];

  return (
    <>
      <AnimatePresence>
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-full sm:w-[480px] z-40 bg-dark-900/95 backdrop-blur-xl border-l border-white/5 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-dark-900/90 backdrop-blur-xl p-5 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-white">{stock.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xl font-extrabold text-white">₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-lg ${isPositive ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}>
                    {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition"><X className="w-5 h-5 text-white/40" /></button>
            </div>

            {/* Timeframe switcher */}
            <div className="flex gap-1 mt-4">
              {timeframes.map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${timeframe === tf ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/25' : 'text-white/30 hover:bg-white/5'}`}>
                  {tf}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-3 text-xs text-white/25">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-accent-orange rounded" />20</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-neon-cyan rounded" />50</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-accent-amber rounded" />200</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="p-3">
            {candleLoading && <div className="h-[300px] flex items-center justify-center text-white/20 text-sm">Loading chart...</div>}
            <div ref={chartContainerRef} />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 p-5 border-t border-white/5">
            {[
              { label: 'Sector', value: stock.sector ?? '-' },
              { label: 'Volume', value: stock.volume ? `${(stock.volume / 1000000).toFixed(1)}M` : '-' },
            ].map(({ label, value }) => (
              <div key={label} className="glass-card-sm p-3"><p className="text-xs text-white/30">{label}</p><p className="text-sm font-bold text-white">{value}</p></div>
            ))}
          </div>

          {/* Paper Trade button */}
          <div className="p-5 border-t border-white/5">
            <button onClick={() => setShowTradeModal(true)} className="w-full py-3 rounded-xl bg-gradient-orange text-white font-bold text-sm hover:opacity-90 transition glow-orange">
              Paper Trade {stock.symbol}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Overlay */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-30 bg-black/30" onClick={onClose} />

      {showTradeModal && stock && <PaperTradeModal stock={stock} onClose={() => setShowTradeModal(false)} onTrade={onTrade} />}
    </>
  );
}
