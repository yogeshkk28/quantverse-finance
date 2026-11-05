import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Clock } from "lucide-react";
import { chartPath } from "./navConfig";

export interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  market: "US" | "IN" | "GLOBAL";
  sector: string;
  exchange: string;
  kind?: "stock" | "indices" | "futures" | "forex" | "crypto" | "bonds";
}

const KIND_LABEL: Record<NonNullable<SearchResult["kind"]>, string> = {
  stock: "Stock",
  indices: "Index",
  futures: "Futures",
  forex: "Forex",
  crypto: "Crypto",
  bonds: "Bond",
};

const RECENT_KEY = "lq:recent-search";

/** Shown when the box is focused and empty. */
const POPULAR: SearchResult[] = [
  { id: "NVDA", symbol: "NVDA", name: "NVIDIA Corporation", market: "US", sector: "Technology", exchange: "US", kind: "stock" },
  { id: "RELIANCE", symbol: "RELIANCE.NS", name: "Reliance Industries", market: "IN", sector: "Energy", exchange: "NSE", kind: "stock" },
  { id: "AAPL", symbol: "AAPL", name: "Apple Inc.", market: "US", sector: "Technology", exchange: "US", kind: "stock" },
  { id: "TCS", symbol: "TCS.NS", name: "Tata Consultancy Services", market: "IN", sector: "Technology", exchange: "NSE", kind: "stock" },
  { id: "^NSEI", symbol: "^NSEI", name: "Nifty 50", market: "IN", sector: "India", exchange: "Index", kind: "indices" },
  { id: "GC=F", symbol: "GC=F", name: "Gold", market: "GLOBAL", sector: "Metals", exchange: "Futures", kind: "futures" },
];

