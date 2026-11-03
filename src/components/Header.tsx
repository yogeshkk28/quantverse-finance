import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ActiveTab } from "../types";
import { Bell, LogOut, Trash2, Menu, X } from "lucide-react";
import MarketStatusPill from "./MarketStatusPill";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onNotificationsClick?: () => void;
}

const TABS: Array<{ id: ActiveTab; label: string }> = [
  { id: "dashboard", label: "Home" },
  { id: "screener", label: "Screener" },
  { id: "charts", label: "Charts" },
  { id: "portfolio", label: "Portfolio" },
  { id: "signals", label: "Correlation Web" },
];

export default function Header({ activeTab, setActiveTab, onNotificationsClick }: HeaderProps) {
  const { user, leave, forget } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const go = (tab: ActiveTab) => {
    setActiveTab(tab);
    setNavOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-lq-line bg-[rgba(7,8,12,0.86)] backdrop-blur-md">
      <div className="flex h-16 items-center gap-4 md:gap-8 px-4 md:px-8 w-full max-w-[1600px] mx-auto">
        <button
          type="button"
          onClick={() => go("dashboard")}
          className="font-serif text-[26px] font-medium leading-none text-lq-gold hover:text-lq-gold-soft transition-colors whitespace-nowrap"
        >
          Lumina Quant
        </button>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1">
          {TABS.map((tab) => {
            const on = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => go(tab.id)}
                aria-current={on ? "page" : undefined}
                className={`relative px-3 py-2 text-[14px] transition-colors ${
                  on ? "text-lq-text" : "text-lq-muted hover:text-lq-text"
                }`}
              >
                {tab.label}
                {on && (
                  <span className="absolute left-3 right-3 -bottom-[13px] h-[2px] rounded-full bg-lq-gold shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <span className="hidden md:inline lq-tag" title="Every trade here is simulated with virtual money">
            Paper trading
          </span>
          <MarketStatusPill />

          <button
            type="button"
            onClick={onNotificationsClick}
            aria-label="Activity log"
            className="relative w-10 h-10 inline-flex items-center justify-center rounded-full text-lq-muted hover:text-lq-gold hover:bg-lq-surface-2 transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account"
              className="w-10 h-10 rounded-full border border-lq-line-2 flex items-center justify-center hover:border-lq-gold-line transition-colors"
              title={user?.email}
            >
              <span className="w-5 h-5 rounded-full" style={{ background: "var(--lq-gold-grad)" }} />
            </button>
            {menuOpen && (
              <div role="menu" className="lq-panel absolute right-0 mt-2 w-60 p-2">
                <p className="px-3 py-2 text-[12px] text-lq-muted truncate m-0">{user?.email}</p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    await leave();
                    navigate("/");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-lq-text-2 hover:bg-lq-surface-2 hover:text-lq-gold"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    if (!window.confirm("Delete your email and sign out everywhere? This can't be undone.")) return;
                    if (await forget()) navigate("/");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-lq-muted hover:bg-lq-surface-2 hover:text-lq-down"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete my data
                </button>
                <Link
                  to="/privacy"
                  role="menuitem"
                  className="block px-3 py-2 rounded-lg text-[12px] text-lq-muted hover:bg-lq-surface-2 hover:text-lq-text"
                >
                  Privacy policy
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            className="lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-full text-lq-text-2 hover:bg-lq-surface-2"
            aria-label={navOpen ? "Close menu" : "Open menu"}
            aria-expanded={navOpen}
            aria-controls="lq-mobile-nav"
            onClick={() => setNavOpen((o) => !o)}
          >
            {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {navOpen && (
        <nav id="lq-mobile-nav" aria-label="Primary" className="lg:hidden border-t border-lq-line px-4 py-3 flex flex-col gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => go(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`text-left px-3 py-3 rounded-lg text-[15px] ${
                activeTab === tab.id ? "bg-lq-surface-2 text-lq-gold" : "text-lq-text-2 hover:bg-lq-surface-2"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
