import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BarChart3, Briefcase, TrendingUp, Zap, Globe, BarChart } from 'lucide-react';
import MarketTicker from '../components/home/MarketTicker';
import GainersLosers from '../components/home/GainersLosers';
import FearGreedGauge from '../components/home/FearGreedGauge';
import NewsHeadlines from '../components/home/NewsHeadlines';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { fetchMarketIndices, fetchIndianStocks, fetchFearGreed, fetchNews, fallbackIndices, fallbackFearGreed, fallbackNews } from '../lib/api';
import type { MarketIndex, Stock, FearGreedData, NewsArticle } from '../types';

export default function HomePage() {
  const [indices, setIndices] = useState<MarketIndex[]>(fallbackIndices);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(fallbackFearGreed);
  const [news, setNews] = useState<NewsArticle[]>(fallbackNews);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetchMarketIndices().then(d => d.length && setIndices(d)),
      fetchIndianStocks().then(d => d.length && setStocks(d)),
      fetchFearGreed().then(d => d && setFearGreed(d)),
      fetchNews().then(d => d.length && setNews(d)),
    ]).finally(() => setLoading(false));
  }, []);

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  const stats = [
    { icon: TrendingUp, label: 'Indices Tracked', value: 20, suffix: '+' },
    { icon: BarChart, label: 'Stocks', value: 500, suffix: '+' },
    { icon: Globe, label: 'Real-time Data', value: 24, suffix: '/7' },
    { icon: Zap, label: 'AI-Powered', value: 100, suffix: '%' },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-orange rounded-full filter blur-[150px] opacity-10 animate-float-blob" />
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative z-10">
          <h1 className="font-extrabold leading-tight" style={{ fontSize: 'clamp(48px, 8vw, 96px)' }}>
            Markets, <span className="text-gradient-orange">Decoded.</span>
          </h1>
          <p className="text-white/40 text-lg md:text-xl mt-4 max-w-xl mx-auto">
            Real-time intelligence for the modern investor
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link to="/screener" className="px-8 py-3 rounded-xl bg-gradient-orange text-white font-bold text-sm hover:opacity-90 transition glow-orange flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />Open Screener
            </Link>
            <Link to="/portfolio" className="px-8 py-3 rounded-xl border border-white/15 text-white/70 font-semibold text-sm hover:bg-white/5 hover:text-white transition flex items-center gap-2">
              <Briefcase className="w-4 h-4" />View Portfolio
            </Link>
          </div>
        </motion.div>
        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute w-1 h-1 rounded-full bg-accent-orange/20"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `floatBlob ${6 + Math.random() * 6}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 4}s`,
              }} />
          ))}
        </div>
      </section>

      {/* Market Ticker */}
      <section>
        <MarketTicker data={indices} />
      </section>

      {/* Stats */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(({ icon: Icon, label, value, suffix }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-6 text-center">
              <Icon className="w-6 h-6 text-accent-orange mx-auto mb-3" />
              <p className="text-3xl md:text-4xl font-extrabold text-white">
                <AnimatedCounter target={value} suffix={suffix} />
              </p>
              <p className="text-white/30 text-sm mt-1">{label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Gainers / Losers */}
      {stocks.length > 0 && (
        <section>
          <GainersLosers stocks={stocks} onStockClick={setSelectedStock} />
        </section>
      )}

      {/* Fear & Greed */}
      <section className="max-w-md mx-auto">
        <FearGreedGauge data={fearGreed} />
      </section>

      {/* News */}
      <section>
        <NewsHeadlines articles={news} />
      </section>
    </div>
  );
}
