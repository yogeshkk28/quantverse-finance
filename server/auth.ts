/**
 * Accounts, sign-in and the paper portfolio API.
 *
 * Auth:      POST /api/auth/signup, /api/auth/login, /api/auth/logout · GET /api/auth/me
 * Account:   PATCH /api/account/profile · POST /api/account/email, /api/account/password,
 *            /api/account/sessions/revoke, /api/account/delete · GET /api/account/export
 * Portfolio: GET /api/portfolio · POST /api/portfolio/trade, /api/portfolio/reset, /api/portfolio/nav
 *
 * Everything under /api/account and /api/portfolio needs a signed-in session.
 * Market-data routes elsewhere stay open.
 */
import { Router, Request, Response, NextFunction } from "express";
import {
  SESSION_DAYS,
  STARTING_CASH_OPTIONS,
  UserRecord,
  applyTrade,
  burnPasswordCheck,
  checkEmail,
  checkPassword,
  checkProfile,
  createSession,
  createUser,
  deleteUser,
  endOtherSessions,
  endSession,
  findUserByEmail,
  getPortfolio,
  hashPassword,
  normalizeEmail,
  publicUser,
  recordNav,
  resetPortfolio,
  sessionCount,
  updateUser,
  userForToken,
  verifyPassword,
  FieldErrors,
} from "./accounts";

const COOKIE = "lq_sid";

// ------------------------------------------------------------------ rate limits

/** Sliding-window counter kept in memory only. */
function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    hit(key: string) {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      recent.push(now);
      hits.set(key, recent);
      return recent.length > max;
    },
    count(key: string) {
      const now = Date.now();
      return (hits.get(key) ?? []).filter((t) => now - t < windowMs).length;
    },
    clear(key: string) {
      hits.delete(key);
    },
  };
}

const perIp = limiter(20, 60_000); // sign-up and login attempts per IP per minute
const failedLogins = limiter(5, 15 * 60_000); // wrong passwords per email per 15 minutes

function tooMany(req: Request, res: Response) {
  if (!perIp.hit(req.ip ?? "unknown")) return false;
  res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
  return true;
}

// ------------------------------------------------------------------ helpers

function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 864e5,
    path: "/",
  });
}

function badRequest(res: Response, errors: FieldErrors, error = "Check the highlighted fields.") {
  return res.status(400).json({ error, fields: errors });
}

interface AuthedRequest extends Request {
  user: UserRecord;
  token: string;
}

function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  const user = userForToken(token);
  if (!user) return res.status(401).json({ error: "Sign in to continue." });
  (req as AuthedRequest).user = user;
  (req as AuthedRequest).token = token;
  next();
}

/** Session routes that change state must come from our own pages. */
function sameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin && req.get("host") && new URL(origin).host !== req.get("host")) {
    return res.status(403).json({ error: "Cross-site request blocked." });
  }
  next();
}

const me = (req: Request) => (req as AuthedRequest).user;

// ------------------------------------------------------------------ routes

const router = Router();
router.use(["/api/auth", "/api/account", "/api/portfolio"], sameOrigin);

router.post("/api/auth/signup", async (req: Request, res: Response) => {
  if (tooMany(req, res)) return;
  const body = req.body ?? {};
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");
  const { value: profile, errors } = checkProfile(body);

  const emailError = checkEmail(email);
  if (emailError) errors.email = emailError;
  const passwordError = checkPassword(password, email);
  if (passwordError) errors.password = passwordError;
  const startingCash = Number(body.startingCash ?? 100_000);
  if (!STARTING_CASH_OPTIONS.includes(startingCash as any)) errors.startingCash = "Choose a starting balance.";
  if (body.acceptTerms !== true) {
    errors.acceptTerms = "Please confirm you've read the privacy policy and understand this is paper trading.";
  }
  if (!errors.email && findUserByEmail(email)) {
    errors.email = "An account with this email already exists. Log in instead.";
  }
  if (Object.keys(errors).length) return badRequest(res, errors);

  const user = createUser({ ...profile, email, passwordHash: await hashPassword(password), startingCash });
  setSessionCookie(res, createSession(user.id));
  res.status(201).json({ user: publicUser(user) });
});

router.post("/api/auth/login", async (req: Request, res: Response) => {
  if (tooMany(req, res)) return;
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "Enter your email and password." });

  if (failedLogins.count(email) >= 5) {
    return res.status(429).json({ error: "Too many wrong passwords for this account. Try again in 15 minutes." });
  }
  const user = findUserByEmail(email);
  const ok = user ? await verifyPassword(password, user.passwordHash).catch(() => false) : (await burnPasswordCheck(password), false);
  if (!user || !ok) {
    failedLogins.hit(email);
    return res.status(401).json({ error: "That email and password don't match an account." });
  }
  failedLogins.clear(email);
  setSessionCookie(res, createSession(user.id));
  res.json({ user: publicUser(user) });
});

router.get("/api/auth/me", (req: Request, res: Response) => {
  const user = userForToken(req.cookies?.[COOKIE]);
  res.json({ user: user ? publicUser(user) : null });
});

router.post("/api/auth/logout", (req: Request, res: Response) => {
  endSession(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, { path: "/" }).json({ ok: true });
});

