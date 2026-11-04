import { useCallback, useEffect, useRef, useState } from "react";
import { call } from "../context/AuthContext";

export interface Position {
  qty: number;
  avgCost: number;
}

export interface Trade {
  id: string;
  at: string;
  ticker: string;
  side: "buy" | "sell";
  orderType: string;
  qty: number;
  price: number;
}

export interface Portfolio {
  startingCash: number;
  cash: number;
  positions: Record<string, Position>;
  trades: Trade[];
  nav: Array<{ date: string; value: number }>;
  resetAt: string | null;
}

const EMPTY: Portfolio = { startingCash: 0, cash: 0, positions: {}, trades: [], nav: [], resetAt: null };

type Outcome = { ok: boolean; portfolio?: Portfolio; error?: string };

/**
 * The signed-in user's paper portfolio. The server holds it (server/auth.ts),
 * checks every order against cash and holdings, and keeps the trade history,
 * so it follows the account from one browser to another.
 */
export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastNav = useRef<string>("");

  const refresh = useCallback(async () => {
    const r = await call<{ portfolio: Portfolio }>("/api/portfolio", undefined, "GET");
    if (r.ok) {
      setPortfolio(r.portfolio);
      setError(null);
    } else setError(r.error);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const apply = async (p: Promise<any>): Promise<Outcome> => {
    const r = await p;
    if (!r.ok) return { ok: false, error: r.error };
    setPortfolio(r.portfolio);
    return { ok: true, portfolio: r.portfolio };
  };

  const trade = useCallback(
    (order: { ticker: string; side: "buy" | "sell"; orderType: string; qty: number; price: number }) =>
      apply(call("/api/portfolio/trade", order)),
    []
  );

  const reset = useCallback((startingCash?: number) => apply(call("/api/portfolio/reset", { startingCash })), []);

  /** Records today's account value for the equity curve (at most once per change). */
  const recordNav = useCallback((value: number) => {
    const key = `${new Date().toISOString().slice(0, 10)}:${value.toFixed(2)}`;
    if (!Number.isFinite(value) || value <= 0 || key === lastNav.current) return;
    lastNav.current = key;
    call<{ portfolio: Portfolio }>("/api/portfolio/nav", { value }).then((r) => {
      if (r.ok) setPortfolio((p) => ({ ...p, nav: r.portfolio.nav }));
    });
  }, []);

  return { portfolio, loaded, error, refresh, trade, reset, recordNav };
}
