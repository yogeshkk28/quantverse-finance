import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "./navConfig";

interface NavDropdownProps {
  label: string;
  items: NavItem[];
  /** True when the current page belongs to this menu (draws the active underline). */
  active?: boolean;
  isItemActive?: (item: NavItem) => boolean;
  onPick: (item: NavItem) => void;
  /** Panel width in px. Two columns are used when there are more than four items. */
  width?: number;
  footer?: React.ReactNode;
}

/**
 * Header menu that opens on hover (with a short grace period so the pointer can
 * travel into the panel), and on click, focus or the arrow keys for keyboard users.
 */
export default function NavDropdown({ label, items, active, isItemActive, onPick, width = 360, footer }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const panelId = useId();

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const hideSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const focusItem = (i: number) => {
    const n = items.length;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const onPanelKey = (e: React.KeyboardEvent) => {
    const idx = itemRefs.current.findIndex((el) => el === document.activeElement);
    const cols = items.length > 4 ? 2 : 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(idx + cols);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(idx - cols);
    } else if (e.key === "ArrowRight" && cols > 1) {
      e.preventDefault();
      focusItem(idx + 1);
    } else if (e.key === "ArrowLeft" && cols > 1) {
      e.preventDefault();
      focusItem(idx - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      (rootRef.current?.querySelector("[data-trigger]") as HTMLElement | null)?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const twoCol = items.length > 4;

  return (
    <div ref={rootRef} className="relative" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        type="button"
        data-trigger
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className={`relative flex items-center gap-1 px-3 py-2 text-[14px] transition-colors ${
          active || open ? "text-lq-text" : "text-lq-muted hover:text-lq-text"
        }`}
      >
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180 text-lq-gold" : ""}`} aria-hidden="true" />
        {active && (
          <span className="absolute left-3 right-3 -bottom-[13px] h-[2px] rounded-full bg-lq-gold shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
        )}
      </button>

      {open && (
        <div
          id={panelId}
          onKeyDown={onPanelKey}
          className="absolute left-0 top-full pt-3 z-50"
          style={{ width }}
        >
          <div className="lq-panel p-2 lq-menu-in">
            <ul className={`m-0 p-0 list-none grid gap-1 ${twoCol ? "grid-cols-2" : "grid-cols-1"}`}>
              {items.map((item, i) => {
                const Icon = item.icon;
                const on = isItemActive?.(item) ?? false;
                return (
                  <li key={item.label}>
                    <button
                      ref={(el) => {
                        itemRefs.current[i] = el;
                      }}
                      type="button"
                      aria-current={on ? "page" : undefined}
                      onClick={() => {
                        setOpen(false);
                        onPick(item);
                      }}
                      className={`group w-full flex items-start gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-lq-gold ${
                        on ? "bg-lq-surface-2" : "hover:bg-lq-surface-2 focus:bg-lq-surface-2"
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-8 h-8 flex-shrink-0 rounded-lg border flex items-center justify-center transition-colors ${
                          on
                            ? "border-lq-gold-line text-lq-gold"
                            : "border-lq-line-2 text-lq-muted group-hover:text-lq-gold group-hover:border-lq-gold-line group-focus:text-lq-gold"
                        }`}
                        aria-hidden="true"
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex flex-col min-w-0">
                        <span className={`text-[14px] ${on ? "text-lq-gold" : "text-lq-text"}`}>{item.label}</span>
                        <span className="text-[12px] text-lq-muted leading-snug">{item.hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {footer && <div className="mt-1 border-t border-lq-line-soft px-3 pt-2.5 pb-1.5">{footer}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
