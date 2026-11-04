/**
 * Local account store for the paper-trading terminal.
 *
 * Everything lives in one JSON file, server/data/accounts.json (gitignored),
 * written atomically (temp file + rename) so a crash mid-write can't corrupt it.
 * The app runs locally on one machine, so a file is enough; the functions here
 * are the only code that touches it, which keeps a later move to SQLite or
 * Postgres a change to this file alone.
 *
 * Passwords are hashed with scrypt (random 16-byte salt per user). Session
 * tokens are random 32-byte values; only their SHA-256 is stored, so a copy of
 * the file can't be used to sign in as anyone.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "server", "data");
const STORE_FILE = path.join(DATA_DIR, "accounts.json");
// The earlier email-only gate kept emails here. Those accounts had no password
// and can't sign in any more, so the file is removed on start-up.
const LEGACY_FILE = path.join(DATA_DIR, "auth.json");

export const SESSION_DAYS = 30;
export const STARTING_CASH_OPTIONS = [10_000, 100_000, 1_000_000] as const;
export const COUNTRIES = ["IN", "US", "OTHER"] as const;
export const EXPERIENCE = ["new", "some", "experienced"] as const;
export const MARKETS = ["IN", "US", "BOTH"] as const;
const MAX_TRADES = 500;
const MAX_NAV_POINTS = 365;

export type Country = (typeof COUNTRIES)[number];
export type Experience = (typeof EXPERIENCE)[number];
export type Market = (typeof MARKETS)[number];

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  /** YYYY-MM-DD. Used to check the minimum age and to show the user's age. */
  dateOfBirth: string;
  country: Country;
  experience: Experience;
  preferredMarket: Market;
  /** Set when the user is 13 to 17 and confirmed a parent or guardian agreed. */
  guardianConsent: boolean;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  passwordChangedAt: string;
}

export interface Position {
  qty: number;
  avgCost: number;
}

export interface Trade {
  id: string;
  at: string;
  ticker: string;
  side: "buy" | "sell";
  orderType: string;
  qty: number;
  price: number;
}

export interface Portfolio {
  startingCash: number;
  cash: number;
  positions: Record<string, Position>;
  trades: Trade[];
  /** One point per day: the account's total value when the user last looked. */
  nav: Array<{ date: string; value: number }>;
  resetAt: string | null;
}

interface Session {
  userId: string;
  createdAt: number;
  expires: number;
}

interface Store {
  version: 1;
  users: Record<string, UserRecord>;
  /** Lower-cased email -> user id. */
  emails: Record<string, string>;
  /** SHA-256 of the session token -> session. */
  sessions: Record<string, Session>;
  portfolios: Record<string, Portfolio>;
}

function emptyStore(): Store {
  return { version: 1, users: {}, emails: {}, sessions: {}, portfolios: {} };
}

function load(): Store {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    return { ...emptyStore(), ...parsed };
  } catch (err: any) {
    if (err?.code !== "ENOENT") console.error("[Accounts] Could not read accounts.json, starting empty:", err);
    return emptyStore();
  }
}

const store = load();

try {
  if (fs.existsSync(LEGACY_FILE)) {
    fs.unlinkSync(LEGACY_FILE);
    console.log("[Accounts] Removed the old email-only sign-up file (server/data/auth.json).");
  }
} catch {}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, STORE_FILE);
}

// ------------------------------------------------------------------ passwords

const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

function scrypt(password: string, salt: Buffer, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize("NFKC"), salt, keylen, { N, r, p, maxmem: SCRYPT.maxmem }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keylen);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, N, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(password, Buffer.from(salt, "base64"), +N, +r, +p, expected.length);
  return crypto.timingSafeEqual(key, expected);
}

// A real hash to compare against when the email is unknown, so a failed login
// takes the same time whether or not the account exists.
const dummyHash = hashPassword(crypto.randomBytes(16).toString("hex"));
export async function burnPasswordCheck(password: string) {
  await verifyPassword(password, await dummyHash).catch(() => false);
}

// ------------------------------------------------------------------ validation

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function ageOn(dateOfBirth: string, today = new Date()): number {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

export type FieldErrors = Partial<Record<string, string>>;

export function checkPassword(password: string, email?: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 200) return "Use 200 characters or fewer.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  const local = email?.split("@")[0];
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
    return "Don't include your email address in your password.";
  }
  return null;
}

