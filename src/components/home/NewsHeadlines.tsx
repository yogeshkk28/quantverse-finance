import type { NewsArticle } from '../../types';
import { ExternalLink } from 'lucide-react';

export default function NewsHeadlines({ articles }: { articles: NewsArticle[] }) {
  if (!articles.length) return null;
  return (
    <div className="glass-card p-6">
      <h3 className="font-bold text-white text-sm mb-5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent-orange animate-pulse-glow" />
        Market News
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {articles.map((article, i) => (
          <a key={i} href={article.url} target="_blank" rel="noopener noreferrer" className="glass-card-hover p-0 overflow-hidden group">
            <div className="h-32 overflow-hidden">
              <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
            </div>
            <div className="p-4">
              <h4 className="text-sm font-semibold text-white/90 line-clamp-2 group-hover:text-accent-orange transition-colors">{article.title}</h4>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-white/30">{article.source}</span>
                <div className="flex items-center gap-1 text-xs text-white/20"><span>{article.timeAgo}</span><ExternalLink className="w-3 h-3" /></div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
