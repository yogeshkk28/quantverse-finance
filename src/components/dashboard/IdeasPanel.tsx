import React, { FormEvent, useEffect, useState } from "react";
import { PanelHead, ChipGroup, Empty } from "./parts";

interface Idea {
  id: number;
  asset: string;
  bias: "Long" | "Short";
  timeframe: string;
  thesis: string;
  at: string;
}

const KEY = "lumina_quant_ideas";
const TABS = ["Latest", "Long", "Short"] as const;
const TIMEFRAMES = ["Intraday", "Swing (days)", "Position (weeks)", "Long term"];

function load(): Idea[] {
  try {
    const raw = localStorage.getItem(KEY);
    const xs = raw ? JSON.parse(raw) : [];
    return Array.isArray(xs) ? xs : [];
  } catch {
    return [];
  }
}

/**
 * Trade ideas journal. Writing the thesis down before a paper trade is the habit
 * this builds. Ideas stay on this device for now; sharing them with other
 * traders comes with the community launch.
 */
export default function IdeasPanel({ symbols }: { symbols: string[] }) {
  const [ideas, setIdeas] = useState<Idea[]>(load);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Latest");
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ideas));
    } catch {}
  }, [ideas]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const thesis = String(f.get("thesis") || "").trim();
    if (!thesis) return;
    setIdeas((xs) => [
      {
        id: Date.now(),
        asset: String(f.get("asset")),
        bias: f.get("bias") === "Short" ? "Short" : "Long",
        timeframe: String(f.get("timeframe")),
        thesis: thesis.slice(0, 600),
        at: new Date().toISOString(),
      },
      ...xs,
    ]);
    setComposing(false);
  }

  const shown = ideas.filter((i) => tab === "Latest" || i.bias === tab);
  const longs = ideas.filter((i) => i.bias === "Long").length;
  const longPct = ideas.length ? Math.round((longs / ideas.length) * 100) : 0;

  return (
    <section id="community" className="lq-panel lq-rise p-5 md:p-6 flex flex-col gap-4 min-w-0" aria-labelledby="ideas-h" style={{ "--lq-i": 7 } as React.CSSProperties}>
      <PanelHead
        id="ideas-h"
        title="Trade ideas"
        aside={
          <button type="button" className="lq-btn" onClick={() => setComposing((c) => !c)} aria-expanded={composing}>
            {composing ? "Cancel" : "Post an idea"}
          </button>
        }
      >
        <span className="lq-lbl">Your journal</span>
      </PanelHead>

      {composing && (
        <form onSubmit={submit} className="lq-card p-4 grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="lq-lbl">Asset</span>
            <select name="asset" className="lq-input">
              {symbols.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="lq-lbl">Bias</span>
            <select name="bias" className="lq-input">
              <option>Long</option>
              <option>Short</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="lq-lbl">Timeframe</span>
            <select name="timeframe" className="lq-input">
              {TIMEFRAMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-3">
            <span className="lq-lbl">Thesis: why, entry, where you're wrong</span>
            <textarea name="thesis" required maxLength={600} rows={3} className="lq-input py-2 resize-y" />
          </label>
          <div className="sm:col-span-3 flex items-center gap-3">
            <button type="submit" className="lq-btn">
              Save idea
            </button>
            <span className="text-[12px] text-lq-muted">Saved on this device only.</span>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ChipGroup label="Filter ideas" options={TABS} value={tab} onChange={setTab} />
        {ideas.length > 0 && (
          <span className="ml-auto flex items-center gap-2 text-[12px] text-lq-muted">
            Your bias
            <span className="w-28 h-1.5 rounded-full overflow-hidden bg-lq-down/70 flex" aria-hidden="true">
              <span className="h-full bg-lq-up" style={{ width: `${longPct}%` }} />
            </span>
            <span className="lq-num">{longPct}% long</span>
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <Empty>
          {ideas.length === 0
            ? "No ideas yet. Write down your next trade's thesis before you place it on paper."
            : "No ideas match this filter."}
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.slice(0, 9).map((i) => (
            <article key={i.id} className="lq-card p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`lq-num text-[11px] px-2 py-1 rounded ${i.bias === "Long" ? "bg-lq-up/15 lq-up" : "bg-lq-down/15 lq-down"}`}>
                  {i.bias === "Long" ? "▲ LONG" : "▼ SHORT"}
                </span>
                <span className="lq-lbl">
                  {i.asset} · {i.timeframe}
                </span>
              </div>
              <p className="text-[13px] text-lq-text-2 m-0 leading-relaxed line-clamp-4">{i.thesis}</p>
              <div className="flex items-center justify-between mt-auto pt-1">
                <span className="lq-num text-[11px] text-lq-muted">{new Date(i.at).toLocaleDateString()}</span>
                <button
                  type="button"
                  onClick={() => setIdeas((xs) => xs.filter((x) => x.id !== i.id))}
                  className="text-[12px] text-lq-muted hover:text-lq-text"
                  aria-label={`Delete idea on ${i.asset}`}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="text-[11px] text-lq-muted m-0">Sharing ideas with other traders arrives with the community launch.</p>
    </section>
  );
}
