import React, { useState, useEffect } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "./components/Header";
import DashboardTab from "./components/DashboardTab";
import ScreenerTab from "./components/ScreenerTab";
import ChartPage from "./components/chart/ChartPage";
import PortfolioTab from "./components/PortfolioTab";
import CorrelationWebTab from "./components/CorrelationWebTab";
import MarketsPage from "./components/MarketsPage";
import { chartPath, lastChart, rememberChart, MARKET_ITEMS } from "./components/nav/navConfig";
import { Ticker, ActiveTab } from "./types";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import MarketStrip from "./components/MarketStrip";
import SiteFooter from "./components/SiteFooter";
import Cosmos from "./theme/Cosmos";
import WormholeTransition from "./app/WormholeTransition";
import { useReducedMotion } from "./landing/hooks";


const TABS: ActiveTab[] = ["dashboard", "screener", "charts", "markets", "portfolio", "signals"];

export default function App() {
  // The view lives in the URL so every page is linkable:
  //   /app/dashboard, /app/screener, /app/portfolio, /app/signals
  //   /app/chart/:symbol      dedicated chart page for one stock or instrument
  //   /app/markets/:category  stocks | crypto | forex | futures | indices | bonds
  //   /app/charts             legacy alias, redirects to the last chart viewed
  const { tab, param } = useParams();
  const navigate = useNavigate();
  const routeTab = tab === "chart" ? "charts" : tab;
  const activeTab: ActiveTab = TABS.includes(routeTab as ActiveTab) ? (routeTab as ActiveTab) : "dashboard";
  const chartSymbol = tab === "chart" && param ? decodeURIComponent(param).toUpperCase() : null;
  const marketCategory = MARKET_ITEMS.some((m) => m.category === param) ? param! : "stocks";
  const setActiveTab = (next: ActiveTab) =>
    navigate(next === "charts" ? chartPath(lastChart()) : next === "markets" ? "/app/markets/stocks" : `/app/${next}`);
  const location = useLocation();
  const reduced = useReducedMotion();

  // The wormhole jump plays every time someone enters from the landing gate
  // (or with ?warp on any /app URL).
  const [fromGate] = useState(() => (location.state as { via?: string } | null)?.via === "wormhole");
  const [warping, setWarping] = useState(() => fromGate || new URLSearchParams(location.search).has("warp"));
  const [arrived, setArrived] = useState(!warping);
  // Arriving from the landing page keeps its scroll position, so start each view at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab, param]);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const activeTickerId = chartSymbol ?? lastChart();
  useEffect(() => {
    if (chartSymbol) rememberChart(chartSymbol);
  }, [chartSymbol]);
  
  // Real Portfolio State persisted offline first
  const [portfolio, setPortfolio] = useState<{
    cash: number;
    positions: { [tickerId: string]: { qty: number; avgCost: number } };
  }>(() => {
    const saved = localStorage.getItem("lumina_quant_portfolio");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      cash: 100000,
      positions: {
        "NVDA": { qty: 25, avgCost: 750.00 },
        "AAPL": { qty: 40, avgCost: 175.50 },
        "RELIANCE": { qty: 15, avgCost: 2420.00 }
      }
    };
  });

  // Offline persistence of portfolio state
  useEffect(() => {
    localStorage.setItem("lumina_quant_portfolio", JSON.stringify(portfolio));
  }, [portfolio]);

  // System Notification log list state
  const [systemAlerts, setSystemAlerts] = useState<Array<{ id: number; text: string; type: "success" | "info" | "warn"; stamp: string }>>([
    {
      id: 1,
      text: "Paper trading account ready. Orders fill against delayed market prices using virtual cash only.",
      type: "info",
      stamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  // Active notification toaster alert (shown at the top of the interface)
  const [toastAlert, setToastAlert] = useState<{ id: number; text: string; type: "success" | "info" | "warn" } | null>(null);

  // Drawer modal display for system notifications log list
  const [logsDrawerOpen, setLogsDrawerOpen] = useState<boolean>(false);

  // Fetch stocks database from Express Server API
  useEffect(() => {
    async function fetchStocks() {
      try {
        const res = await fetch("/api/stocks");
        const data = await res.json();
        if (data && Array.isArray(data.tickers)) {
          setTickers(data.tickers);
        } else if (Array.isArray(data)) {
          setTickers(data);
        } else {
          setTickers([]);
        }
      } catch (err) {
        console.error("Failed to load initial constituent tickers:", err);
      }
    }
    fetchStocks();
  }, []);

  // System utility to trigger notification alerts
  const triggerNotificationAlert = (text: string, type: "success" | "info" | "warn" = "info") => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newAlert = { id: Date.now(), text, type, stamp: timeStr };

    setSystemAlerts((prev) => [newAlert, ...prev]);
    setToastAlert(newAlert);

    // Fade toast alert out automatically after 4 seconds
    setTimeout(() => {
      setToastAlert((prev) => (prev?.id === newAlert.id ? null : prev));
    }, 4000);
  };

  // Switch ticker focus
  // Screener stocks outside the dashboard universe arrive with their own ticker data.
  const handleSelectTicker = (tickerId: string, extra?: Ticker) => {
    if (extra) {
      setTickers((prev) => (prev.some((t) => t.id === extra.id) ? prev : [...prev, extra]));
    }
    navigate(chartPath(tickerId.toUpperCase()));
  };

  // Portfolio reset callback
  const handleClearPortfolioData = () => {
    setPortfolio({
      cash: 100000,
      positions: {}
    });
    triggerNotificationAlert("Paper portfolio reset to $100,000.00 virtual cash.", "warn");
  };

  // Handles executing trades and logs confirmations back onto portfolio & alerts
  const handleExecutionTransaction = (ticker: string, side: "buy" | "sell", orderType: string, qty: number, price: number) => {
    const assetId = ticker.toUpperCase();
    const totalCostValue = parseFloat((qty * price).toFixed(2));

    if (side === "buy") {
      if (portfolio.cash < totalCostValue) {
        triggerNotificationAlert(`Order rejected: not enough virtual cash for buy order. (Cost: $${totalCostValue} vs Available: $${portfolio.cash.toFixed(2)})`, "warn");
        return;
      }

      // Execute buy Order
      setPortfolio((prev) => {
        const currentPos = prev.positions[assetId] || { qty: 0, avgCost: 0 };
        const newQty = currentPos.qty + qty;
        
        // Calculate weighted average cost basis
        const currentTotalCost = currentPos.qty * currentPos.avgCost;
        const incomingCost = qty * price;
        const newAvgCost = newQty > 0 ? parseFloat(((currentTotalCost + incomingCost) / newQty).toFixed(2)) : price;

        return {
          cash: parseFloat((prev.cash - totalCostValue).toFixed(2)),
          positions: {
            ...prev.positions,
            [assetId]: {
              qty: newQty,
              avgCost: newAvgCost
            }
          }
        };
      });

      triggerNotificationAlert(`Paper order filled: bought ${qty} shares of ${assetId} at $${price.toFixed(2)}. Net cost: $${totalCostValue.toLocaleString()}.`, "success");
    } else {
      // Execute sell order
      const holding = portfolio.positions[assetId];
      if (!holding || holding.qty < qty) {
        triggerNotificationAlert(`Order rejected: not enough ${assetId} in the paper portfolio to sell.`, "warn");
        return;
      }

      setPortfolio((prev) => {
        const currentPos = prev.positions[assetId];
        const newQty = currentPos.qty - qty;
        const newPositions = { ...prev.positions };
        
        if (newQty <= 0) {
          delete newPositions[assetId];
        } else {
          newPositions[assetId] = {
            qty: newQty,
            avgCost: currentPos.avgCost
          };
        }

        return {
          cash: parseFloat((prev.cash + totalCostValue).toFixed(2)),
          positions: newPositions
        };
      });

      triggerNotificationAlert(`Paper order filled: sold ${qty} shares of ${assetId} at $${price.toFixed(2)}. Net proceeds: $${totalCostValue.toLocaleString()}.`, "success");
    }
  };

  return (
    <div className={`relative min-h-screen bg-lq-bg text-lq-text font-sans flex flex-col ${arrived ? "" : "lq-hold"}`}>
      <Cosmos />

      {warping && (
        <WormholeTransition
          reduced={reduced}
          fromGate={fromGate}
          onArrive={() => setArrived(true)}
          onDone={() => {
            setWarping(false);
            // Drop the router state so a refresh doesn't replay the jump.
            navigate(location.pathname, { replace: true, state: null });
          }}
        />
      )}

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNotificationsClick={() => setLogsDrawerOpen(true)}
      />
      <MarketStrip />

      {/* Paper-trade confirmations */}
      {toastAlert && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4" role="status" aria-live="polite">
          <div className="lq-panel p-4 flex gap-3.5 items-start">
            {toastAlert.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-lq-gold flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-lq-gold-soft flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <span className="lq-lbl block">Paper trading · simulated</span>
              <p className="text-[13px] text-lq-text-2 mt-1 mb-0 leading-relaxed">{toastAlert.text}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToastAlert(null)}
              className="text-lq-muted hover:text-lq-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="relative z-10 flex-1 w-full flex flex-col">
        {activeTab === "dashboard" && (
          <DashboardTab
            tickers={tickers}
            portfolio={portfolio}
            onSelectTicker={handleSelectTicker}
            onOpenTab={setActiveTab}
          />
        )}

        {activeTab === "screener" && (
          <ScreenerTab
            tickers={tickers}
            onSelectTicker={handleSelectTicker}
            onAlertMessage={(msg) => triggerNotificationAlert(msg, "info")}
          />
        )}

        {/* /app/charts (no symbol) is the old URL: send it to the last chart viewed. */}
        {activeTab === "charts" && !chartSymbol && <Navigate to={chartPath(activeTickerId)} replace />}

        {activeTab === "charts" && chartSymbol && (
          <ChartPage
            key={chartSymbol}
            symbol={chartSymbol}
            tickers={tickers}
            onAlertMessage={(msg) => triggerNotificationAlert(msg, "info")}
            onTradeExecuted={handleExecutionTransaction}
          />
        )}

        {activeTab === "markets" && <MarketsPage category={marketCategory} onOpenChart={(id) => navigate(chartPath(id))} />}

        {activeTab === "portfolio" && (
          <PortfolioTab
            tickers={tickers}
            portfolio={portfolio}
            onSelectTicker={handleSelectTicker}
            onClearPortfolio={handleClearPortfolioData}
            onAlertMessage={(msg) => triggerNotificationAlert(msg, "info")}
          />
        )}

        {activeTab === "signals" && (
          <CorrelationWebTab
            tickers={tickers}
            onSelectTicker={handleSelectTicker}
            onAlertMessage={(msg) => triggerNotificationAlert(msg, "info")}
          />
        )}
      </main>

      <SiteFooter onOpenTab={setActiveTab} />

      {/* Activity log drawer */}
      {logsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setLogsDrawerOpen(false)} />
          <aside
            aria-labelledby="lq-log-title"
            className="relative w-full max-w-sm bg-lq-bg-2 border-l border-lq-line flex flex-col h-full shadow-2xl z-20"
          >
            <div className="flex justify-between items-center p-5 border-b border-lq-line">
              <div className="flex items-center gap-2.5">
                <span className="lq-marker" aria-hidden="true" />
                <h2 id="lq-log-title" className="lq-h3">
                  Activity log
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close activity log"
                onClick={() => setLogsDrawerOpen(false)}
                className="text-lq-muted hover:text-lq-text transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ul className="p-5 flex flex-col gap-3 flex-1 overflow-y-auto m-0 list-none">
              {systemAlerts.map((alert) => (
                <li key={alert.id} className="lq-card p-3.5 flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      alert.type === "warn" ? "bg-lq-gold-soft" : "bg-lq-gold"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="lq-num text-[11px] text-lq-muted">{alert.stamp}</span>
                      <span className="lq-lbl text-[10px]">
                        {alert.type === "warn" ? "Notice" : alert.type === "success" ? "Filled" : "Info"}
                      </span>
                    </div>
                    <p className="text-[13px] text-lq-text-2 mt-1 mb-0 leading-relaxed">{alert.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="p-5 border-t border-lq-line text-[12px] text-lq-muted m-0">
              Every order here is a simulation with virtual money. Nothing is sent to a broker or exchange.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
