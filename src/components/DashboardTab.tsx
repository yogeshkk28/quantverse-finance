import React from "react";
import { ActiveTab, Ticker } from "../types";
import { useAuth } from "../context/AuthContext";
import { useMarketSummary } from "./MarketStatusPill";
import { formatWait } from "../landing/marketHours";
import MiniCorrelationWeb from "./MiniCorrelationWeb";
import IndicesPanel from "./dashboard/IndicesPanel";
import { SentimentPanel, MacroPanel } from "./dashboard/SentimentPanel";
import MostActivePanel from "./dashboard/MostActivePanel";
import CryptoPanel from "./dashboard/CryptoPanel";
import StoriesPanel from "./dashboard/StoriesPanel";
import IdeasPanel from "./dashboard/IdeasPanel";
import { PaperAccount, Watchlist, SignalsPanel } from "./dashboard/Rail";
import { PanelHead, ChipGroup } from "./dashboard/parts";

interface DashboardTabProps {
  tickers: Ticker[];
  portfolio: { cash: number; positions: { [id: string]: { qty: number; avgCost: number } } };
  onSelectTicker: (tickerId: string) => void;
  onOpenTab: (tab: ActiveTab) => void;
}

function greeting(d: Date) {
  const h = d.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function nameFrom(email?: string) {
  const local = (email ?? "").split("@")[0].split(/[._+-]/)[0];
  return local ? local[0].toUpperCase() + local.slice(1) : "";
}

const IPO_STAGES = ["Upcoming", "Open now", "Recently listed"] as const;

function IpoPanel() {
  const [stage, setStage] = React.useState<(typeof IPO_STAGES)[number]>("Upcoming");
  return (
    <section id="ipo" className="lq-panel lq-rise p-5 md:p-6 flex flex-col gap-4" aria-labelledby="ipo-h" style={{ "--lq-i": 5 } as React.CSSProperties}>
      <PanelHead id="ipo-h" title="IPO tracker" aside={<ChipGroup label="IPO stage" options={IPO_STAGES} value={stage} onChange={setStage} />} />
      <div className="lq-card p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="m-0 text-[14px] text-lq-text">The IPO calendar feed isn't connected yet.</p>
          <p className="m-0 mt-1 text-[12px] text-lq-muted">
            When it is, this shows {stage.toLowerCase()} issues for US, NSE mainboard and SME with price band, size, lot and
            subscription. Nothing is shown until real data is available.
          </p>
        </div>
        <span className="lq-tag self-start sm:self-center">Coming soon</span>
      </div>
    </section>
  );
}

/** Home: the Event Horizon dashboard. */
export default function DashboardTab({ tickers, portfolio, onSelectTicker, onOpenTab }: DashboardTabProps) {
  const { user } = useAuth();
  const { now, live, next, total } = useMarketSummary();
  const name = nameFrom(user?.email);
  const symbols = tickers.length ? tickers.map((t) => t.id) : ["NVDA", "AAPL", "RELIANCE", "TCS"];

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
      <div className="lq-rise flex flex-col gap-2" style={{ "--lq-i": 0 } as React.CSSProperties}>
        <h1 className="lq-h1 lq-h1--grad">
          {greeting(now)}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="m-0 text-[14px] text-lq-text-2">
          <span className="lq-num">{live.length}</span> of {total} exchanges are live
          {next[0] && (
            <>
              {" "}
              · next open: <span className="text-lq-text">{next[0].code}</span> in <span className="lq-num">{formatWait(next[0].opensIn)}</span>
            </>
          )}
          <span className="text-lq-muted"> · Paper trading with virtual money</span>
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <IndicesPanel onOpenCharts={() => onOpenTab("charts")} />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1 content-start">
          <SentimentPanel />
          <MacroPanel />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <MostActivePanel onSelect={onSelectTicker} onOpenScreener={() => onOpenTab("screener")} />
          <CryptoPanel />
          <StoriesPanel />
          <IdeasPanel symbols={symbols} />
          <IpoPanel />
        </div>
        <aside aria-label="Your workspace" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1 xl:sticky xl:top-24">
          <PaperAccount portfolio={portfolio} tickers={tickers} onOpen={() => onOpenTab("portfolio")} />
          <Watchlist tickers={tickers} onSelect={onSelectTicker} />
          <SignalsPanel tickers={tickers} onSelect={onSelectTicker} />
        </aside>
      </div>

      <div className="lq-rise" style={{ "--lq-i": 8 } as React.CSSProperties}>
        <MiniCorrelationWeb onOpen={() => onOpenTab("signals")} />
      </div>
    </div>
  );
}