// ---- account

router.get("/api/account/sessions", requireUser, (req, res) => {
  res.json({ count: sessionCount(me(req).id) });
});

router.patch("/api/account/profile", requireUser, (req: Request, res: Response) => {
  const user = me(req);
  // Fields left out keep their current values.
  const merged = { ...user, ...req.body };
  const { value, errors } = checkProfile(merged);
  if (Object.keys(errors).length) return badRequest(res, errors);
  res.json({ user: publicUser(updateUser(user.id, value)!) });
});

router.post("/api/account/email", requireUser, async (req: Request, res: Response) => {
  const user = me(req);
  const email = normalizeEmail(req.body?.email);
  const errors: FieldErrors = {};
  const emailError = checkEmail(email);
  if (emailError) errors.email = emailError;
  else if (email !== user.email && findUserByEmail(email)) errors.email = "Another account already uses this email.";
  if (!(await verifyPassword(String(req.body?.password ?? ""), user.passwordHash).catch(() => false))) {
    errors.password = "Your current password is wrong.";
  }
  if (Object.keys(errors).length) return badRequest(res, errors);
  res.json({ user: publicUser(updateUser(user.id, { email })!) });
});

router.post("/api/account/password", requireUser, async (req: Request, res: Response) => {
  const user = me(req);
  const current = String(req.body?.currentPassword ?? "");
  const next = String(req.body?.newPassword ?? "");
  const errors: FieldErrors = {};
  if (!(await verifyPassword(current, user.passwordHash).catch(() => false))) {
    errors.currentPassword = "Your current password is wrong.";
  }
  const pwError = checkPassword(next, user.email);
  if (pwError) errors.newPassword = pwError;
  else if (next === current) errors.newPassword = "Choose a password you haven't just used.";
  if (Object.keys(errors).length) return badRequest(res, errors);

  updateUser(user.id, { passwordHash: await hashPassword(next), passwordChangedAt: new Date().toISOString() });
  // A new password signs out every other device.
  const ended = endOtherSessions(user.id, (req as AuthedRequest).token);
  res.json({ ok: true, endedSessions: ended });
});

router.post("/api/account/sessions/revoke", requireUser, (req: Request, res: Response) => {
  const ended = endOtherSessions(me(req).id, (req as AuthedRequest).token);
  res.json({ ok: true, endedSessions: ended });
});

router.get("/api/account/export", requireUser, (req: Request, res: Response) => {
  const user = me(req);
  const data = { exportedAt: new Date().toISOString(), account: publicUser(user), paperPortfolio: getPortfolio(user.id) };
  res.setHeader("Content-Disposition", `attachment; filename="lumina-quant-account-${user.createdAt.slice(0, 10)}.json"`);
  res.json(data);
});

router.post("/api/account/delete", requireUser, async (req: Request, res: Response) => {
  const user = me(req);
  if (!(await verifyPassword(String(req.body?.password ?? ""), user.passwordHash).catch(() => false))) {
    return badRequest(res, { password: "Your password is wrong." }, "Enter your password to delete your account.");
  }
  deleteUser(user.id);
  res.clearCookie(COOKIE, { path: "/" }).json({ ok: true });
});

// ---- paper portfolio

const TICKER = /^[A-Z0-9][A-Z0-9.\-^=&]{0,19}$/;

router.get("/api/portfolio", requireUser, (req, res) => {
  res.json({ portfolio: getPortfolio(me(req).id) });
});

router.post("/api/portfolio/trade", requireUser, (req: Request, res: Response) => {
  const ticker = String(req.body?.ticker ?? "").trim().toUpperCase();
  const side = req.body?.side;
  const qty = Number(req.body?.qty);
  const price = Number(req.body?.price);
  const orderType = String(req.body?.orderType ?? "market").slice(0, 20);
  if (!TICKER.test(ticker)) return res.status(400).json({ error: "Unknown ticker." });
  if (side !== "buy" && side !== "sell") return res.status(400).json({ error: "Choose buy or sell." });
  if (!Number.isInteger(qty) || qty < 1 || qty > 10_000_000) return res.status(400).json({ error: "Quantity must be a whole number of shares." });
  if (!Number.isFinite(price) || price <= 0 || price > 10_000_000) return res.status(400).json({ error: "That price isn't valid." });

  const result = applyTrade(me(req).id, { ticker, side, orderType, qty, price });
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ portfolio: result.portfolio, trade: result.trade });
});

router.post("/api/portfolio/reset", requireUser, (req: Request, res: Response) => {
  const raw = req.body?.startingCash;
  const startingCash = raw === undefined ? undefined : Number(raw);
  if (startingCash !== undefined && !STARTING_CASH_OPTIONS.includes(startingCash as any)) {
    return res.status(400).json({ error: "Choose a starting balance." });
  }
  res.json({ portfolio: resetPortfolio(me(req).id, startingCash) });
});

router.post("/api/portfolio/nav", requireUser, (req: Request, res: Response) => {
  const value = Number(req.body?.value);
  if (!Number.isFinite(value) || value <= 0 || value > 1e12) return res.status(400).json({ error: "Invalid value." });
  res.json({ portfolio: recordNav(me(req).id, value) });
});

export default router;
