import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ActiveTab } from "../types";
import { Bell, Menu, Search, X } from "lucide-react";
import MarketStatusPill from "./MarketStatusPill";
import NavDropdown from "./nav/NavDropdown";
import SearchBar from "./nav/SearchBar";
import ProfileMenu from "./nav/ProfileMenu";
import { LAB_ITEMS, LAB_LABEL, MARKET_ITEMS, PORTFOLIO_ITEM, NavItem, chartPath, lastChart } from "./nav/navConfig";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onNotificationsClick?: () => void;
}

/**
 * Top bar: brand, Markets and Quant Lab menus, Portfolio, the universal search,
 * then status, activity log and the profile slot on the right.
 */
export default function Header({ activeTab, setActiveTab, onNotificationsClick }: HeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Close the mobile panels whenever the page changes.
  useEffect(() => {
    setNavOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const marketCategory = pathname.startsWith("/app/markets/") ? pathname.split("/")[3] : null;

  const pick = (item: NavItem) => {
    if (item.to === "chart") navigate(chartPath(lastChart()));
    else navigate(item.to);
    setNavOpen(false);
  };

  const isLabItem = (item: NavItem) => item.match === activeTab;
  const isMarketItem = (item: NavItem) => item.to === `/app/markets/${marketCategory}`;

  const labActive = LAB_ITEMS.some(isLabItem);
  const marketsActive = activeTab === "markets";
  const portfolioActive = activeTab === "portfolio";

  return (
    <header className="sticky top-0 z-50 border-b border-lq-line bg-[rgba(7,8,12,0.86)] backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 lg:gap-6 px-4 md:px-8 w-full max-w-[1600px] mx-auto">
        <button
          type="button"
          onClick={() => setActiveTab("dashboard")}
          aria-label="Lumina Quant home"
          className="font-serif text-[22px] md:text-[26px] font-medium leading-none text-lq-gold hover:text-lq-gold-soft transition-colors whitespace-nowrap"
        >
          Lumina Quant
        </button>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-0.5">
          <NavDropdown
            label="Markets"
            items={MARKET_ITEMS}
            active={marketsActive}
            isItemActive={isMarketItem}
            onPick={pick}
            width={520}
          />
          <NavDropdown label={LAB_LABEL} items={LAB_ITEMS} active={labActive} isItemActive={isLabItem} onPick={pick} width={340} />
          <button
            type="button"
            onClick={() => pick(PORTFOLIO_ITEM)}
            aria-current={portfolioActive ? "page" : undefined}
            className={`relative px-3 py-2 text-[14px] transition-colors ${
              portfolioActive ? "text-lq-text" : "text-lq-muted hover:text-lq-text"
            }`}
          >
            Portfolio
            {portfolioActive && (
              <span className="absolute left-3 right-3 -bottom-[13px] h-[2px] rounded-full bg-lq-gold shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
            )}
          </button>
        </nav>

        <div className="hidden md:block flex-1 min-w-[200px] max-w-[560px] mx-auto">
          <SearchBar />
        </div>

        <div className="ml-auto md:ml-0 flex items-center gap-1.5 md:gap-3">
          <button
            type="button"
            className="md:hidden w-10 h-10 inline-flex items-center justify-center rounded-full text-lq-text-2 hover:bg-lq-surface-2"
            aria-label={searchOpen ? "Close search" : "Search"}
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen((o) => !o);
              setNavOpen(false);
            }}
          >
            {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>

          <span className="hidden 2xl:inline lq-tag" title="Every trade here is simulated with virtual money">
            Paper trading
          </span>
          <span className="hidden sm:inline-flex">
            <MarketStatusPill />
          </span>

          <button
            type="button"
            onClick={onNotificationsClick}
            aria-label="Activity log"
            className="relative w-10 h-10 hidden sm:inline-flex items-center justify-center rounded-full text-lq-muted hover:text-lq-gold hover:bg-lq-surface-2 transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Profile slot */}
          <ProfileMenu onNotificationsClick={onNotificationsClick} />

          <button
            type="button"
            className="lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-full text-lq-text-2 hover:bg-lq-surface-2"
            aria-label={navOpen ? "Close menu" : "Open menu"}
            aria-expanded={navOpen}
            aria-controls="lq-mobile-nav"
            onClick={() => {
              setNavOpen((o) => !o);
              setSearchOpen(false);
            }}
          >
            {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="md:hidden border-t border-lq-line px-4 py-3">
          <SearchBar autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      )}

      {navOpen && (
        <nav
          id="lq-mobile-nav"
          aria-label="Primary"
          className="lg:hidden border-t border-lq-line px-4 py-4 grid gap-5 sm:grid-cols-2 max-h-[calc(100vh-4rem)] overflow-y-auto"
        >
          <MobileGroup title="Markets" items={MARKET_ITEMS} isActive={isMarketItem} onPick={pick} />
          <div className="flex flex-col gap-5">
            <MobileGroup title={LAB_LABEL} items={LAB_ITEMS} isActive={isLabItem} onPick={pick} />
            <MobileGroup title="Account" items={[PORTFOLIO_ITEM]} isActive={() => portfolioActive} onPick={pick} />
          </div>
        </nav>
      )}
    </header>
  );
}

function MobileGroup({
  title,
  items,
  isActive,
  onPick,
}: {
  title: string;
  items: NavItem[];
  isActive: (item: NavItem) => boolean;
  onPick: (item: NavItem) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="lq-lbl px-3 pb-1">{title}</span>
      {items.map((item) => {
        const Icon = item.icon;
        const on = isActive(item);
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onPick(item)}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-[15px] ${
              on ? "bg-lq-surface-2 text-lq-gold" : "text-lq-text-2 hover:bg-lq-surface-2"
            }`}
          >
            <Icon className="w-4 h-4 text-lq-muted" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