function readRecent(): SearchResult[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((r) => r && typeof r.id === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function pushRecent(r: SearchResult) {
  try {
    const next = [r, ...readRecent().filter((x) => x.id !== r.id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

/** The display ticker: Yahoo-style symbols get a friendlier code where we know one. */
function code(r: SearchResult) {
  if (r.kind === "stock" || !r.kind) return r.id;
  return r.symbol.replace(/^\^/, "").replace(/=X$/, "").replace(/=F$/, "").replace(/-USD$/, "");
}

/** Bold the matched part of a string. */
function Mark({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent text-lq-gold">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

interface SearchBarProps {
  /** Compact = the full-width mobile row; autoFocus there. */
  autoFocus?: boolean;
  onDone?: () => void;
  className?: string;
}

/**
 * Universal search. Type a ticker or company name (US or India), or an index,
 * future, currency pair or coin; picking a result opens its chart page.
 * Press "/" anywhere to jump here.
 */
export default function SearchBar({ autoFocus, onDone, className = "" }: SearchBarProps) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  // Results are tagged with the query they answer so Enter never opens a stale match.
  const [found, setFound] = useState<{ q: string; items: SearchResult[] }>({ q: "", items: [] });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hi, setHi] = useState(0);
  const [recent, setRecent] = useState<SearchResult[]>(() => readRecent());
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const query = q.trim();
  const showingDefaults = query.length === 0;
  const results = found.q === query ? found.items : [];
  const list = useMemo(() => {
    if (!showingDefaults) return results;
    const seen = new Set(recent.map((r) => r.id));
    return [...recent, ...POPULAR.filter((p) => !seen.has(p.id))].slice(0, 8);
  }, [showingDefaults, results, recent]);

  // Debounced fetch; stale responses are dropped via AbortController.
  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d) => {
          setFound({ q: query, items: Array.isArray(d.results) ? d.results : [] });
          setFailed(false);
          setHi(0);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") {
            setFound({ q: query, items: [] });
            setFailed(true);
          }
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, 120);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // "/" focuses search from anywhere (unless already typing in a field).
  useEffect(() => {
    if (onDone) return; // the mobile row handles its own focus
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if (!typing && (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (r: SearchResult) => {
    pushRecent(r);
    setRecent(readRecent());
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
    navigate(chartPath(r.id));
    onDone?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, Math.max(list.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = list[hi] ?? list[0];
      if (r) pick(r);
      else if (query && /^[A-Za-z0-9.^=&-]{1,20}$/.test(query) && found.q === query) {
        // No match in our lists: still try the chart page, which resolves any listed ticker.
        pick({ id: query.toUpperCase(), symbol: query.toUpperCase(), name: query.toUpperCase(), market: "GLOBAL", sector: "", exchange: "" });
      }
    } else if (e.key === "Escape") {
      if (q) setQ("");
      else {
        setOpen(false);
        inputRef.current?.blur();
        onDone?.();
      }
    }
  };

  const activeId = open && list[hi] ? `${listId}-opt-${hi}` : undefined;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-2 h-10 rounded-full border px-3.5 transition-colors bg-[var(--lq-field)] ${
          open ? "border-lq-gold-line shadow-[0_0_0_3px_rgba(212,175,55,0.08)]" : "border-lq-line-2 hover:border-lq-line-2"
        }`}
      >
        <Search className="w-4 h-4 text-lq-muted flex-shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label="Search stocks, indices, futures, forex and crypto"
          placeholder="Search stocks, indices, futures, crypto…"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => {
            setOpen(true);
            setRecent(readRecent());
          }}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14px] text-lq-text placeholder:text-lq-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {q ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
            className="text-lq-muted hover:text-lq-text"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          !onDone && (
            <kbd className="hidden xl:inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded border border-lq-line-2 text-[11px] text-lq-muted font-mono">
              /
            </kbd>
          )
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 lq-panel p-1.5 lq-menu-in min-w-[320px]">
          <div className="flex items-center justify-between px-3 pt-1.5 pb-1">
            <span className="lq-lbl">
              {showingDefaults ? (recent.length ? "Recent and popular" : "Popular") : loading && results.length === 0 ? "Searching…" : "Results"}
            </span>
            {!showingDefaults && results.length > 0 && <span className="text-[11px] text-lq-muted">Enter to open chart</span>}
          </div>
          <ul id={listId} role="listbox" aria-label="Search results" className="m-0 p-0 list-none max-h-[60vh] overflow-y-auto">
            {list.map((r, i) => {
              const isRecent = showingDefaults && recent.some((x) => x.id === r.id);
              return (
                <li
                  key={`${r.kind ?? "stock"}:${r.id}`}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === hi}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(r)}
                  className={`grid grid-cols-[88px_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-[10px] cursor-pointer ${
                    i === hi ? "bg-lq-surface-2" : ""
                  }`}
                >
                  <span className="lq-num text-[13px] text-lq-text truncate flex items-center gap-1.5">
                    {isRecent && <Clock className="w-3 h-3 text-lq-muted flex-shrink-0" aria-label="Recent" />}
                    <Mark text={code(r)} q={query} />
                  </span>
                  <span className="text-[13px] text-lq-text-2 truncate">
                    <Mark text={r.name} q={query} />
                  </span>
                  <span className="flex items-center gap-1.5">
                    {r.kind && r.kind !== "stock" && <span className="lq-tag !text-[10px]">{KIND_LABEL[r.kind]}</span>}
                    <span className="text-[11px] text-lq-muted lq-num w-10 text-right">
                      {r.kind === "stock" || !r.kind ? r.exchange || r.market : r.market === "GLOBAL" ? "" : r.market}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {!showingDefaults && !loading && results.length === 0 && (
            <p className="m-0 px-3 py-4 text-[13px] text-lq-muted">
              {failed ? (
                "Search is unavailable right now."
              ) : (
                <>
                  No match for “<span className="text-lq-text">{query}</span>”.
                  {/^[A-Za-z0-9.^=&-]{1,20}$/.test(query) && " Press Enter to try it as a ticker."}
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
