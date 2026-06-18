import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Home, BarChart3, Briefcase, Bot, LogOut, TrendingUp, Menu, X } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/screener', icon: BarChart3, label: 'Screener' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
];

export default function Navbar() {
  const { user, signOut } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastY, setLastY] = useState(0);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location]);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setHidden(currentY > lastY && currentY > 80);
      setLastY(currentY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastY]);

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}
        style={{ background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2 shrink-0">
              <TrendingUp className="w-6 h-6 text-accent-orange" />
              <span className="text-xl font-extrabold tracking-tight">
                <span className="text-gradient-orange">Q</span>uantVerse
              </span>
            </NavLink>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to}
                  className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? 'text-accent-orange bg-accent-orange/10' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="hidden md:flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-orange flex items-center justify-center text-xs font-bold text-white">
                    {user.email?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <button onClick={signOut} className="flex items-center gap-1.5 text-white/40 hover:text-loss transition text-sm">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <NavLink to="/auth" className="hidden md:block px-4 py-1.5 rounded-xl border border-white/15 text-white/70 text-sm font-medium hover:bg-white/5 hover:text-white transition">
                  Sign In
                </NavLink>
              )}

              {/* Mobile toggle */}
              <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-white/60 hover:text-white transition">
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/5 bg-dark-900/95 backdrop-blur-xl">
            <div className="px-4 py-3 space-y-1">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${isActive ? 'text-accent-orange bg-accent-orange/10' : 'text-white/50 hover:bg-white/5'}`}>
                  <Icon className="w-5 h-5" />{label}
                </NavLink>
              ))}
              {user ? (
                <button onClick={() => { signOut(); setMobileOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/40 hover:text-loss transition w-full">
                  <LogOut className="w-5 h-5" />Sign Out
                </button>
              ) : (
                <NavLink to="/auth" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-accent-amber hover:bg-white/5 transition">
                  Sign In
                </NavLink>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
