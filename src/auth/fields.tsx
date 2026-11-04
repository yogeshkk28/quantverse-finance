import React, { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Labelled input with an inline error, shared by the sign-up, login and account forms. */
export function Field({
  label,
  error,
  hint,
  children,
  id,
}: {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="lq-field" data-invalid={error ? "" : undefined}>
      <label htmlFor={id} className="lq-field__label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="lq-field__error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="lq-field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: React.ReactNode };

export function TextField({ label, error, hint, id, ...rest }: InputProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} id={fid}>
      <input
        id={fid}
        className="lq-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        {...rest}
      />
    </Field>
  );
}

export function PasswordField({ label, error, hint, id, ...rest }: InputProps) {
  const auto = useId();
  const fid = id ?? auto;
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} id={fid}>
      <div className="lq-field__pw">
        <input
          id={fid}
          type={shown ? "text" : "password"}
          className="lq-field__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
          {...rest}
        />
        <button
          type="button"
          className="lq-field__reveal"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
        >
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </Field>
  );
}

export function SelectField({
  label,
  error,
  hint,
  id,
  options,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  options: Array<[string, string]>;
}) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} id={fid}>
      <select
        id={fid}
        className="lq-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        {...rest}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value} disabled={value === ""}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Live checklist under the new-password field. Mirrors checkPassword in server/accounts.ts. */
export function PasswordRules({ password }: { password: string }) {
  const rules: Array<[boolean, string]> = [
    [password.length >= 8, "8 or more characters"],
    [/[A-Za-z]/.test(password), "A letter"],
    [/\d/.test(password), "A number"],
  ];
  return (
    <ul className="lq-pwrules" aria-label="Password requirements">
      {rules.map(([met, text]) => (
        <li key={text} data-met={met ? "" : undefined}>
          <span aria-hidden="true">{met ? "✓" : "·"}</span> {text}
          <span className="sr-only">{met ? " (done)" : " (needed)"}</span>
        </li>
      ))}
    </ul>
  );
}

export function ageFrom(dateOfBirth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
