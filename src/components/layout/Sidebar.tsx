import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Home, BarChart3, Briefcase, Bot, LogOut, TrendingUp, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/screener', icon: BarChart3, label: 'Screener' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden fixed top-4 left-4 z-50 p-2 glass-card">
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setMobileOpen(false)} />
        )}
      </AnimatePresence>

      <aside className={`fixed lg:static top-0 left-0 h-screen z-40 w-64 bg-space-800/80 backdrop-blur-xl border-r border-white/5 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-neon-purple" />
            <span className="text-xl font-heading font-bold neon-text-purple">QuantVerse</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-neon-purple/20 text-neon-purple neon-text-purple border border-neon-purple/30' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <Icon className="w-5 h-5" />
              <span className="font-medium text-sm">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center text-xs font-bold">
                  {user.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <p className="text-sm text-white/80 truncate flex-1">{user.email}</p>
              </div>
              <button onClick={signOut} className="flex items-center gap-3 px-4 py-2 rounded-lg text-white/40 hover:text-loss hover:bg-loss/10 transition w-full">
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sign Out</span>
              </button>
            </div>
          ) : (
            <NavLink to="/auth" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-neon-cyan hover:bg-neon-cyan/10 transition">
              <span className="text-sm font-medium">Sign In</span>
            </NavLink>
          )}
        </div>
      </aside>
    </>
  );
}
