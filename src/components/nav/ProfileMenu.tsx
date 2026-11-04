import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Briefcase, LogOut, Shield, UserRound } from "lucide-react";
import { initials, useAuth } from "../../context/AuthContext";

/**
 * The profile icon in the header's right corner: the user's initials, opening
 * a menu with their name, the account page, the activity log and log out.
 */
export default function ProfileMenu({ onNotificationsClick }: { onNotificationsClick?: () => void }) {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };
  const item =
    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-lq-text-2 hover:bg-lq-surface-2 hover:text-lq-gold transition-colors text-left";

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? `Account: ${user.fullName}` : "Account"}
        title={user?.fullName}
        className="w-10 h-10 rounded-full p-[2px] transition-shadow hover:shadow-[0_0_0_3px_rgba(212,175,55,0.18)]"
        style={{ background: "var(--lq-gold-grad)" }}
      >
        <span className="w-full h-full rounded-full bg-lq-bg-2 flex items-center justify-center font-mono text-[12px] font-semibold tracking-wide text-lq-gold-soft">
          {initials(user?.fullName) || <UserRound className="w-4 h-4" />}
        </span>
      </button>

      {open && user && (
        <div role="menu" aria-label="Account" className="lq-panel absolute right-0 mt-2 w-72 p-2 z-50">
          <div className="flex items-center gap-3 px-3 py-3 border-b border-lq-line mb-1.5">
            <span
              aria-hidden="true"
              className="w-10 h-10 flex-none rounded-full flex items-center justify-center font-mono text-[13px] font-semibold text-[#0a0a0a]"
              style={{ background: "var(--lq-gold-grad)" }}
            >
              {initials(user.fullName)}
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[14px] text-lq-text font-medium truncate">{user.fullName}</p>
              <p className="m-0 text-[12px] text-lq-muted truncate">{user.email}</p>
            </div>
          </div>
          <button type="button" role="menuitem" className={item} onClick={() => go("/app/account")}>
            <UserRound className="w-4 h-4" /> Profile and account
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => go("/app/portfolio")}>
            <Briefcase className="w-4 h-4" /> Paper portfolio
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onNotificationsClick?.();
            }}
          >
            <Bell className="w-4 h-4" /> Activity log
          </button>
          <Link to="/privacy" role="menuitem" className={item} onClick={() => setOpen(false)}>
            <Shield className="w-4 h-4" /> Privacy policy
          </Link>
          <div className="border-t border-lq-line mt-1.5 pt-1.5">
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={async () => {
                setOpen(false);
                await logOut();
                navigate("/");
              }}
            >
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
