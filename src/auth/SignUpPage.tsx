import React, { FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  COUNTRY_LABEL,
  EXPERIENCE_LABEL,
  MARKET_LABEL,
  STARTING_CASH,
  SignUpInput,
  useAuth,
} from "../context/AuthContext";
import AuthLayout from "./AuthLayout";
import { PasswordField, PasswordRules, SelectField, TextField, ageFrom, money } from "./fields";

type Errors = Record<string, string>;

// Fields on each step, so a server error sends the user back to the right one.
const STEP_FIELDS: Array<string[]> = [
  ["fullName", "email", "password", "confirm"],
  ["dateOfBirth", "guardianConsent", "country", "experience", "preferredMarket", "startingCash", "acceptTerms"],
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Two-step account creation.
 * Step 1: who you are and how you sign in. Step 2: profile and paper account.
 */
export default function SignUpPage() {
  const { user, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state as { from?: string } | null)?.from || "/app/dashboard";
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [form, setForm] = useState<SignUpInput>({
    fullName: "",
    email: "",
    password: "",
    dateOfBirth: "",
    country: "" as SignUpInput["country"],
    experience: "" as SignUpInput["experience"],
    preferredMarket: "" as SignUpInput["preferredMarket"],
    startingCash: 100_000,
    guardianConsent: false,
    acceptTerms: false,
  });
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  if (user && !busy) return <Navigate to={next} replace />;

  const set = <K extends keyof SignUpInput>(key: K, value: SignUpInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };
  const age = ageFrom(form.dateOfBirth);
  const minor = age !== null && age >= 13 && age < 18;

  function checkStep(n: number): Errors {
    const e: Errors = {};
    if (n === 0) {
      if (form.fullName.trim().length < 2) e.fullName = "Enter your full name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = "Enter a valid email address.";
      if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
        e.password = "Use 8 or more characters with at least one letter and one number.";
      }
      if (confirm !== form.password) e.confirm = "The passwords don't match.";
    } else {
      if (age === null) e.dateOfBirth = "Enter your date of birth.";
      else if (age < 13) e.dateOfBirth = "You need to be at least 13 to create an account.";
      else if (minor && !form.guardianConsent) e.guardianConsent = "Ask a parent or guardian, then tick this box.";
      if (!form.country) e.country = "Choose where you live.";
      if (!form.experience) e.experience = "Choose your trading experience.";
      if (!form.preferredMarket) e.preferredMarket = "Choose the market you'll trade most.";
      if (!form.acceptTerms) e.acceptTerms = "Please confirm to continue.";
    }
    return e;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const e = checkStep(step);
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`su-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    if (step === 0) {
      setStep(1);
      return;
    }
    setBusy(true);
    const r = await signUp({ ...form, fullName: form.fullName.trim(), email: form.email.trim() });
    if (!r.ok) {
      setBusy(false);
      setFormError(r.error);
      setErrors(r.fields ?? {});
      const first = Object.keys(r.fields ?? {})[0];
      if (first && STEP_FIELDS[0].includes(first)) setStep(0);
      return;
    }
    navigate(next, { replace: true, state: { via: "wormhole" } });
  }

  return (
    <AuthLayout
      eyebrow={`Create account · Step ${step + 1} of 2`}
      title={step === 0 ? "Open your paper account" : "Tell us about you"}
      lead={
        step === 0
          ? "Practise trading US and Indian markets with virtual money. It takes about a minute."
          : "This sets up your profile and your starting balance. You can change it later from your account."
      }
    >
      <ol className="lq-steps" aria-label="Progress">
        {["Account", "Profile"].map((s, i) => (
          <li key={s} data-on={i <= step ? "" : undefined} aria-current={i === step ? "step" : undefined}>
            {s}
          </li>
        ))}
      </ol>

      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Step {step + 1}: {step === 0 ? "Account" : "Profile"}
      </h2>

      <form className="lq-auth__form" onSubmit={onSubmit} noValidate>
        {step === 0 ? (
          <>
            <TextField
              id="su-fullName"
              label="Full name"
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              error={errors.fullName}
              maxLength={80}
            />
            <TextField
              id="su-email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              error={errors.email}
              hint="You'll use this to log in. We never email you."
            />
            <PasswordField
              id="su-password"
              label="Password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              error={errors.password}
            />
            <PasswordRules password={form.password} />
            <PasswordField
              id="su-confirm"
              label="Confirm password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (errors.confirm) setErrors(({ confirm: _, ...rest }) => rest);
              }}
              error={errors.confirm}
            />
          </>
        ) : (
          <>
            <TextField
              id="su-dateOfBirth"
              label="Date of birth"
              type="date"
              autoComplete="bday"
              max={today()}
              min="1900-01-01"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              error={errors.dateOfBirth}
              hint={age !== null && age >= 0 ? `You're ${age}.` : "You need to be 13 or older."}
            />
            {minor && (
              <label className="lq-check" data-invalid={errors.guardianConsent ? "" : undefined}>
                <input
                  id="su-guardianConsent"
                  type="checkbox"
                  checked={form.guardianConsent}
                  onChange={(e) => set("guardianConsent", e.target.checked)}
                  aria-describedby={errors.guardianConsent ? "su-guardianConsent-err" : undefined}
                />
                <span>
                  A parent or guardian has agreed to me creating this account.
                  {errors.guardianConsent && (
                    <span id="su-guardianConsent-err" className="lq-field__error" role="alert">
                      {errors.guardianConsent}
                    </span>
                  )}
                </span>
              </label>
            )}
            <div className="lq-auth__row">
              <SelectField
                id="su-country"
                label="Country"
                autoComplete="country"
                value={form.country}
                onChange={(e) => set("country", e.target.value as SignUpInput["country"])}
                error={errors.country}
                options={[["", "Choose…"], ...(Object.entries(COUNTRY_LABEL) as Array<[string, string]>)]}
              />
              <SelectField
                id="su-preferredMarket"
                label="Main market"
                value={form.preferredMarket}
                onChange={(e) => set("preferredMarket", e.target.value as SignUpInput["preferredMarket"])}
                error={errors.preferredMarket}
                options={[["", "Choose…"], ...(Object.entries(MARKET_LABEL) as Array<[string, string]>)]}
              />
            </div>
            <SelectField
              id="su-experience"
              label="Trading experience"
              value={form.experience}
              onChange={(e) => set("experience", e.target.value as SignUpInput["experience"])}
              error={errors.experience}
              options={[["", "Choose…"], ...(Object.entries(EXPERIENCE_LABEL) as Array<[string, string]>)]}
            />

            <fieldset className="lq-choice">
              <legend className="lq-field__label">Starting virtual balance</legend>
              <div className="lq-choice__opts">
                {STARTING_CASH.map((amt) => (
                  <label key={amt} data-on={form.startingCash === amt ? "" : undefined}>
                    <input
                      type="radio"
                      name="startingCash"
                      value={amt}
                      checked={form.startingCash === amt}
                      onChange={() => set("startingCash", amt)}
                    />
                    <span className="lq-num">{money(amt)}</span>
                  </label>
                ))}
              </div>
              <p className="lq-field__hint">Virtual money only. Resetting your portfolio returns you to this amount.</p>
            </fieldset>

            <label className="lq-check" data-invalid={errors.acceptTerms ? "" : undefined}>
              <input
                id="su-acceptTerms"
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(e) => set("acceptTerms", e.target.checked)}
                aria-describedby={errors.acceptTerms ? "su-acceptTerms-err" : undefined}
              />
              <span>
                I've read the{" "}
                <Link to="/privacy" target="_blank" rel="noopener">
                  privacy policy
                </Link>{" "}
                and understand this is a simulator: nothing here is financial advice and no real money is involved.
                {errors.acceptTerms && (
                  <span id="su-acceptTerms-err" className="lq-field__error" role="alert">
                    {errors.acceptTerms}
                  </span>
                )}
              </span>
            </label>
          </>
        )}

        <p className="lq-form__msg" data-kind="error" role="status" aria-live="polite">
          {formError && Object.keys(errors).length === 0 ? formError : ""}
        </p>

        <div className="lq-auth__actions">
          {step === 1 && (
            <button type="button" className="lq-auth__back" onClick={() => setStep(0)} disabled={busy}>
              ← Back
            </button>
          )}
          <button type="submit" className="lq-btn lq-btn--gold lq-auth__submit" disabled={busy}>
            {step === 0 ? "Continue" : busy ? "Creating account…" : "Create account"}
            <span className="lq-btn__arrow" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </form>

      <p className="lq-auth__switch">
        Already have an account?{" "}
        <Link to="/login" state={location.state}>
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
