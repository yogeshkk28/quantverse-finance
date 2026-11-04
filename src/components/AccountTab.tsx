import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, KeyRound, LogOut, Mail, ShieldAlert, UserRound, Wallet } from "lucide-react";
import {
  COUNTRY_LABEL,
  EXPERIENCE_LABEL,
  MARKET_LABEL,
  ProfileInput,
  STARTING_CASH,
  call,
  initials,
  useAuth,
} from "../context/AuthContext";
import type { Portfolio } from "../app/usePortfolio";
import { PasswordField, PasswordRules, SelectField, TextField, ageFrom, money } from "../auth/fields";
import "../auth/auth.css";

type Errors = Record<string, string>;
type Notice = { kind: "ok" | "error"; text: string } | null;

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

function Section({
  icon: Icon,
  title,
  lead,
  children,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  lead?: string;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section className={`lq-panel p-6 md:p-7 ${tone === "danger" ? "border-[rgba(248,113,113,0.35)]" : ""}`}>
      <div className="flex items-center gap-2.5 mb-1">
        <Icon className={`w-4 h-4 ${tone === "danger" ? "text-lq-down" : "text-lq-gold"}`} />
        <h2 className="lq-h3">{title}</h2>
      </div>
      {lead && <p className="m-0 mb-5 text-[13px] text-lq-muted leading-relaxed">{lead}</p>}
      {children}
    </section>
  );
}

function NoticeLine({ notice }: { notice: Notice }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`m-0 text-[13px] min-h-[1.25em] ${notice?.kind === "error" ? "text-lq-down" : "text-lq-gold-soft"}`}
    >
      {notice?.text ?? ""}
    </p>
  );
}