export interface ProfileInput {
  fullName: string;
  dateOfBirth: string;
  country: Country;
  experience: Experience;
  preferredMarket: Market;
  guardianConsent: boolean;
}

/** Validates the profile fields shared by sign-up and profile edits. */
export function checkProfile(body: any): { value: ProfileInput; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const fullName = String(body?.fullName ?? "").trim().replace(/\s+/g, " ");
  if (fullName.length < 2) errors.fullName = "Enter your full name.";
  else if (fullName.length > 80) errors.fullName = "Use 80 characters or fewer.";
  else if (/[<>{}\\/@0-9]/.test(fullName)) errors.fullName = "Use letters, spaces, hyphens and apostrophes only.";

  const dateOfBirth = String(body?.dateOfBirth ?? "");
  const guardianConsent = body?.guardianConsent === true;
  const dobOk = /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) && !Number.isNaN(Date.parse(`${dateOfBirth}T00:00:00Z`));
  if (!dobOk) {
    errors.dateOfBirth = "Enter your date of birth.";
  } else {
    const age = ageOn(dateOfBirth);
    if (age < 0 || age > 120) errors.dateOfBirth = "Check the year of your date of birth.";
    else if (age < 13) errors.dateOfBirth = "You need to be at least 13 to create an account.";
    else if (age < 18 && !guardianConsent) {
      errors.guardianConsent = "Under 18s need a parent's or guardian's permission. Tick the box once they've agreed.";
    }
  }

  const country = String(body?.country ?? "") as Country;
  if (!COUNTRIES.includes(country)) errors.country = "Choose where you live.";
  const experience = String(body?.experience ?? "") as Experience;
  if (!EXPERIENCE.includes(experience)) errors.experience = "Choose your trading experience.";
  const preferredMarket = String(body?.preferredMarket ?? "") as Market;
  if (!MARKETS.includes(preferredMarket)) errors.preferredMarket = "Choose the market you'll trade most.";

  return {
    value: {
      fullName,
      dateOfBirth,
      country,
      experience,
      preferredMarket,
      guardianConsent: dobOk && ageOn(dateOfBirth) < 18 ? guardianConsent : false,
    },
    errors,
  };
}

export function checkEmail(email: string): string | null {
  if (!EMAIL.test(email) || email.length > 254) return "Enter a valid email address.";
  return null;
}

// ------------------------------------------------------------------ users

export function findUserByEmail(email: string): UserRecord | undefined {
  const id = store.emails[normalizeEmail(email)];
  return id ? store.users[id] : undefined;
}

export function getUser(id: string): UserRecord | undefined {
  return store.users[id];
}

export function createUser(input: ProfileInput & { email: string; passwordHash: string; startingCash: number }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { startingCash, ...rest } = input;
  const user: UserRecord = { id, ...rest, createdAt: now, updatedAt: now, passwordChangedAt: now };
  store.users[id] = user;
  store.emails[input.email] = id;
  store.portfolios[id] = freshPortfolio(startingCash);
  save();
  return user;
}

export function updateUser(id: string, patch: Partial<Omit<UserRecord, "id" | "createdAt">>) {
  const user = store.users[id];
  if (!user) return undefined;
  if (patch.email && patch.email !== user.email) {
    delete store.emails[user.email];
    store.emails[patch.email] = id;
  }
  Object.assign(user, patch, { updatedAt: new Date().toISOString() });
  save();
  return user;
}

export function deleteUser(id: string) {
  const user = store.users[id];
  if (!user) return;
  delete store.emails[user.email];
  delete store.users[id];
  delete store.portfolios[id];
  for (const [key, s] of Object.entries(store.sessions)) if (s.userId === id) delete store.sessions[key];
  save();
}

/** What the browser is allowed to see about a user: everything except the hash. */
export function publicUser(user: UserRecord) {
  const { passwordHash, ...rest } = user;
  return { ...rest, age: ageOn(user.dateOfBirth) };
}

// ------------------------------------------------------------------ sessions

