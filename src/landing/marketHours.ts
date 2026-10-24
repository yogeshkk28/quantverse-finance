/**
 * Regular trading hours for the world's 20 largest stock exchanges, worked out
 * from the visitor's clock. Lunch breaks and non-Monday-to-Friday weeks are
 * modelled; exchange holidays are not, so this is a guide rather than a
 * trading calendar.
 */

export type Region = "Americas" | "Europe & Africa" | "Middle East" | "Asia-Pacific";
export type Coverage = "covered" | "soon";
export type MarketState = "open" | "lunch" | "closed";

export interface Exchange {
  code: string;
  name: string;
  city: string;
  country: string;
  tz: string;
  region: Region;
  /** Trading sessions in local minutes after midnight; two entries means a lunch break. */
  sessions: [number, number][];
  /** Trading days, 0 = Sunday. */
  days: number[];
  /** Ring on the dial; exchanges with identical hours share one. Only the top 10 have one. */
  group?: string;
  coverage: Coverage;
}

const MON_FRI = [1, 2, 3, 4, 5];
const SUN_THU = [0, 1, 2, 3, 4];
const h = (hours: number, minutes = 0) => hours * 60 + minutes;

// Top 10 by market capitalisation first, then the rest of the top 20.
export const EXCHANGES: Exchange[] = [
  { code: "Nasdaq", name: "Nasdaq", city: "New York", country: "United States", tz: "America/New_York", region: "Americas", sessions: [[h(9, 30), h(16)]], days: MON_FRI, group: "US", coverage: "covered" },
  { code: "NYSE", name: "New York Stock Exchange", city: "New York", country: "United States", tz: "America/New_York", region: "Americas", sessions: [[h(9, 30), h(16)]], days: MON_FRI, group: "US", coverage: "covered" },
  { code: "SSE", name: "Shanghai Stock Exchange", city: "Shanghai", country: "China", tz: "Asia/Shanghai", region: "Asia-Pacific", sessions: [[h(9, 30), h(11, 30)], [h(13), h(15)]], days: MON_FRI, group: "China", coverage: "soon" },
  { code: "JPX", name: "Japan Exchange Group", city: "Tokyo", country: "Japan", tz: "Asia/Tokyo", region: "Asia-Pacific", sessions: [[h(9), h(11, 30)], [h(12, 30), h(15, 30)]], days: MON_FRI, group: "Japan", coverage: "soon" },
  { code: "Euronext", name: "Euronext", city: "Paris", country: "Pan-European", tz: "Europe/Paris", region: "Europe & Africa", sessions: [[h(9), h(17, 30)]], days: MON_FRI, group: "Euronext", coverage: "soon" },
  { code: "SZSE", name: "Shenzhen Stock Exchange", city: "Shenzhen", country: "China", tz: "Asia/Shanghai", region: "Asia-Pacific", sessions: [[h(9, 30), h(11, 30)], [h(13), h(15)]], days: MON_FRI, group: "China", coverage: "soon" },
  { code: "HKEX", name: "Hong Kong Exchanges", city: "Hong Kong", country: "Hong Kong", tz: "Asia/Hong_Kong", region: "Asia-Pacific", sessions: [[h(9, 30), h(12)], [h(13), h(16)]], days: MON_FRI, group: "Hong Kong", coverage: "soon" },
  { code: "TSX", name: "Toronto Stock Exchange", city: "Toronto", country: "Canada", tz: "America/Toronto", region: "Americas", sessions: [[h(9, 30), h(16)]], days: MON_FRI, group: "Canada", coverage: "soon" },
  { code: "BSE", name: "BSE India", city: "Mumbai", country: "India", tz: "Asia/Kolkata", region: "Asia-Pacific", sessions: [[h(9, 15), h(15, 30)]], days: MON_FRI, group: "India", coverage: "soon" },
  { code: "KRX", name: "Korea Exchange", city: "Seoul", country: "South Korea", tz: "Asia/Seoul", region: "Asia-Pacific", sessions: [[h(9), h(15, 30)]], days: MON_FRI, group: "Korea", coverage: "soon" },

  { code: "NSE", name: "National Stock Exchange of India", city: "Mumbai", country: "India", tz: "Asia/Kolkata", region: "Asia-Pacific", sessions: [[h(9, 15), h(15, 30)]], days: MON_FRI, group: "India", coverage: "covered" },
  { code: "Tadawul", name: "Saudi Exchange", city: "Riyadh", country: "Saudi Arabia", tz: "Asia/Riyadh", region: "Middle East", sessions: [[h(10), h(15)]], days: SUN_THU, coverage: "soon" },
  { code: "LSE", name: "London Stock Exchange", city: "London", country: "United Kingdom", tz: "Europe/London", region: "Europe & Africa", sessions: [[h(8), h(16, 30)]], days: MON_FRI, coverage: "soon" },
  { code: "SIX", name: "SIX Swiss Exchange", city: "Zurich", country: "Switzerland", tz: "Europe/Zurich", region: "Europe & Africa", sessions: [[h(9), h(17, 30)]], days: MON_FRI, coverage: "soon" },
  { code: "TWSE", name: "Taiwan Stock Exchange", city: "Taipei", country: "Taiwan", tz: "Asia/Taipei", region: "Asia-Pacific", sessions: [[h(9), h(13, 30)]], days: MON_FRI, coverage: "soon" },
  { code: "Xetra", name: "Deutsche Börse", city: "Frankfurt", country: "Germany", tz: "Europe/Berlin", region: "Europe & Africa", sessions: [[h(9), h(17, 30)]], days: MON_FRI, coverage: "soon" },
  { code: "ASX", name: "Australian Securities Exchange", city: "Sydney", country: "Australia", tz: "Australia/Sydney", region: "Asia-Pacific", sessions: [[h(10), h(16)]], days: MON_FRI, coverage: "soon" },
  { code: "JSE", name: "Johannesburg Stock Exchange", city: "Johannesburg", country: "South Africa", tz: "Africa/Johannesburg", region: "Europe & Africa", sessions: [[h(9), h(17)]], days: MON_FRI, coverage: "soon" },
  { code: "BME", name: "BME Spanish Exchanges", city: "Madrid", country: "Spain", tz: "Europe/Madrid", region: "Europe & Africa", sessions: [[h(9), h(17, 30)]], days: MON_FRI, coverage: "soon" },
  { code: "B3", name: "B3 Brasil Bolsa Balcão", city: "São Paulo", country: "Brazil", tz: "America/Sao_Paulo", region: "Americas", sessions: [[h(10), h(17)]], days: MON_FRI, coverage: "soon" },
];

