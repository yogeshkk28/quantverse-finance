import React from "react";
import { ActiveTab, Ticker } from "../types";
import { useAuth } from "../context/AuthContext";
import { useMarketSummary } from "./MarketStatusPill";
import { formatWait } from "../landing/marketHours";
import IndicesPanel from "./dashboard/IndicesPanel";
import { SentimentPanel, MacroPanel } from "./dashboard/SentimentPanel";
import MostActivePanel from "./dashboard/MostActivePanel";
import IdeasPanel from "./dashboard/IdeasPanel";
import { PaperAccount, Watchlist, SignalsPanel } from "./dashboard/Rail";
import IndexDeck from "./home/IndexDeck";
import FuturesPanel from "./home/FuturesPanel";
import ForexPanel from "./home/ForexPanel";
import CryptoGrid from "./home/CryptoGrid";
import NewsPanel, { useNews } from "./home/NewsPanel";
import IpoPanel from "./home/IpoPanel";
import Dossier from "./home/Dossier";

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

/**
 * Home: the Event Horizon dashboard.
 *
 * Top to bottom: benchmark index cards, the index chart and commodity futures
 * beside the instrument dossier, market movers, forex and crypto, news and IPOs,
 * then sentiment and the paper workspace. Clicking any index, future, pair or
 * coin puts it in the dossier.
 */
export default function DashboardTab({ tickers, portfolio, onSelectTicker, onOpenTab }: DashboardTabProps) {
  const { user } = useAuth();
  const { now, live, next, total } = useMarketSummary();
  const name = nameFrom(user?.email);
  const symbols = tickers.length ? tickers.map((t) => t.id) : ["NVDA", "AAPL", "RELIANCE", "TCS"];
  const news = useNews();

  const [chartSymbol, setChartSymbol] = React.useState("^GSPC");
  const [focus, setFocus] = React.useState("^GSPC");
  const dossierRef = React.useRef<HTMLDivElement>(null);
  const held = React.useMemo(
    () => new Set(Object.entries(portfolio.positions).filter(([, p]) => p.qty > 0).map(([id]) => id)),
    [portfolio.positions]
  );

  const focusOn = (symbol: string) => {
    setFocus(symbol);
    // Below the wide layout the dossier sits under the chart; bring it into view.
    const el = dossierRef.current;
    if (el && window.innerWidth < 1280) {
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight || r.bottom < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const pickIndex = (symbol: string) => {
    setChartSymbol(symbol);
    focusOn(symbol);
  };

  return (
    <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-10 py-10 flex flex-col gap-10">
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

      <IndexDeck selected={chartSymbol} onSelect={pickIndex} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex flex-col gap-8 min-w-0">
          <IndicesPanel symbol={chartSymbol} onSymbol={pickIndex} />
          <FuturesPanel held={held} focus={focus} onFocus={focusOn} />
        </div>
        <div ref={dossierRef} className="relative min-w-0 scroll-mt-24 xl:min-h-[720px]">
          <div className="xl:absolute xl:inset-0 flex flex-col">
            <Dossier symbol={focus} news={news?.items ?? []} />
          </div>
        </div>
      </div>

      <MostActivePanel onSelect={onSelectTicker} onOpenScreener={() => onOpenTab("screener")} />

      <div className="grid gap-8 lg:grid-cols-2 items-start">
        <ForexPanel focus={focus} onFocus={focusOn} />
        <CryptoGrid focus={focus} onFocus={focusOn} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start">
        <NewsPanel data={news} />
        <IpoPanel />
      </div>

      <section aria-label="Sentiment and your workspace" className="grid gap-8 md:grid-cols-2 2xl:grid-cols-4 items-start">
        <SentimentPanel />
        <MacroPanel />
        <PaperAccount portfolio={portfolio} tickers={tickers} onOpen={() => onOpenTab("portfolio")} />
        <Watchlist tickers={tickers} onSelect={onSelectTicker} />
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] items-start">
        <IdeasPanel symbols={symbols} />
        <SignalsPanel tickers={tickers} onSelect={onSelectTicker} />
      </div>
    </div>
  );
}
