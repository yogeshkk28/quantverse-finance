import React from "react";
import { ActiveTab, Ticker } from "../types";
import { useAuth } from "../context/AuthContext";
import { useMarketSummary } from "./MarketStatusPill";
import { formatWait } from "../landing/marketHours";
import { Moon, Sun } from "lucide-react";
import { SentimentPanel, MacroPanel } from "./dashboard/SentimentPanel";
import IndicesPanel from "./dashboard/IndicesPanel";
import { PaperAccount, Watchlist } from "./dashboard/Rail";
import { IndicesList, FuturesList, ForexList, CryptoList, MoversList } from "./home/HomeLists";
import NewsPanel, { useNews } from "./home/NewsPanel";
import IpoPanel from "./home/IpoPanel";
import Dossier from "./home/Dossier";
import { useTheme, setTheme } from "../theme/theme";

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
 * Home: compact quote lists in three columns (indices, futures, forex, movers,
 * crypto) with the instrument dossier on the right, then news and IPOs, then
 * sentiment and the paper workspace. Rows open the chart page; full lists live
 * behind each "See all" link.
 */
export default function DashboardTab({ tickers, portfolio, onSelectTicker, onOpenTab }: DashboardTabProps) {
  const { user } = useAuth();
  const { now, live, next, total } = useMarketSummary();
  const name = nameFrom(user?.email);
  const news = useNews();
  const theme = useTheme();
  const [focus, setFocus] = React.useState("^GSPC");
  const [chartSymbol, setChartSymbol] = React.useState("^GSPC");
  const held = React.useMemo(
    () => new Set(Object.entries(portfolio.positions).filter(([, p]) => p.qty > 0).map(([id]) => id)),
    [portfolio.positions]
  );

  return (
    <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      <div className="lq-rise flex flex-wrap items-end gap-3" style={{ "--lq-i": 0 } as React.CSSProperties}>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-serif text-[30px] leading-tight lq-h1--grad">
            {greeting(now)}
            {name ? `, ${name}` : ""}
          </h1>
          <p className="m-0 text-[13px] text-lq-text-2">
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
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="ml-auto inline-flex items-center gap-2 h-8 px-3 rounded-full border border-lq-line-2 text-[12px] text-lq-text-2 hover:text-lq-text hover:border-lq-gold-line"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="flex flex-col gap-6 min-w-0">
        <IndicesPanel
          symbol={chartSymbol}
          onSymbol={(sym) => {
            setChartSymbol(sym);
            setFocus(sym);
          }}
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start min-w-0">
          <div className="flex flex-col gap-6 min-w-0">
            <IndicesList />
            <FuturesList held={held} />
            <ForexList />
          </div>
          <div className="flex flex-col gap-6 min-w-0">
            <MoversList list="gainers" />
            <CryptoList />
          </div>
          <div className="flex flex-col gap-6 min-w-0">
            <MoversList list="losers" />
            <MoversList list="active" />
          </div>
        </div>
        </div>
        <div className="xl:sticky xl:top-24 xl:h-[calc(100vh-7.5rem)] flex flex-col min-w-0">
          <Dossier symbol={focus} onPick={setFocus} news={news?.items ?? []} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
        <NewsPanel data={news} />
        <IpoPanel />
      </div>

      <section aria-label="Sentiment and your workspace" className="grid gap-6 md:grid-cols-2 2xl:grid-cols-4 items-start">
        <SentimentPanel />
        <MacroPanel />
        <PaperAccount portfolio={portfolio} tickers={tickers} onOpen={() => onOpenTab("portfolio")} />
        <Watchlist tickers={tickers} onSelect={onSelectTicker} />
      </section>
    </div>
  );
}
