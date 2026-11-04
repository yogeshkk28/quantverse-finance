import React from "react";
import { Link } from "react-router-dom";
import { ActiveTab } from "../types";

const TOOLS: Array<{ id: ActiveTab; label: string }> = [
  { id: "dashboard", label: "Home" },
  { id: "screener", label: "Screener" },
  { id: "charts", label: "Charts" },
  { id: "portfolio", label: "Paper portfolio" },
  { id: "signals", label: "Correlation Web" },
];

/** Shared footer: tools, policies and the paper-trading and data disclosure. */
export default function SiteFooter({ onOpenTab }: { onOpenTab: (tab: ActiveTab) => void }) {
  return (
    <footer className="relative z-10 mt-16 border-t border-lq-line bg-[rgba(11,12,18,0.85)]">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-10 grid gap-8 grid-cols-2 md:grid-cols-[2fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1 flex flex-col gap-3 max-w-xl">
          <span className="font-serif text-2xl text-lq-gold">Lumina Quant</span>
          <p className="text-[13px] text-lq-text-2 m-0 leading-relaxed">
            A paper trading simulator for learning traders. Every order uses virtual money and is never sent to a
            broker or exchange. Nothing here is investment advice.
          </p>
          <p className="text-[12px] text-lq-muted m-0 leading-relaxed">
            Prices come from public market data feeds and are usually delayed by 15 minutes or more. Values marked as
            sample or unavailable are not live.
          </p>
        </div>
        <nav aria-label="Tools" className="flex flex-col gap-2">
          <span className="lq-lbl mb-1">Tools</span>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenTab(t.id)}
              className="text-left text-[13px] text-lq-text-2 hover:text-lq-gold transition-colors"
            >
              {t.label}
            </button>
          ))}
        </nav>
        <nav aria-label="Company" className="flex flex-col gap-2">
          <span className="lq-lbl mb-1">Company</span>
          <Link to="/" className="text-[13px] text-lq-text-2 hover:text-lq-gold">
            About
          </Link>
          <Link to="/privacy" className="text-[13px] text-lq-text-2 hover:text-lq-gold">
            Privacy policy
          </Link>
        </nav>
      </div>
      <div className="border-t border-lq-line-soft">
        <p className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 m-0 lq-num text-[11px] text-lq-muted">
          © {new Date().getFullYear()} Lumina Quant · Simulated trading only
        </p>
      </div>
    </footer>
  );
}
