/**
 * Placeholder sign-up for the landing page gate.
 *
 * An email address gets you a session cookie; there is no password or email
 * verification. The API routes stay open, so this gates the UI only. It is
 * shaped like a real auth provider (enter / me / leave) so it can be swapped
 * for Supabase or Clerk later without touching the front end.
 */
import { Router, Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "server", "data");
const STORE_FILE = path.join(DATA_DIR, "auth.json");
const COOKIE = "lq_sid";
const SESSION_DAYS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Store {
  users: Record<string, { email: string; joinedAt: string }>;
  sessions: Record<string, { email: string; expires: number }>;
}

function load(): Store {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch {
    return { users: {}, sessions: {} };
  }
}

const store = load();

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function sessionFor(req: Request) {
  const sid = req.cookies?.[COOKIE];
  const session = sid ? store.sessions[sid] : undefined;
  if (!session) return null;
  if (session.expires < Date.now()) {
    delete store.sessions[sid];
    save();
    return null;
  }
  return session;
}

// Simple per-IP limit on sign-ups: 10 per minute.
const attempts = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > 10;
}

const router = Router();

router.post("/api/auth/enter", (req: Request, res: Response) => {
  if (tooMany(req.ip ?? "unknown")) {
    return res.status(429).json({ error: "Too many attempts. Try again in a minute." });
  }
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  store.users[email] ??= { email, joinedAt: new Date().toISOString() };
  const sid = crypto.randomBytes(24).toString("hex");
  store.sessions[sid] = { email, expires: Date.now() + SESSION_DAYS * 864e5 };
  save();

  res.cookie(COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 864e5,
  });
  res.json({ user: { email } });
});

router.get("/api/auth/me", (req: Request, res: Response) => {
  const session = sessionFor(req);
  if (!session) return res.json({ user: null });
  res.json({ user: { email: session.email } });
});

router.post("/api/auth/leave", (req: Request, res: Response) => {
  const sid = req.cookies?.[COOKIE];
  if (sid && store.sessions[sid]) {
    delete store.sessions[sid];
    save();
  }
  res.clearCookie(COOKIE).json({ ok: true });
});

// Deletes the signed-in user's email and every session tied to it.
router.post("/api/auth/forget", (req: Request, res: Response) => {
  const session = sessionFor(req);
  if (!session) return res.status(401).json({ error: "Not signed in." });
  delete store.users[session.email];
  for (const [sid, s] of Object.entries(store.sessions)) {
    if (s.email === session.email) delete store.sessions[sid];
  }
  save();
  res.clearCookie(COOKIE).json({ ok: true });
});

export default router;
