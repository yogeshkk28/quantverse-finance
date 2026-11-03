import React, { useEffect, useMemo, useState } from "react";
import { PanelHead, Empty } from "./parts";

interface Story {
  id: string;
  title: string;
  category: string;
  timestamp: string;
}

/** Newsfeed from /api/news (NewsData.io when keyed, otherwise clearly labelled samples). */
export default function StoriesPanel() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [topic, setTopic] = useState("All");

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((d) => {
        setStories(Array.isArray(d.news) ? d.news : []);
        setProvider(d.provider ?? "");
      })
      .catch(() => setStories([]));
  }, []);

  const topics = useMemo(() => ["All", ...Array.from(new Set((stories ?? []).map((s) => s.category))).slice(0, 7)], [stories]);
  const shown = (stories ?? []).filter((s) => topic === "All" || s.category === topic);
  const [lead, ...rest] = shown;
  const sample = !provider || /mock|sample/i.test(provider);

  return (
    <section className="lq-panel lq-rise p-5 md:p-6 flex flex-col gap-4 min-w-0" aria-labelledby="ts-h" style={{ "--lq-i": 6 } as React.CSSProperties}>
      <PanelHead id="ts-h" title="Top stories" aside={<span className="lq-lbl">{sample ? "Sample headlines" : "Newsfeed"}</span>} />
      <div role="group" aria-label="Story topic" className="flex gap-2 overflow-x-auto pb-1">
        {topics.map((t) => (
          <button key={t} type="button" className="lq-chip" aria-pressed={topic === t} onClick={() => setTopic(t)}>
            {t}
          </button>
        ))}
      </div>
      {stories === null ? (
        <Empty>Loading stories…</Empty>
      ) : !lead ? (
        <Empty>No stories right now.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
          <article className="lq-card p-5 flex flex-col gap-3 relative overflow-hidden">
            <div aria-hidden="true" className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[radial-gradient(closest-side,rgba(143,123,255,0.18),transparent)]" />
            <span className="lq-lbl text-lq-gold">Lead story · {lead.category}</span>
            <h3 className="font-serif text-[24px] leading-tight m-0 text-lq-text">{lead.title}</h3>
            <span className="lq-num text-[12px] text-lq-muted mt-auto">{lead.timestamp}</span>
          </article>
          <div role="feed" aria-label="More stories" tabIndex={0} className="flex flex-col max-h-[320px] overflow-y-auto pr-1">
            {rest.map((s) => (
              <article key={s.id} className="grid grid-cols-[64px_1fr] gap-3 py-3 border-b border-lq-line-soft last:border-0">
                <span className="lq-num text-[11px] text-lq-muted pt-0.5">{s.timestamp}</span>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-lq-text-2 leading-snug">{s.title}</span>
                  <span className="lq-lbl text-[10px]">{s.category}</span>
                </div>
              </article>
            ))}
            {rest.length === 0 && <Empty>No more stories in this topic.</Empty>}
          </div>
        </div>
      )}
    </section>
  );
}
