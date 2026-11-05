import React, { useMemo, useState } from "react";
import { useJson, timeAgo, Skeleton } from "./ui";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string | null;
  image: string | null;
  time: string | null;
  topic: string;
  related: string[];
}
export interface NewsResponse {
  provider: string;
  sample: boolean;
  items: NewsItem[];
}

/** Financial news as a compact two-column wire with topic filters. */
export default function NewsPanel({ data }: { data: NewsResponse | null | undefined }) {
  const [topic, setTopic] = useState("All");
  const [more, setMore] = useState(false);
  const items = data?.items ?? [];
  const topics = useMemo(() => ["All", ...Array.from(new Set(items.map((s) => s.topic))).slice(0, 6)], [items]);
  const shown = items.filter((s) => topic === "All" || s.topic === topic).slice(0, more ? 40 : 10);

  return (
    <section id="news" className="lq-panel lq-rise p-5 flex flex-col gap-3 min-w-0" aria-labelledby="news-h">
      <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
        <h2 id="news-h" className="m-0 text-[17px] font-semibold text-lq-text">
          Market news
        </h2>
        <span className="text-[11px] text-lq-muted">{data?.sample ? "Sample headlines · add FINNHUB_API for live news" : data?.provider ?? ""}</span>
        {topics.length > 2 && (
          <div role="group" aria-label="News topic" className="ml-auto flex gap-1 overflow-x-auto">
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={topic === t}
                onClick={() => setTopic(t)}
                className={`px-2 py-1 rounded-md text-[11px] whitespace-nowrap ${topic === t ? "bg-lq-surface-2 text-lq-text border border-lq-line-2" : "text-lq-muted hover:text-lq-text border border-transparent"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      {data === undefined ? (
        <Skeleton className="h-[260px]" />
      ) : shown.length === 0 ? (
        <p className="m-0 py-6 text-center text-[13px] text-lq-muted">No headlines right now.</p>
      ) : (
        <div role="feed" aria-label="Headlines" className="grid md:grid-cols-2 gap-x-8">
          {shown.map((s) => (
            <Story key={s.id} item={s} />
          ))}
        </div>
      )}
      {items.length > 10 && (
        <button type="button" onClick={() => setMore((m) => !m)} className="self-start text-[13px] text-lq-gold hover:text-lq-gold-soft">
          {more ? "Show fewer" : "More headlines ›"}
        </button>
      )}
    </section>
  );
}

function Story({ item }: { item: NewsItem }) {
  const Wrap: React.ElementType = item.url ? "a" : "div";
  const linkProps = item.url ? { href: item.url, target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <article className="border-b border-lq-line-soft last:border-0">
      <Wrap {...linkProps} className="group grid grid-cols-[1fr_auto] gap-3 py-2.5">
        <span className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-2 text-[11px] text-lq-muted">
            <span className="text-lq-gold/90">{item.source}</span>
            {item.time && <span className="lq-num">· {timeAgo(item.time)}</span>}
            {item.related.slice(0, 2).map((r) => (
              <span key={r} className="lq-num text-[10px] px-1 rounded border border-lq-line">
                {r}
              </span>
            ))}
          </span>
          <span className="text-[13px] text-lq-text-2 leading-snug group-hover:text-lq-text line-clamp-2">{item.title}</span>
        </span>
        {item.image && <img src={item.image} alt="" loading="lazy" className="w-14 h-10 rounded-md object-cover opacity-90 group-hover:opacity-100 mt-0.5" />}
      </Wrap>
    </article>
  );
}

/** Light keyword match so the dossier can show a headline about the instrument in focus. */
const KEYWORDS: Record<string, string[]> = {
  "^GSPC": ["s&p", "wall street", "stocks", "fed"],
  "^IXIC": ["nasdaq", "tech", "ai "],
  "^DJI": ["dow"],
  "^NSEI": ["nifty", "india", "sensex"],
  "^BSESN": ["sensex", "india", "nifty"],
  "^NSEBANK": ["bank nifty", "banks", "india"],
  "CL=F": ["oil", "crude", "opec"],
  "BZ=F": ["brent", "oil", "crude"],
  "NG=F": ["natural gas", "lng", "gas"],
  "GC=F": ["gold"],
  "SI=F": ["silver"],
  "HG=F": ["copper", "metals"],
  "USDINR=X": ["rupee", "rbi", "india"],
  "DX-Y.NYB": ["dollar"],
  "BTC-USD": ["bitcoin", "crypto"],
  "ETH-USD": ["ether", "crypto"],
};

export function headlineFor(symbol: string, short: string, items: NewsItem[]): NewsItem | null {
  const words = KEYWORDS[symbol] ?? [short.toLowerCase()];
  const hit = items.find((n) => n.related.includes(short) || words.some((w) => `${n.title} ${n.summary}`.toLowerCase().includes(w)));
  return hit ?? null;
}

export function useNews() {
  return useJson<NewsResponse>("/api/market-news", 5 * 60_000);
}
