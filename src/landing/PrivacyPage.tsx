/*
 * DRAFT: written for a paper-trading preview, not reviewed by a lawyer.
 * Have qualified counsel review it before public launch, especially the
 * sections on young traders (COPPA, GDPR Art. 8, India DPDP s.9) and
 * international transfers. Every factual claim below matches the code as of
 * the date in UPDATED (server/accounts.ts, server/auth.ts, server/routes.ts,
 * src/App.tsx, src/auth/SignUpPage.tsx); update
 * this page whenever what we collect or who we send it to changes.
 */
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import "./landing.css";

const UPDATED = "4 November 2026";
// Set these before launch. Lines that use them are hidden while they're empty.
const PRIVACY_EMAIL = "privacy.luminaquant@gmail.com";
const OPERATOR = ""; // legal name and registered address of the entity running Lumina Quant

function Contact({ fallback = "." }: { fallback?: string }) {
  return PRIVACY_EMAIL ? (
    <>
      {" "}
      at <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
    </>
  ) : (
    <>{fallback}</>
  );
}

const SECTIONS = [
  ["practice", "Practice accounts only"],
  ["collect", "What we collect"],
  ["dont", "What we don't do"],
  ["use", "How we use it, and why we're allowed to"],
  ["others", "Who else is involved"],
  ["storage", "Cookies and browser storage"],
  ["young", "Young traders"],
  ["keep", "How long we keep it"],
  ["security", "Security"],
  ["transfers", "Where your data is processed"],
  ["rights", "Your rights"],
  ["changes", "Changes"],
  ["contact", "Contact"],
] as const;

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
          Lumina Quant is a paper-trading simulator for people learning how markets work. You trade with virtual
          money, nothing you do here touches a real brokerage, and we collect only what a practice account needs:
          the details you give when you sign up, your paper portfolio, and nothing that tracks you around the web.
        </p>
        <p>
          This policy explains what we collect, why, who else sees it, and what you can do about it. It covers the
          Lumina Quant website and the trading terminal you reach after logging in
          {OPERATOR ? <>, which are run by {OPERATOR} (&ldquo;we&rdquo;, &ldquo;us&rdquo;).</> : "."}
        </p>

        <nav className="lq-legal__toc" aria-label="On this page">
          <ol>
            {SECTIONS.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <h2 id="practice">Practice accounts only</h2>
        <div className="lq-legal__callout">
          <p>
            <strong>Every account on Lumina Quant is a practice account.</strong> The balance is virtual, orders are
            simulated, and no real money, securities or brokerage account is ever involved. You cannot deposit,
            withdraw, or win anything.
          </p>
        </div>
        <ul>
          <li>
            <strong>It's for learning, not advice.</strong> Nothing on Lumina Quant (screeners, signals, the
            Correlation Web, sentiment gauges or AI notes) is a recommendation to buy, sell or hold any security. We
            are not a broker, investment adviser or research analyst, and we are not registered as one with SEBI, the
            SEC, the FCA or any other regulator.
          </li>
          <li>
            <strong>AI notes are machine-written.</strong> They are generated automatically from a ticker's public
            numbers, can be wrong or out of date, and may sound more confident than they should. Treat them as a
            prompt for your own thinking.
          </li>
          <li>
            <strong>Simulated results aren't real results.</strong> Paper fills ignore slippage, liquidity, fees,
            taxes and the emotional weight of real money. Market data may be delayed, incomplete or substituted with
            sample data when a provider is unavailable. Doing well here does not mean you would do well with real
            money.
          </li>
          <li>
            Before you trade for real, learn the rules where you live, use a regulated broker, and consider speaking
            to a qualified, registered financial adviser.
          </li>
        </ul>

        <h2 id="collect">What we collect</h2>
        <ul>
          <li>
            <strong>Your account details</strong>, which you enter when you create an account: your full name, email
            address, date of birth, country (India, the United States or elsewhere), trading experience, the market you
            mainly want to trade, and the starting virtual balance you pick. If you're 13 to 17, we also record that
            you confirmed a parent or guardian agreed. We store when the account was created and last changed. We
            don't verify your email or send you email.
          </li>
          <li>
            <strong>Your password, as a one-way hash only.</strong> We run it through scrypt with a random salt and keep
            the result. Nobody, including us, can read your password back from what we store.
          </li>
          <li>
            <strong>Session cookie</strong> (<code>lq_sid</code>), a random code that keeps you logged in for up to 30
            days. We store only a fingerprint (SHA-256) of it, with the time it was created and when it expires. It
            can't be read by scripts on the page and isn't shared with anyone.
          </li>
          <li>
            <strong>Your paper portfolio</strong>, saved to your account on our server: virtual cash, open positions,
            your last 500 paper trades (ticker, buy or sell, quantity, price, time), and one value per day for your
            equity curve. It's there so it follows you when you log in from another browser.
          </li>
          <li>
            <strong>Your IP address and login email, briefly.</strong> To slow down password guessing we count sign-up
            and login attempts per IP address for one minute, and wrong passwords per email for 15 minutes. These
            counts are held in memory only and are never written to disk by us.
          </li>
          <li>
            <strong>What you ask the AI about.</strong> When you request an AI note, the ticker and the chart settings
            you have open (timeframe, overlays, indicators) are sent from our server to the AI provider, together with
            that ticker's public market numbers. Your name, email, age and portfolio are not included.
          </li>
        </ul>

        <h2 id="dont">What we don't do</h2>
        <ul>
          <li>
            No plain-text passwords, payment details, bank or brokerage details, phone numbers, addresses or identity
            documents.
          </li>
          <li>No advertising, analytics, fingerprinting or tracking cookies, and no tracking across other sites.</li>
          <li>
            No profiling, behavioural monitoring or targeted advertising, for anyone and particularly not for young
            users.
          </li>
          <li>We don't sell, rent or share your account details, and we don't send marketing email.</li>
          <li>We don't use your data to train AI models.</li>
        </ul>

        <h2 id="use">How we use it, and why we're allowed to</h2>
        <ul>
          <li>
            <strong>To create your account and keep you logged in</strong> (email, password hash, session cookie). This
            is necessary to provide the service you asked for. Under the EU and UK GDPR, the legal basis is performance
            of a contract (Article 6(1)(b)); under India's Digital Personal Data Protection Act 2023 (DPDP Act), it is
            your consent, given when you create your account.
          </li>
          <li>
            <strong>To check you're old enough</strong> (date of birth, guardian confirmation). We refuse sign-ups from
            anyone under 13 and ask 13 to 17 year olds to confirm a parent or guardian agreed. See{" "}
            <a href="#young">Young traders</a>. Same legal bases as above, plus our legal obligations towards children
            (GDPR Article 6(1)(c), DPDP Act section 9).
          </li>
          <li>
            <strong>To run your profile and paper account</strong> (name, country, experience, main market, starting
            balance, portfolio). We use your first name to greet you, show these details on your account page, and
            keep your paper trades. They aren't used for anything else, and never to profile you or show you ads.
          </li>
          <li>
            <strong>To protect the service from abuse</strong> (the short-lived attempt counts). The legal basis is our
            legitimate interest in keeping accounts safe (GDPR Article 6(1)(f)), and under the DPDP Act it is a
            reasonable step to safeguard the service.
          </li>
          <li>
            <strong>To answer you</strong> if you contact us about your data. We use what you send only for that.
          </li>
        </ul>
        <p>
          You can withdraw consent at any time by deleting your data (see <a href="#rights">Your rights</a>).
          Withdrawing doesn't affect anything we did lawfully before you withdrew.
        </p>

        <h2 id="others">Who else is involved</h2>
        <ul>
          <li>
            <strong>Market data providers</strong>: Yahoo Finance, Finnhub, Financial Modeling Prep, Alpha Vantage,
            FRED (Federal Reserve Bank of St. Louis), NewsData.io and Alternative.me. Our server requests data on your
            behalf, so these providers see our server, not you, and receive only ticker symbols or general queries.
          </li>
          <li>
            <strong>Google (Gemini API)</strong> receives the AI-note request described above. Google processes it
            under its own API terms. Your account details are never sent.
          </li>
          <li>
            <strong>Our hosting provider</strong>, once the site is publicly hosted, may keep standard server access
            logs (IP address, time, page requested) for security and operations.
          </li>
          <li>
            <strong>Authorities</strong>, only if the law requires it, for example a valid court order.
          </li>
        </ul>
        <p>None of these parties receives your name, email, date of birth or portfolio from us.</p>

        <h2 id="storage">Cookies and browser storage</h2>
        <p>
          We use exactly one cookie, <code>lq_sid</code>, which is strictly necessary to keep you logged in, so it
          doesn't need a cookie banner. There are no third-party cookies.
        </p>
        <p>
          A few conveniences are kept in your browser's local storage and never reach our server: your dashboard and
          screener watchlists (<code>lumina_quant_watchlist</code>, <code>lumina_screener_watchlist</code>), saved
          screener filters (<code>lumina_screener_saved</code>) and trade ideas you jot down (
          <code>lumina_quant_ideas</code>). They stay on that device and aren't tied to your account. Clearing your
          browser's site data removes them and logs you out. Your paper portfolio is no longer kept in the browser; it
          is saved to your account.
        </p>

        <h2 id="young">Young traders</h2>
        <p>
          Lumina Quant is built for people learning to trade, including students. Because some of them are young, we
          apply these rules:
        </p>
        <ul>
          <li>
            <strong>Under 13: you can't sign up.</strong> Sign-up asks for your date of birth and refuses anyone under
            13. Lumina Quant isn't directed at children under 13, and we don't knowingly collect their personal
            information, consistent with the US Children's Online Privacy Protection Act (COPPA).
          </li>
          <li>
            <strong>Under 18, or under the age of digital consent where you live</strong> (13 to 16 in EU and UK
            countries, 18 in India): sign up only with a parent's or guardian's permission. If you're 13 to 17, sign-up
            asks you to confirm they agreed before your account is created. Under the DPDP Act, anyone under 18 is a
            child and needs a parent's or guardian's consent before their data is processed.
          </li>
          <li>
            We never track, behaviourally monitor or target advertising at young users. We don't do it for anyone.
          </li>
          <li>
            Trading real securities generally requires you to be an adult. Lumina Quant is a safe place to practise
            until then, and it never connects to a real account.
          </li>
        </ul>
        <p>
          If you're a parent or guardian and believe your child created an account without your permission, contact us
          <Contact fallback=" (see Contact below), or log in to that account and use Delete account on the account page." />{" "}
          We will delete it promptly.
        </p>

        <h2 id="keep">How long we keep it</h2>
        <ul>
          <li>
            Your account details and paper portfolio stay until you delete your account, or until we close the
            preview, whichever comes first.
          </li>
          <li>Trade history keeps your latest 500 trades; older ones are dropped. Resetting your portfolio clears it.</li>
          <li>Sessions expire after 30 days, or straight away when you log out or change your password.</li>
          <li>Attempt counts used to slow down password guessing are discarded after one to 15 minutes.</li>
        </ul>

        <h2 id="security">Security</h2>
        <p>
          Passwords are hashed with scrypt and a per-user random salt, and are never stored or logged in plain text.
          Session codes are long random values; we keep only their SHA-256 fingerprint, so a copy of our data can't be
          used to log in as you. The cookie can't be read by page scripts and, in production, is only sent over HTTPS.
          Login and sign-up attempts are rate limited, and changing your password signs out every other session. We
          hold no payment or brokerage details. If a breach affecting your personal data does happen, we will notify
          the relevant authorities and affected users as the law requires, including the Data Protection Board of India
          and, within 72 hours where GDPR applies, the competent supervisory authority.
        </p>

        <h2 id="transfers">Where your data is processed</h2>
        <p>
          Our server and the providers listed above may operate in countries other than yours, including India, the
          United States and the European Union. Where EU or UK data is transferred to a country without an adequacy
          decision, we rely on appropriate safeguards such as Standard Contractual Clauses. We won't transfer data to
          any country the Government of India restricts under the DPDP Act.
        </p>

        <h2 id="rights">Your rights</h2>
        <p>Wherever you live, you can:</p>
        <ul>
          <li>
            <strong>Delete your account yourself.</strong> Logged in, open your profile icon, choose{" "}
            <strong>Profile and account</strong>, then <strong>Delete account</strong>. That removes your profile,
            password hash, paper portfolio and trade history, and ends every session at once.
          </li>
          <li>
            <strong>See, correct and take a copy of your data yourself.</strong> The account page shows and lets you edit
            your profile and email, and <strong>Download my data</strong> gives you everything we hold about you as a
            JSON file. You can also ask us to do any of this.
          </li>
          <li>
            <strong>Withdraw consent or object</strong> to any processing, at any time.
          </li>
        </ul>
        <p>Depending on where you live, the law gives you further rights:</p>
        <ul>
          <li>
            <strong>EU and UK (GDPR)</strong>: access, rectification, erasure, restriction, portability and objection,
            and the right to complain to your local data protection authority.
          </li>
          <li>
            <strong>India (DPDP Act)</strong>: access to a summary of your data and who it was shared with,
            correction and erasure, grievance redressal, and nominating someone to exercise your rights if you die or
            become incapacitated. If we don't resolve a grievance, you can complain to the Data Protection Board of
            India.
          </li>
          <li>
            <strong>California and other US states</strong>: the right to know, delete and correct. We don't sell or
            share personal information for cross-context behavioural advertising, so there is nothing to opt out of.
          </li>
        </ul>
        <p>
          We answer requests within 30 days, won't charge you, and won't treat you differently for using your rights.
          We may ask you to log in, or otherwise confirm the account is yours, before acting on a request.
        </p>

        <h2 id="changes">Changes</h2>
        <p>
          When this policy changes, the date at the top changes with it. Material changes will be shown before you log
          in, and where the law requires it we will ask for your consent again.
        </p>

        <h2 id="contact">Contact</h2>
        <p>
          {PRIVACY_EMAIL ? (
            <>
              For privacy questions, requests and grievances, contact us
              <Contact />
            </>
          ) : (
            <>
              A dedicated privacy inbox will be published here before public launch. Until then, you can delete
              everything we hold yourself with <strong>Delete account</strong> on the terminal's account page.
            </>
          )}
          {OPERATOR && <> Lumina Quant is operated by {OPERATOR}.</>}
        </p>

        <p className="lq-legal__back">
          <Link to="/">← Back to Lumina</Link>
        </p>
      </main>
    </div>
  );
}
