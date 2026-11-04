import React, { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "./AuthLayout";
import { PasswordField, TextField } from "./fields";

export default function LoginPage() {
  const { user, logIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state as { from?: string } | null)?.from || "/app/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && !busy) return <Navigate to={next} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    const r = await logIn(email.trim(), password);
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      return;
    }
    navigate(next, { replace: true, state: { via: "wormhole" } });
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Log in"
      lead={
        (location.state as { from?: string } | null)?.from
          ? "Log in to open the trading terminal."
          : "Pick up your paper portfolio where you left it."
      }
    >
      <form className="lq-auth__form" onSubmit={onSubmit} noValidate>
        <TextField
          id="li-email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <PasswordField
          id="li-password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="lq-form__msg" data-kind="error" role="status" aria-live="polite">
          {error ?? ""}
        </p>
        <div className="lq-auth__actions">
          <button type="submit" className="lq-btn lq-btn--gold lq-auth__submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
            <span className="lq-btn__arrow" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </form>
      <p className="lq-auth__fine-left">
        Forgot your password? Accounts live on this computer only, so there's no reset email. Create a new account, or
        ask whoever runs this copy of Lumina Quant to remove the old one.
      </p>
      <p className="lq-auth__switch">
        New to Lumina Quant?{" "}
        <Link to="/signup" state={location.state}>
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
