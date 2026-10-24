import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "./components/Header";
import DashboardTab from "./components/DashboardTab";
import ScreenerTab from "./components/ScreenerTab";
import ChartsTab from "./components/ChartsTab";
import PortfolioTab from "./components/PortfolioTab";
import CorrelationWebTab from "./components/CorrelationWebTab";
import { Ticker, ActiveTab } from "./types";
import { AlertCircle, Terminal, CheckCircle2, ChevronRight, X } from "lucide-react";

const TABS: ActiveTab[] = ["dashboard", "screener", "charts", "portfolio", "signals"];

export default function App() {
  // The active tab lives in the URL (/app/screener, /app/charts, …) so views are linkable.
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab: ActiveTab = TABS.includes(tab as ActiveTab) ? (tab as ActiveTab) : "dashboard";
  const setActiveTab = (next: ActiveTab) => navigate(`/app/${next}`);
  // Arriving from the landing page keeps its scroll position, so start each view at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [activeTickerId, setActiveTickerId] = useState<string>("NVDA");
  
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
    { id: 1, text: "Lumina Quant clearing brokerage system online. Market APIs responsive.", type: "success", stamp: "10:30 AM" },
    { id: 2, text: "Gemini-2.5-flash strategic analysis models calibrated successfully.", type: "info", stamp: "10:32 AM" },
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
  const handleSelectTicker = (tickerId: string) => {
    setActiveTickerId(tickerId.toUpperCase());
    setActiveTab("charts");
  };

  // Portfolio reset callback
  const handleClearPortfolioData = () => {
    setPortfolio({
      cash: 100000,
      positions: {}
    });
    triggerNotificationAlert("Portfolio reset to $100,000.00 cash.", "warn");
  };

  // Handles executing trades and logs confirmations back onto portfolio & alerts
  const handleExecutionTransaction = (ticker: string, side: "buy" | "sell", orderType: string, qty: number, price: number) => {
    const assetId = ticker.toUpperCase();
    const totalCostValue = parseFloat((qty * price).toFixed(2));

    if (side === "buy") {
      if (portfolio.cash < totalCostValue) {
        triggerNotificationAlert(`Execution Rejected: Insufficient cash balance for buy order. (Cost: $${totalCostValue} vs Available: $${portfolio.cash.toFixed(2)})`, "warn");
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

      triggerNotificationAlert(`Order Executed: Bought ${qty} shares of ${assetId} at $${price.toFixed(2)} limit. Net cost: $${totalCostValue.toLocaleString()}.`, "success");
    } else {
      // Execute sell order
      const holding = portfolio.positions[assetId];
      if (!holding || holding.qty < qty) {
        triggerNotificationAlert(`Execution Rejected: Insufficient holdings of ${assetId} to fill short or sell order.`, "warn");
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

      triggerNotificationAlert(`Order Executed: Sold ${qty} shares of ${assetId} at $${price.toFixed(2)} limits. Net proceeds: $${totalCostValue.toLocaleString()}.`, "success");
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] text-[#e5e2e1] font-sans flex flex-col selection:bg-amber-500/30 selection:text-amber-400">
      
      {/* HEADER NAVBAR */}
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onNotificationsClick={() => setLogsDrawerOpen(true)}
      />

      {/* FLOAT TOAST SYSTEM NOTIFIER */}
      {toastAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-auto transition-transform duration-300">
          <div className="bg-[#131111]/95 border border-white/10 rounded-xl p-4 flex gap-3.5 items-start shadow-[0_10px_25px_rgba(0,0,0,0.8)] backdrop-blur-md">
            {toastAlert.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            )}
            
            <div className="flex-1 min-w-0">
              <span className="font-mono text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Transactional log</span>
              <p className="text-xs text-gray-200 mt-1 select-text leading-relaxed">{toastAlert.text}</p>
            </div>

            <button 
              onClick={() => setToastAlert(null)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* RENDER ACTIVE TAB */}
      <main className="flex-1 w-full flex flex-col">
        {activeTab === "dashboard" && (
          <DashboardTab
            tickers={tickers}
            onSelectTicker={handleSelectTicker}
            onOpenWeb={() => setActiveTab("signals")}
          />
        )}

        {activeTab === "screener" && (
          <ScreenerTab 
            tickers={tickers} 
            onSelectTicker={handleSelectTicker} 
            onAlertMessage={(msg) => triggerNotificationAlert(msg, "info")}
          />
        )}

        {activeTab === "charts" && (
          <ChartsTab 
            tickers={tickers} 
            activeTickerId={activeTickerId} 
            onSelectTicker={(tk) => setActiveTickerId(tk)}
            onAlertMessage={(msg) => triggerNotificationAlert(msg, "info")}
            onTradeExectued={handleExecutionTransaction}
          />
        )}

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

      {/* NOTIFICATIONS LOGS SYSTEM SIDE DRAWER */}
      {logsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm select-none">
          {/* Overlay dismissal */}
          <div className="absolute inset-0" onClick={() => setLogsDrawerOpen(false)} />

          <aside className="relative w-full max-w-sm bg-[#111] border-l border-white/10 flex flex-col justify-between h-full shadow-2xl z-20">
            <div>
              {/* Drawer Header */}
              <div className="flex justify-between items-center p-5 border-b border-white/10 bg-[#0c0c0c]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-amber-500 animate-pulse" />
                  <h3 className="font-sans font-black text-white text-base uppercase tracking-tight m-0">Clearing System Logs</h3>
                </div>
                <button 
                  onClick={() => setLogsDrawerOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer list */}
              <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
                {systemAlerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex items-start gap-3 hover:border-white/10 transition-colors"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {alert.type === "success" ? (
                        <span className="w-2 h-2 rounded-full inline-block bg-blue-500" />
                      ) : alert.type === "warn" ? (
                        <span className="w-2 h-2 rounded-full inline-block bg-red-500 animate-ping" />
                      ) : (
                        <span className="w-2 h-2 rounded-full inline-block bg-amber-500" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center select-none">
                        <span className="font-mono text-[9px] text-gray-500 font-bold uppercase tracking-wider">Stamp: {alert.stamp}</span>
                        <span className={`font-mono text-[8px] uppercase px-1.5 py-0.2 rounded font-bold ${
                          alert.type === "success" ? "text-blue-400 bg-blue-500/10" : alert.type === "warn" ? "text-red-400 bg-red-400/10" : "text-amber-400 bg-amber-400/10"
                        }`}>{alert.type}</span>
                      </div>
                      <p className="text-xs text-gray-300 mt-1 select-text leading-relaxed font-sans">{alert.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom info signature */}
            <div className="p-5 border-t border-white/10 bg-[#0c0c0c] select-none text-center">
              <span className="font-mono text-[9px] text-gray-600 block">LUMINA CLEARING HOUSES CORE INC</span>
            </div>
          </aside>
        </div>
      )}

    </div>
  );
}
