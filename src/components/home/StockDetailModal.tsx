import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Stock, Timeframe } from '../../types';
import { getMockCandleData } from '../../lib/mockData';
import { createChart, ColorType } from 'lightweight-charts';
import type { IChartApi, UTCTimestamp } from 'lightweight-charts';

interface StockDetailModalProps {
  stock: Stock | null;
  onClose: () => void;
}

function computeEMA(data: { close: number; time: number }[], period: number) {
  const result: { time: UTCTimestamp; value: number }[] = [];
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
  for (let i = period - 1; i < data.length; i++) {
    if (i === period - 1) {
      result.push({ time: data[i].time as UTCTimestamp, value: parseFloat(ema.toFixed(2)) });
    } else {
      ema = data[i].close * k + ema * (1 - k);
      result.push({ time: data[i].time as UTCTimestamp, value: parseFloat(ema.toFixed(2)) });
    }
  }
  return result;
}

export default function StockDetailModal({ stock, onClose }: StockDetailModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>('3M');

  useEffect(() => {
    if (!stock || !chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(255,255,255,0.4)', fontSize: 12 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      width: container.clientWidth,
      height: 320,
      timeVisible: true,
    });
    chartRef.current = chart;

    const candleData = getMockCandleData(stock.symbol, timeframe);
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10B981', downColor: '#EF4444', borderUpColor: '#10B981', borderDownColor: '#EF4444', wickUpColor: '#10B981', wickDownColor: '#EF4444',
    });
    candleSeries.setData(candleData.map(d => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })));

    const volumeSeries = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeries.setData(candleData.map(d => ({ time: d.time as UTCTimestamp, value: d.volume, color: d.close >= d.open ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' })));

    chart.addLineSeries({ color: '#7C3AED', lineWidth: 1, title: 'EMA 20' }).setData(computeEMA(candleData, 20));
    chart.addLineSeries({ color: '#06B6D4', lineWidth: 1, title: 'EMA 50' }).setData(computeEMA(candleData, 50));
    chart.addLineSeries({ color: '#F59E0B', lineWidth: 1, title: 'EMA 200' }).setData(computeEMA(candleData, 200));

    chart.timeScale().fitContent();

    const handleResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); chartRef.current = null; };
  }, [stock, timeframe]);

  if (!stock) return null;

  const isPositive = stock.changePercent >= 0;
  const timeframes: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y'];

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          className="glass-card-purple w-full max-w-3xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-heading font-bold text-white">{stock.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-heading font-bold text-white">₹{stock.price.toLocaleString()}</span>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded ${isPositive ? 'bg-gain/20 text-gain' : 'bg-loss/20 text-loss'}`}>
                  {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition"><X className="w-5 h-5 text-white/60" /></button>
          </div>
          <div className="flex gap-1 p-4 border-b border-white/5">
            {timeframes.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${timeframe === tf ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30' : 'text-white/40 hover:bg-white/5 hover:text-white/60'}`}>
                {tf}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-neon-purple rounded" /> EMA 20</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-neon-cyan rounded" /> EMA 50</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-neon-gold rounded" /> EMA 200</span>
            </div>
          </div>
          <div ref={chartContainerRef} className="p-2" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-t border-white/5">
            {[{ label: 'P/E', value: stock.pe?.toFixed(1) ?? 'N/A' }, { label: 'Market Cap', value: stock.marketCap ?? 'N/A' }, { label: 'RSI', value: stock.rsi?.toFixed(0) ?? 'N/A' }, { label: 'Volume', value: `${(stock.volume / 1000000).toFixed(1)}M` }].map(({ label, value }) => (
              <div key={label} className="text-center"><p className="text-xs text-white/40">{label}</p><p className="text-sm font-semibold text-white">{value}</p></div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
