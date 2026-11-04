import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Country = "IN" | "US" | "OTHER";
export type Experience = "new" | "some" | "experienced";
export type Market = "IN" | "US" | "BOTH";

export interface User {
  id: string;
  fullName: string;
  email: string;
  dateOfBirth: string;
  age: number;
  country: Country;
  experience: Experience;
  preferredMarket: Market;
  guardianConsent: boolean;
  createdAt: string;
  updatedAt: string;
  passwordChangedAt: string;
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  dateOfBirth: string;
  country: Country;
  experience: Experience;
  preferredMarket: Market;
  startingCash: number;
  guardianConsent: boolean;
  acceptTerms: boolean;
}

export type ProfileInput = Pick<User, "fullName" | "dateOfBirth" | "country" | "experience" | "preferredMarket" | "guardianConsent">;

/**
 * Result of any account call. When `ok` is false, `error` says why and `fields`
 * maps a form field name to its error; the T fields are only set when `ok` is true.
 * (A flat shape rather than a union: the project compiles without strict mode,
 * which can't narrow on `ok`.)
 */
export type Result<T = {}> = { ok: boolean; error?: string; fields?: Record<string, string> } & T;

interface AuthState {
  user: User | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<Result>;
  logIn: (email: string, password: string) => Promise<Result>;
  logOut: () => Promise<void>;
  updateProfile: (input: Partial<ProfileInput>) => Promise<Result>;
  changeEmail: (email: string, password: string) => Promise<Result>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<Result<{ endedSessions: number }>>;
  signOutOthers: () => Promise<Result<{ endedSessions: number }>>;
  deleteAccount: (password: string) => Promise<Result>;
}

const AuthContext = createContext<AuthState | null>(null);

const OFFLINE = "Can't reach the server. Check that it's running and try again.";

/** POSTs (or PATCHes) JSON and folds every failure into a Result. */
export async function call<T = {}>(url: string, body?: unknown, method = "POST"): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Something went wrong. Try again.", fields: data.fields } as Result<T>;
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: OFFLINE } as Result<T>;
  }
}

/** Session state backed by the local account server in server/auth.ts. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    // The pre-account build kept the paper portfolio in the browser. Portfolios
    // now belong to accounts on the server, so drop the old copies.
    try {
      localStorage.removeItem("lumina_quant_portfolio");
      localStorage.removeItem("lumina_quant_nav");
    } catch {}
  }, []);

  const withUser = useCallback(async <T,>(p: Promise<Result<T & { user?: User }>>) => {
    const r = await p;
    if (r.ok && (r as any).user) setUser((r as any).user);
    return r;
  }, []);

  const signUp = useCallback((input: SignUpInput) => withUser(call("/api/auth/signup", input)), [withUser]);
  const logIn = useCallback(
    (email: string, password: string) => withUser(call("/api/auth/login", { email, password })),
    [withUser]
  );
  const logOut = useCallback(async () => {
    await call("/api/auth/logout");
    setUser(null);
  }, []);
  const updateProfile = useCallback(
    (input: Partial<ProfileInput>) => withUser(call("/api/account/profile", input, "PATCH")),
    [withUser]
  );
  const changeEmail = useCallback(
    (email: string, password: string) => withUser(call("/api/account/email", { email, password })),
    [withUser]
  );
  const changePassword = useCallback(
    (currentPassword: string, newPassword: string) =>
      call<{ endedSessions: number }>("/api/account/password", { currentPassword, newPassword }),
    []
  );
  const signOutOthers = useCallback(() => call<{ endedSessions: number }>("/api/account/sessions/revoke"), []);
  const deleteAccount = useCallback(async (password: string) => {
    const r = await call("/api/account/delete", { password });
    if (r.ok) setUser(null);
    return r;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signUp, logIn, logOut, updateProfile, changeEmail, changePassword, signOutOthers, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export const COUNTRY_LABEL: Record<Country, string> = { IN: "India", US: "United States", OTHER: "Somewhere else" };
export const EXPERIENCE_LABEL: Record<Experience, string> = {
  new: "New to trading",
  some: "Some experience",
  experienced: "Experienced trader",
};
export const MARKET_LABEL: Record<Market, string> = { IN: "Indian markets", US: "US markets", BOTH: "Both" };
export const STARTING_CASH = [10_000, 100_000, 1_000_000];

export function initials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
