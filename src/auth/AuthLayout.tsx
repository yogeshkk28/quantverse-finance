import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import "../landing/landing.css";
import "./auth.css";

/** Frame for the sign-up and login pages: logo, a card, and the paper-trading note. */
export default function AuthLayout({
  title,
  eyebrow,
  lead,
  children,
  aside,
}: {
  title: string;
  eyebrow: string;
  lead: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${title} · Lumina Quant`;
  }, [title]);

  return (
    <div className="lq lq-auth">
      <div className="lq-auth__glow" aria-hidden="true" />
      <header className="lq-header">
        <Link to="/" className="lq-logo" aria-label="Lumina Quant home">
          <span className="lq-logo__mark" aria-hidden="true" />
          Lumina
        </Link>
      </header>

      <main className="lq-auth__main">
        <section className="lq-auth__card" aria-labelledby="auth-title">
          <p className="lq-eyebrow">{eyebrow}</p>
          <h1 id="auth-title" className="lq-auth__title">
            {title}
          </h1>
          <p className="lq-auth__lead">{lead}</p>
          {children}
        </section>
        {aside}
        <p className="lq-auth__fine">
          Lumina Quant is a paper-trading simulator. Every balance is virtual and no order reaches a real broker.{" "}
          <Link to="/privacy">Privacy policy</Link>
        </p>
      </main>
    </div>
  );
}