export const REGIONS: Region[] = ["Americas", "Europe & Africa", "Middle East", "Asia-Pacific"];

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

const pad = (n: number) => String(n).padStart(2, "0");
const wrap = (m: number) => ((m % 1440) + 1440) % 1440;

function utcLabel(offset: number): string {
  const sign = offset < 0 ? "−" : "+";
  const abs = Math.abs(offset);
  return `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${pad(abs % 60)}` : ""}`;
}

export interface ExchangeStatus extends Exchange {
  state: MarketState;
  localTime: string; // "09:41"
  utcOffset: string; // "UTC+5:30"
  /** Minutes until the next session starts (0 while open). */
  opensIn: number;
  /** Sessions on the visitor's 24-hour clock, in minutes. */
  viewerSessions: [number, number][];
}

export function exchangeStatus(ex: Exchange, now: Date): ExchangeStatus {
  const { day, minutes, offset } = localParts(ex.tz, now);
  const tradingDay = ex.days.includes(day);
  const inSession = tradingDay && ex.sessions.some(([a, b]) => minutes >= a && minutes < b);
  const inLunch =
    tradingDay && !inSession && minutes >= ex.sessions[0][0] && minutes < ex.sessions[ex.sessions.length - 1][1];
  const state: MarketState = inSession ? "open" : inLunch ? "lunch" : "closed";

  let opensIn = 0;
  if (!inSession) {
    search: for (let ahead = 0; ahead <= 8; ahead++) {
      if (!ex.days.includes((day + ahead) % 7)) continue;
      for (const [start] of ex.sessions) {
        const wait = ahead * 1440 + start - minutes;
        if (wait > 0) {
          opensIn = wait;
          break search;
        }
      }
    }
  }

  const shift = -now.getTimezoneOffset() - offset;
  return {
    ...ex,
    state,
    localTime: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
    utcOffset: utcLabel(offset),
    opensIn,
    viewerSessions: ex.sessions.map(([a, b]) => [wrap(a + shift), wrap(b + shift)]),
  };
}

export function marketStatus(now: Date): ExchangeStatus[] {
  return EXCHANGES.map((ex) => exchangeStatus(ex, now));
}

export interface MarketGroup {
  label: string;
  members: ExchangeStatus[];
  /** Members share hours, so the first one speaks for the group. */
  lead: ExchangeStatus;
}

/** The dial's rings: the top 10 exchanges, merged where they share hours. */
export function dialGroups(status: ExchangeStatus[]): MarketGroup[] {
  const groups = new Map<string, ExchangeStatus[]>();
  for (const s of status) {
    if (!s.group) continue;
    groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
  }
  return [...groups].map(([label, members]) => ({ label, members, lead: members[0] }));
}

export function formatWait(minutes: number): string {
  const d = Math.floor(minutes / 1440);
  const hrs = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return hrs > 0 ? `${d}d ${hrs}h` : `${d}d`;
  if (hrs > 0) return m > 0 ? `${hrs}h ${m}m` : `${hrs}h`;
  return `${m}m`;
}

/** "Mumbai", "Mumbai and Tokyo", "Mumbai, Tokyo and London". */
export function joinCities(cities: string[]): string {
  if (cities.length <= 1) return cities[0] ?? "";
  return `${cities.slice(0, -1).join(", ")} and ${cities[cities.length - 1]}`;
}
