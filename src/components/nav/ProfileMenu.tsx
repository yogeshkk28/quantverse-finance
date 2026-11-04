import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

/**
 * Profile slot at the far right of the header: the account button and its menu.
 * Kept in its own file so account features can grow here without touching the header.
 */
export default function ProfileMenu({ onNotificationsClick }: { onNotificationsClick?: () => void }) {
  const { user, leave, forget } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
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
            onClick={() => {
              setMenuOpen(false);
              onNotificationsClick?.();
            }}
            className="sm:hidden w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-lq-text-2 hover:bg-lq-surface-2 hover:text-lq-gold"
          >
            <Bell className="w-3.5 h-3.5" /> Activity log
          </button>
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
  );
}
