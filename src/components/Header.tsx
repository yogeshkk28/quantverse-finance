import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ActiveTab } from "../types";
import { Bell, User, Cpu, LogOut, TrendingUp, Filter, LineChart, PieChart, Activity } from "lucide-react";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onNotificationsClick?: () => void;
}

export default function Header({ activeTab, setActiveTab, onNotificationsClick }: HeaderProps) {
  const { user, leave } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "screener", label: "Screener", icon: <Filter className="w-3.5 h-3.5" /> },
    { id: "charts", label: "Charts", icon: <LineChart className="w-3.5 h-3.5" /> },
    { id: "portfolio", label: "Portfolio", icon: <PieChart className="w-3.5 h-3.5" /> },
    { id: "signals", label: "Correlation Web", icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="bg-[#050505] border-b border-white/10 sticky top-0 z-50 transition-all duration-300">
      <div className="flex h-20 items-center justify-between px-8 w-full max-w-[1600px] mx-auto gap-4">
        {/* Brand Logo & Name under Sophisticated Dark template style */}
        <div 
          onClick={() => setActiveTab("dashboard")} 
          className="flex items-center gap-4 cursor-pointer select-none group"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#F5E6CA] flex items-center justify-center border border-white/20 transition-all duration-500 group-hover:rotate-12 group-hover:scale-105">
            <Cpu className="w-4 h-4 text-black" />
          </div>
          <span className="text-xl font-bold tracking-[0.25em] uppercase italic font-serif text-[#F2F2F2] transition-colors duration-300 group-hover:text-[#D4AF37]">
            Lumina Quant
          </span>
        </div>

        {/* Desktop Navigation - matching editorial spacing */}
        <nav className="hidden md:flex items-center gap-6">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2 border-b transition-all duration-300 text-[11px] uppercase tracking-[0.2em] font-medium ${
                  isActive
                    ? "text-[#F2F2F2] border-[#D4AF37] opacity-100"
                    : "text-white/50 border-transparent hover:text-white hover:opacity-80"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Indicators and Alerts */}
        <div className="flex items-center gap-4">
          {/* Notifications button with clean neon green status pulse */}
          <button
            onClick={onNotificationsClick}
            className="text-white/60 hover:text-[#D4AF37] hover:bg-white/5 p-2 rounded-full transition-all duration-300 relative"
            title="System Alerts"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
          </button>

          {/* Account menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account"
              className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center hover:border-[#D4AF37]/60 transition-colors"
              title={user?.email}
            >
              <div className="w-5.5 h-5.5 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#F5E6CA]"></div>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-60 bg-[#0b0b0b] border border-white/10 rounded-xl p-2 shadow-[0_10px_25px_rgba(0,0,0,0.8)]">
                <p className="px-3 py-2 text-[11px] text-white/45 truncate">{user?.email}</p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    await leave();
                    navigate("/");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/80 hover:bg-white/5 hover:text-[#D4AF37]"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
