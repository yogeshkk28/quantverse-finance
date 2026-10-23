/**
 * Regular trading hours for the world's major exchanges, worked out from the
 * visitor's clock. Weekends count as closed; exchange holidays and lunch
 * breaks are ignored, so this is a guide rather than a trading calendar.
 */

export interface Exchange {
  code: string;
  city: string;
  tz: string;
  open: number; // local minutes after midnight
  close: number;
}

// Ordered by when each session opens, east to west.
export const EXCHANGES: Exchange[] = [
  { code: "ASX", city: "Sydney", tz: "Australia/Sydney", open: 600, close: 960 },
  { code: "TSE", city: "Tokyo", tz: "Asia/Tokyo", open: 540, close: 930 },
  { code: "HKEX", city: "Hong Kong", tz: "Asia/Hong_Kong", open: 570, close: 960 },
  { code: "NSE", city: "Mumbai", tz: "Asia/Kolkata", open: 555, close: 930 },
  { code: "XETRA", city: "Frankfurt", tz: "Europe/Berlin", open: 540, close: 1050 },
  { code: "LSE", city: "London", tz: "Europe/London", open: 480, close: 990 },
  { code: "NYSE", city: "New York", tz: "America/New_York", open: 570, close: 960 },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const formatters = new Map<string, Intl.DateTimeFormat>();

function localParts(tz: string, now: Date) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    formatters.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  // Offset from UTC in minutes, from the difference between local wall time and the real instant.
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  const offset = Math.round((wall - Math.floor(now.getTime() / 60_000) * 60_000) / 60_000);
  return { day: WEEKDAYS.indexOf(p.weekday), minutes, offset };
}

export interface ExchangeStatus extends Exchange {
  isOpen: boolean;
  localTime: string; // "09:41"
  /** Minutes until the next open (0 while open). */
  opensIn: number;
  /** Session start and end on the visitor's 24-hour clock, in minutes. */
  start: number;
  end: number;
}

export function marketStatus(now: Date): ExchangeStatus[] {
  const viewerOffset = -now.getTimezoneOffset();
  return EXCHANGES.map((ex) => {
    const { day, minutes, offset } = localParts(ex.tz, now);
    const weekday = day >= 1 && day <= 5;
    const isOpen = weekday && minutes >= ex.open && minutes < ex.close;

    let opensIn = 0;
    if (!isOpen) {
      // Days until the next weekday on which the open is still ahead.
      let ahead = weekday && minutes < ex.open ? 0 : 1;
      while (((day + ahead) % 7) % 6 === 0) ahead++; // skip Saturday (6) and Sunday (0)
      opensIn = ahead * 1440 + ex.open - minutes;
    }

    const shift = viewerOffset - offset;
    const wrap = (m: number) => ((m % 1440) + 1440) % 1440;
    return {
      ...ex,
      isOpen,
      localTime: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
      opensIn,
      start: wrap(ex.open + shift),
      end: wrap(ex.close + shift),
    };
  });
}

export function formatWait(minutes: number): string {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** "Mumbai", "Mumbai and Tokyo", "Mumbai, Tokyo and London". */
export function joinCities(cities: string[]): string {
  if (cities.length <= 1) return cities[0] ?? "";
  return `${cities.slice(0, -1).join(", ")} and ${cities[cities.length - 1]}`;
}
