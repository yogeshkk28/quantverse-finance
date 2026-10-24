import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import "./landing.css";

const UPDATED = "23 October 2026";
// Set this to a monitored inbox before launch; the contact line is hidden while it's empty.
const CONTACT_EMAIL = "";

export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Privacy · Lumina Quant";
  }, []);

  return (
    <div className="lq lq-legal">
      <header className="lq-header">
        <Link to="/" className="lq-logo" aria-label="Lumina Quant home">
          <span className="lq-logo__mark" aria-hidden="true" />
          Lumina
        </Link>
      </header>

      <main className="lq-legal__body">
        <p className="lq-eyebrow">Last updated {UPDATED}</p>
        <h1>Privacy policy</h1>
        <p className="lq-legal__lead">
          Lumina Quant is an early preview. We collect as little as we can: one email address, and nothing that
          tracks you around the web.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your email address</strong>, when you enter it at the gate. It's the only thing we store about
            you, along with the date you joined.
          </li>
          <li>
            <strong>One session cookie</strong> (<code>lq_sid</code>) that keeps you signed in for up to 30 days. It
            can't be read by scripts and isn't shared with anyone.
          </li>
          <li>
            <strong>Your IP address, briefly.</strong> We hold it in memory for one minute to limit repeated sign-up
            attempts. It isn't written to disk.
          </li>
          <li>
            <strong>Your paper portfolio</strong> stays in your own browser (local storage). It never reaches our
            server.
          </li>
        </ul>

        <h2>What we don't do</h2>
        <ul>
          <li>No passwords, payment details or identity documents.</li>
          <li>No advertising, analytics or tracking cookies.</li>
          <li>We don't sell, rent or share your email. We don't send marketing email.</li>
        </ul>

        <h2>Who else is involved</h2>
        <p>
          Market data comes from Yahoo Finance, Finnhub, Financial Modeling Prep and FRED. Our server requests that
          data on your behalf, so those providers see our server, not you, and receive only ticker symbols. When you
          ask for an AI note, the ticker's name, price and daily change are sent to Google's Gemini API. Your email is
          never sent to any of them. Our hosting provider may keep standard access logs.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Your email stays until you delete it. Sessions expire after 30 days, or straight away when you sign out.
        </p>

        <h2>Your choices</h2>
        <p>
          Signed in, open the account menu in the terminal and choose <strong>Delete my data</strong>. That removes
          your email and ends every session at once. You can also see or correct what we hold by asking us
          {CONTACT_EMAIL ? (
            <>
              {" "}
              at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </>
          ) : (
            "."
          )}
        </p>

        <h2>Changes</h2>
        <p>
          When this policy changes, the date at the top changes with it. Material changes will be shown at the gate
          before you sign in.
        </p>

        <p className="lq-legal__back">
          <Link to="/">← Back to Lumina</Link>
        </p>
      </main>
    </div>
  );
}