/** Profile and account settings, reached from the profile icon in the header. */
export default function AccountTab({
  portfolio,
  onResetPortfolio,
}: {
  portfolio: Portfolio;
  onResetPortfolio: (startingCash?: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { user, updateProfile, changeEmail, changePassword, signOutOthers, deleteAccount, logOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Account · Lumina Quant";
  }, []);

  // ---- profile
  const [profile, setProfile] = useState<ProfileInput>(() => ({
    fullName: user?.fullName ?? "",
    dateOfBirth: user?.dateOfBirth ?? "",
    country: user?.country ?? "IN",
    experience: user?.experience ?? "new",
    preferredMarket: user?.preferredMarket ?? "BOTH",
    guardianConsent: user?.guardianConsent ?? false,
  }));
  const [profileErr, setProfileErr] = useState<Errors>({});
  const [profileNote, setProfileNote] = useState<Notice>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const age = ageFrom(profile.dateOfBirth);
  const minor = age !== null && age >= 13 && age < 18;
  const dirty =
    !!user &&
    (Object.keys(profile) as Array<keyof ProfileInput>).some((k) => (profile[k] as unknown) !== (user[k] as unknown));

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNote(null);
    const r = await updateProfile(profile);
    setSavingProfile(false);
    if (r.ok) {
      setProfileErr({});
      setProfileNote({ kind: "ok", text: "Profile saved." });
    } else {
      setProfileErr(r.fields ?? {});
      setProfileNote({ kind: "error", text: r.error });
    }
  }

  // ---- email
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailPw, setEmailPw] = useState("");
  const [emailErr, setEmailErr] = useState<Errors>({});
  const [emailNote, setEmailNote] = useState<Notice>(null);

  async function saveEmail(e: FormEvent) {
    e.preventDefault();
    setEmailNote(null);
    const r = await changeEmail(email.trim(), emailPw);
    if (r.ok) {
      setEmailErr({});
      setEmailPw("");
      setEmailNote({ kind: "ok", text: "Email updated. Use it the next time you log in." });
    } else {
      setEmailErr(r.fields ?? {});
      setEmailNote({ kind: "error", text: r.error });
    }
  }

  // ---- password
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErr, setPwErr] = useState<Errors>({});
  const [pwNote, setPwNote] = useState<Notice>(null);

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPwNote(null);
    if (pw.next !== pw.confirm) {
      setPwErr({ confirm: "The new passwords don't match." });
      return;
    }
    const r = await changePassword(pw.current, pw.next);
    if (r.ok) {
      setPwErr({});
      setPw({ current: "", next: "", confirm: "" });
      setPwNote({
        kind: "ok",
        text:
          r.endedSessions > 0
            ? `Password changed. ${r.endedSessions} other session${r.endedSessions === 1 ? " was" : "s were"} signed out.`
            : "Password changed.",
      });
    } else {
      setPwErr(r.fields ?? {});
      setPwNote({ kind: "error", text: r.error });
    }
  }

  // ---- sessions
  const [sessions, setSessions] = useState<number | null>(null);
  const [sessionNote, setSessionNote] = useState<Notice>(null);
  useEffect(() => {
    call<{ count: number }>("/api/account/sessions", undefined, "GET").then((r) => r.ok && setSessions(r.count));
  }, [pwNote]);

  // ---- paper account
  const [cashChoice, setCashChoice] = useState(portfolio.startingCash || 100_000);
  const [resetNote, setResetNote] = useState<Notice>(null);
  useEffect(() => {
    if (portfolio.startingCash) setCashChoice(portfolio.startingCash);
  }, [portfolio.startingCash]);

  // ---- delete
  const [deletePw, setDeletePw] = useState("");
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!user) return null;

  const invested = Object.values(portfolio.positions).reduce((s, p) => s + p.qty * p.avgCost, 0);

  return (
    <div className="w-full max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
      {/* Identity header */}
      <div className="lq-panel p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5">
        <span
          aria-hidden="true"
          className="w-16 h-16 md:w-20 md:h-20 flex-none rounded-full flex items-center justify-center font-mono text-[22px] md:text-[26px] font-semibold text-[#0a0a0a]"
          style={{ background: "var(--lq-gold-grad)" }}
        >
          {initials(user.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <span className="lq-lbl">Your account</span>
          <h1 className="lq-h1 mt-1 truncate">{user.fullName}</h1>
          <p className="m-0 mt-1.5 text-[14px] text-lq-text-2 truncate">{user.email}</p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-1 m-0 text-[12px]">
          <dt className="lq-lbl">Member since</dt>
          <dt className="lq-lbl">Age</dt>
          <dt className="lq-lbl">Account</dt>
          <dd className="m-0 text-lq-text lq-num">{date(user.createdAt)}</dd>
          <dd className="m-0 text-lq-text lq-num">{user.age}</dd>
          <dd className="m-0 text-lq-gold">Paper</dd>
        </dl>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile */}
        <Section icon={UserRound} title="Profile" lead="Used to personalise the terminal. Never shared with anyone.">
          <form onSubmit={saveProfile} className="grid gap-4" noValidate>
            <TextField
              label="Full name"
              autoComplete="name"
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              error={profileErr.fullName}
              maxLength={80}
            />
            <TextField
              label="Date of birth"
              type="date"
              autoComplete="bday"
              value={profile.dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
              error={profileErr.dateOfBirth}
            />
            {minor && (
              <label className="lq-check">
                <input
                  type="checkbox"
                  checked={profile.guardianConsent}
                  onChange={(e) => setProfile({ ...profile, guardianConsent: e.target.checked })}
                />
                <span>
                  A parent or guardian has agreed to me having this account.
                  {profileErr.guardianConsent && <span className="lq-field__error">{profileErr.guardianConsent}</span>}
                </span>
              </label>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Country"
                value={profile.country}
                onChange={(e) => setProfile({ ...profile, country: e.target.value as ProfileInput["country"] })}
                error={profileErr.country}
                options={Object.entries(COUNTRY_LABEL) as Array<[string, string]>}
              />
              <SelectField
                label="Main market"
                value={profile.preferredMarket}
                onChange={(e) =>
                  setProfile({ ...profile, preferredMarket: e.target.value as ProfileInput["preferredMarket"] })
                }
                error={profileErr.preferredMarket}
                options={Object.entries(MARKET_LABEL) as Array<[string, string]>}
              />
            </div>
            <SelectField
              label="Trading experience"
              value={profile.experience}
              onChange={(e) => setProfile({ ...profile, experience: e.target.value as ProfileInput["experience"] })}
              error={profileErr.experience}
              options={Object.entries(EXPERIENCE_LABEL) as Array<[string, string]>}
            />
            <div className="flex items-center gap-4">
              <button type="submit" className="lq-abtn" disabled={!dirty || savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
              <NoticeLine notice={profileNote} />
            </div>
          </form>
        </Section>

        {/* Paper account */}
        <Section
          icon={Wallet}
          title="Paper account"
          lead="Your virtual balance and holdings are saved to this account, so they follow you to any browser you log in from."
        >
          <dl className="grid grid-cols-2 gap-3 m-0 mb-5">
            {[
              ["Cash", money(Math.round(portfolio.cash))],
              ["Invested at cost", money(Math.round(invested))],
              ["Open positions", String(Object.keys(portfolio.positions).length)],
              ["Trades placed", String(portfolio.trades.length)],
            ].map(([k, v]) => (
              <div key={k} className="lq-card p-3.5">
                <dt className="lq-lbl">{k}</dt>
                <dd className="m-0 mt-1.5 lq-num text-[17px] text-lq-text">{v}</dd>
              </div>
            ))}
          </dl>

          <fieldset className="lq-choice mb-4">
            <legend className="lq-field__label">Starting balance after a reset</legend>
            <div className="lq-choice__opts">
              {STARTING_CASH.map((amt) => (
                <label key={amt} data-on={cashChoice === amt ? "" : undefined}>
                  <input
                    type="radio"
                    name="resetCash"
                    checked={cashChoice === amt}
                    onChange={() => setCashChoice(amt)}
                  />
                  <span className="lq-num">{money(amt)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="lq-abtn lq-abtn--ghost"
              onClick={async () => {
                if (!window.confirm(`Reset your paper portfolio to ${money(cashChoice)}? Positions and trade history will be cleared.`)) return;
                const r = await onResetPortfolio(cashChoice);
                setResetNote(r.ok ? { kind: "ok", text: `Reset to ${money(cashChoice)}.` } : { kind: "error", text: r.error ?? "Reset failed." });
              }}
            >
              Reset portfolio
            </button>
            <NoticeLine notice={resetNote} />
          </div>
          {portfolio.resetAt && (
            <p className="m-0 mt-3 text-[12px] text-lq-muted">Last reset {date(portfolio.resetAt)}.</p>
          )}
        </Section>

        {/* Email */}
        <Section icon={Mail} title="Email" lead="This is how you log in. Enter your password to change it.">
          <form onSubmit={saveEmail} className="grid gap-4" noValidate>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailErr.email}
            />
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={emailPw}
              onChange={(e) => setEmailPw(e.target.value)}
              error={emailErr.password}
            />
            <div className="flex items-center gap-4">
              <button type="submit" className="lq-abtn" disabled={email.trim().toLowerCase() === user.email || !emailPw}>
                Change email
              </button>
              <NoticeLine notice={emailNote} />
            </div>
          </form>
        </Section>

        {/* Password and sessions */}
        <Section
          icon={KeyRound}
          title="Password and sign-in"
          lead={`Password last changed ${date(user.passwordChangedAt)}. Changing it signs you out everywhere else.`}
        >
          <form onSubmit={savePassword} className="grid gap-4" noValidate>
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
              error={pwErr.currentPassword}
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              error={pwErr.newPassword}
            />
            {pw.next && <PasswordRules password={pw.next} />}
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              error={pwErr.confirm}
            />
            <div className="flex items-center gap-4">
              <button type="submit" className="lq-abtn" disabled={!pw.current || !pw.next}>
                Change password
              </button>
              <NoticeLine notice={pwNote} />
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-lq-line flex flex-wrap items-center gap-3 justify-between">
            <p className="m-0 text-[13px] text-lq-text-2">
              {sessions === null
                ? "Checking where you're signed in…"
                : sessions <= 1
                  ? "You're only signed in here."
                  : `You're signed in on ${sessions} browsers or devices.`}
            </p>
            <div className="flex gap-2">
              {sessions !== null && sessions > 1 && (
                <button
                  type="button"
                  className="lq-abtn lq-abtn--ghost"
                  onClick={async () => {
                    const r = await signOutOthers();
                    if (r.ok) {
                      setSessions(1);
                      setSessionNote({ kind: "ok", text: `Signed out ${r.endedSessions} other session${r.endedSessions === 1 ? "" : "s"}.` });
                    }
                  }}
                >
                  Sign out other sessions
                </button>
              )}
              <button
                type="button"
                className="lq-abtn lq-abtn--ghost"
                onClick={async () => {
                  await logOut();
                  navigate("/");
                }}
              >
                <LogOut className="w-3.5 h-3.5" /> Log out
              </button>
            </div>
            <NoticeLine notice={sessionNote} />
          </div>
        </Section>
      </div>

      {/* Your data */}
      <Section
        icon={ShieldAlert}
        title="Your data"
        tone="danger"
        lead="Download everything we hold about you, or delete your account. Deleting removes your profile, login, paper portfolio and trade history at once, and can't be undone."
      >
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <a href="/api/account/export" className="lq-abtn lq-abtn--ghost" download>
            <Download className="w-3.5 h-3.5" /> Download my data
          </a>
          <div className="flex-1" />
          {!confirmDelete ? (
            <button
              type="button"
              className="lq-abtn lq-abtn--ghost lq-abtn--danger-ghost"
              onClick={() => setConfirmDelete(true)}
            >
              Delete account
            </button>
          ) : (
            <form
              className="flex flex-col sm:flex-row sm:items-end gap-3 w-full md:w-auto"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await deleteAccount(deletePw);
                if (r.ok) navigate("/", { replace: true });
                else setDeleteErr(r.fields?.password ?? r.error);
              }}
            >
              <div className="sm:w-64">
                <PasswordField
                  label="Enter your password to confirm"
                  autoComplete="current-password"
                  value={deletePw}
                  onChange={(e) => setDeletePw(e.target.value)}
                  error={deleteErr ?? undefined}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button type="button" className="lq-abtn lq-abtn--ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
                <button type="submit" className="lq-abtn lq-abtn--danger" disabled={!deletePw}>
                  Delete forever
                </button>
              </div>
            </form>
          )}
        </div>
      </Section>
    </div>
  );
}
