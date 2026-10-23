import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface User {
  email: string;
}

type EnterResult = { ok: true; error?: undefined } | { ok: false; error: string };

interface AuthState {
  user: User | null;
  loading: boolean;
  enter: (email: string) => Promise<EnterResult>;
  leave: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Session state backed by the placeholder email gate in server/auth.ts. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const enter = useCallback(async (email: string): Promise<EnterResult> => {
    try {
      const res = await fetch("/api/auth/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || "Sign-up failed. Try again." };
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: "Can't reach the server. Check your connection and try again." };
    }
  }, []);

  const leave = useCallback(async () => {
    await fetch("/api/auth/leave", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, enter, leave }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
