import React, { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
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

/** Financial news: a lead story with image, then a dense, scrollable wire. */
export default function NewsPanel({ data }: { data: NewsResponse | null | undefined }) {
  const [topic, setTopic] = useState("All");
  const items = data?.items ?? [];
  const topics = useMemo(() => ["All", ...Array.from(new Set(items.map((s) => s.topic))).slice(0, 6)], [items]);
  const shown = items.filter((s) => topic === "All" || s.topic === topic);
  const lead = shown.find((s) => s.image) ?? shown[0];
  const rest = shown.filter((s) => s !== lead).slice(0, 24);

  return (
    <section id="news" className="lq-panel lq-rise p-6 md:p-7 flex flex-col gap-5 min-w-0" aria-labelledby="news-h" style={{ "--lq-i": 7 } as React.CSSProperties}>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
        <span className="lq-marker" aria-hidden="true" />
        <h2 id="news-h" className="lq-h2">
          Market news
        </h2>
        <span className="lq-lbl">{data?.sample ? "Sample headlines · add FINNHUB_API for live news" : data?.provider ?? ""}</span>
      </div>
      {topics.length > 2 && (
        <div role="group" aria-label="News topic" className="flex gap-2 overflow-x-auto pb-1">
          {topics.map((t) => (
            <button key={t} type="button" className="lq-chip" aria-pressed={topic === t} onClick={() => setTopic(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      {data === undefined ? (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <Skeleton className="h-[340px]" />
          <Skeleton className="h-[340px]" />
        </div>
      ) : !lead ? (
        <p className="m-0 py-6 text-center text-[13px] text-lq-muted">No headlines right now.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr] min-w-0">
          <Story item={lead} lead />
          <div role="feed" aria-label="More headlines" tabIndex={0} className="flex flex-col max-h-[420px] overflow-y-auto pr-2 -mr-2">
            {rest.map((s) => (
              <Story key={s.id} item={s} />
            ))}
            {rest.length === 0 && <p className="m-0 py-6 text-center text-[13px] text-lq-muted">No more headlines in this topic.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function Story({ item, lead = false }: { item: NewsItem; lead?: boolean }) {
  const Wrap: React.ElementType = item.url ? "a" : "div";
  const linkProps = item.url ? { href: item.url, target: "_blank", rel: "noopener noreferrer" } : {};
  if (lead) {
    return (
      <article className="lq-card overflow-hidden flex flex-col min-w-0">
        <Wrap {...linkProps} className="group flex flex-col h-full">
          {item.image ? (
            <span className="block h-[190px] overflow-hidden bg-lq-bg-2">
              <img src={item.image} alt="" loading="lazy" className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
            </span>
          ) : (
            <span aria-hidden="true" className="block h-[120px] bg-[radial-gradient(circle_at_80%_10%,rgba(143,123,255,0.22),transparent_60%),radial-gradient(circle_at_10%_90%,rgba(212,175,55,0.14),transparent_55%)]" />
          )}
          <span className="p-5 flex flex-col gap-2 flex-1">
            <span className="lq-lbl text-lq-gold">
              {item.topic} · {item.source}
            </span>
            <h3 className="font-serif text-[24px] leading-tight m-0 text-lq-text group-hover:text-lq-gold-soft transition-colors">{item.title}</h3>
            {item.summary && <p className="m-0 text-[13px] text-lq-text-2 leading-relaxed line-clamp-3">{item.summary}</p>}
            <span className="mt-auto pt-2 flex items-center gap-2 text-[12px] text-lq-muted">
              <span className="lq-num">{timeAgo(item.time)}</span>
              {item.url && <ExternalLink className="w-3.5 h-3.5" aria-label="Opens in a new tab" />}
            </span>
          </span>
        </Wrap>
      </article>
    );
  }
  return (
    <article className="border-b border-lq-line-soft last:border-0">
      <Wrap {...linkProps} className="group grid grid-cols-[1fr_auto] gap-3 py-3">
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
          <span className="text-[14px] text-lq-text-2 leading-snug group-hover:text-lq-text">{item.title}</span>
        </span>
        {item.image && <img src={item.image} alt="" loading="lazy" className="w-16 h-12 rounded-md object-cover opacity-80 group-hover:opacity-100 mt-1" />}
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