const tokenKey = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  store.sessions[tokenKey(token)] = { userId, createdAt: now, expires: now + SESSION_DAYS * 864e5 };
  pruneSessions(false);
  save();
  return token;
}

export function userForToken(token: string | undefined): UserRecord | null {
  if (!token) return null;
  const key = tokenKey(token);
  const session = store.sessions[key];
  if (!session) return null;
  if (session.expires < Date.now() || !store.users[session.userId]) {
    delete store.sessions[key];
    save();
    return null;
  }
  return store.users[session.userId];
}

export function endSession(token: string | undefined) {
  if (!token) return;
  const key = tokenKey(token);
  if (store.sessions[key]) {
    delete store.sessions[key];
    save();
  }
}

/** Ends every session for the user, except the one holding `keepToken`. Returns how many ended. */
export function endOtherSessions(userId: string, keepToken?: string): number {
  const keep = keepToken ? tokenKey(keepToken) : null;
  let n = 0;
  for (const [key, s] of Object.entries(store.sessions)) {
    if (s.userId === userId && key !== keep) {
      delete store.sessions[key];
      n++;
    }
  }
  if (n) save();
  return n;
}

export function sessionCount(userId: string): number {
  const now = Date.now();
  return Object.values(store.sessions).filter((s) => s.userId === userId && s.expires > now).length;
}

function pruneSessions(persist = true) {
  const now = Date.now();
  let changed = false;
  for (const [key, s] of Object.entries(store.sessions)) {
    if (s.expires < now) {
      delete store.sessions[key];
      changed = true;
    }
  }
  if (changed && persist) save();
}

// ------------------------------------------------------------------ portfolios

function freshPortfolio(startingCash: number): Portfolio {
  return { startingCash, cash: startingCash, positions: {}, trades: [], nav: [], resetAt: null };
}

export function getPortfolio(userId: string): Portfolio {
  store.portfolios[userId] ??= freshPortfolio(100_000);
  return store.portfolios[userId];
}

export function resetPortfolio(userId: string, startingCash?: number): Portfolio {
  const current = getPortfolio(userId);
  const next = freshPortfolio(startingCash ?? current.startingCash);
  next.resetAt = new Date().toISOString();
  store.portfolios[userId] = next;
  save();
  return next;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type TradeResult = { ok: boolean; portfolio?: Portfolio; trade?: Trade; error?: string };

export function applyTrade(
  userId: string,
  order: { ticker: string; side: "buy" | "sell"; orderType: string; qty: number; price: number }
): TradeResult {
  const p = getPortfolio(userId);
  const total = round2(order.qty * order.price);
  if (order.side === "buy") {
    if (p.cash < total) {
      return {
        ok: false,
        error: `Not enough virtual cash. This order costs $${total.toLocaleString()} and you have $${p.cash.toLocaleString()}.`,
      };
    }
    const pos = p.positions[order.ticker] ?? { qty: 0, avgCost: 0 };
    const qty = pos.qty + order.qty;
    p.positions[order.ticker] = { qty, avgCost: round2((pos.qty * pos.avgCost + order.qty * order.price) / qty) };
    p.cash = round2(p.cash - total);
  } else {
    const pos = p.positions[order.ticker];
    if (!pos || pos.qty < order.qty) {
      return { ok: false, error: `You hold ${pos?.qty ?? 0} ${order.ticker}, so you can't sell ${order.qty}.` };
    }
    const qty = pos.qty - order.qty;
    if (qty <= 0) delete p.positions[order.ticker];
    else p.positions[order.ticker] = { qty, avgCost: pos.avgCost };
    p.cash = round2(p.cash + total);
  }
  const trade: Trade = { id: crypto.randomUUID(), at: new Date().toISOString(), ...order };
  p.trades = [trade, ...p.trades].slice(0, MAX_TRADES);
  save();
  return { ok: true, portfolio: p, trade };
}

export function recordNav(userId: string, value: number): Portfolio {
  const p = getPortfolio(userId);
  const today = new Date().toISOString().slice(0, 10);
  const last = p.nav[p.nav.length - 1];
  if (last?.date === today && last.value === value) return p;
  p.nav = p.nav.filter((pt) => pt.date !== today).concat({ date: today, value: round2(value) }).slice(-MAX_NAV_POINTS);
  save();
  return p;
}
