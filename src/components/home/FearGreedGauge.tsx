import type { FearGreedData } from '../../types';
import { motion } from 'framer-motion';

export default function FearGreedGauge({ data }: { data: FearGreedData | null }) {
  const value = data?.value ?? 50;
  const classification = data?.valueClassification ?? 'Neutral';

  const getColor = (v: number) => {
    if (v <= 25) return '#EF4444';
    if (v <= 45) return '#F97316';
    if (v <= 55) return '#F59E0B';
    if (v <= 75) return '#84CC16';
    return '#10B981';
  };

  const color = getColor(value);
  const angle = (value / 100) * 180 - 90;

  return (
    <div className="glass-card p-8 flex flex-col items-center">
      <h3 className="font-bold text-white text-sm mb-6">Fear & Greed Index</h3>
      <div className="relative w-64 h-32">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <path d="M 10 90 A 90 90 0 0 1 190 90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="18" strokeLinecap="round" />
          <defs>
            <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="25%" stopColor="#F97316" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="75%" stopColor="#84CC16" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <path d="M 10 90 A 90 90 0 0 1 190 90" fill="none" stroke="url(#gg)" strokeWidth="18" strokeLinecap="round" />
          <motion.g initial={{ rotate: -90 }} animate={{ rotate: angle }} transition={{ type: 'spring', stiffness: 60, damping: 15 }} style={{ transformOrigin: '100px 90px' }}>
            <line x1="100" y1="90" x2="100" y2="22" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="100" cy="90" r="5" fill={color} />
          </motion.g>
        </svg>
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center -mt-2">
        <p className="text-5xl font-extrabold" style={{ color }}>{value}</p>
        <p className="text-white/50 text-sm mt-1">{classification}</p>
      </motion.div>
      <div className="flex justify-between w-full mt-5 text-xs text-white/20">
        <span>Extreme Fear</span><span>Neutral</span><span>Extreme Greed</span>
      </div>
    </div>
  );
}
