import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { useAuth } from "../context/AuthContext";
import CanvasLayer from "./CanvasLayer";
import { ribbons } from "./canvas/ribbons";
import { asciiMosaic } from "./canvas/asciiMosaic";
import { network } from "./canvas/network";
import WormholeGate from "./sections/WormholeGate";
import MarketHours from "./sections/MarketHours";
import { useReducedMotion, heatmapTiles } from "./hooks";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const BELIEFS = [
  { href: "#information", label: "Everything is a price" },
  { href: "#connected", label: "Markets are connected" },
  { href: "#volatility", label: "Volatility is information" },
  { href: "#breadth", label: "Breadth is edge" },
];

const SLICES = 12;

export default function LandingPage() {
  const reduced = useReducedMotion();
  const { user, leave } = useAuth();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const heroProgress = useRef(0);
  const asciiReveal = useRef(reduced ? 1 : 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState("hero");
  const [glyph, setGlyph] = useState("L");
  const [activeBelief, setActiveBelief] = useState<string | null>(null);
  const [cueHidden, setCueHidden] = useState(false);
  const tiles = useMemo(() => heatmapTiles(), []);

  // Smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in sync.
  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ duration: 1.1, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [reduced]);

  // Arriving from a protected page lands on the gate.
  useEffect(() => {
    if (location.hash !== "#gate") return;
    const id = window.setTimeout(() => {
      ScrollTrigger.refresh();
      document.getElementById("gate")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    }, 150);
    return () => window.clearTimeout(id);
  }, [location.hash, reduced]);

  // Floating marker: colour and glyph follow the section in view.
  useEffect(() => {
    const sections = rootRef.current?.querySelectorAll<HTMLElement>("[data-section-theme]") ?? [];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          setTheme(el.dataset.sectionTheme || "dark");
          setGlyph(el.dataset.glyph || "L");
          setActiveBelief(BELIEFS.some((b) => b.href === `#${el.id}`) ? `#${el.id}` : null);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  useGSAP(
    () => {
      // Scroll cue fades after the first 80px
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: () => setCueHidden(window.scrollY > 80),
      });

      if (reduced) return;

      // Hero words rise out of their clip masks
      gsap.from(".lq-hero__word", { yPercent: 110, duration: 1.2, ease: "expo.out", stagger: 0.12, delay: 0.15 });
      gsap.from(".lq-hero__sub, .lq-hero .lq-canvas", { opacity: 0, duration: 1.4, delay: 0.5, ease: "power2.out" });
      ScrollTrigger.create({
        trigger: "#hero",
        start: "top top",
        end: "bottom top",
        onUpdate: (st) => (heroProgress.current = st.progress),
      });

      // ASCII price mosaic builds up from the bottom as the section scrolls in
      ScrollTrigger.create({
        trigger: "#information",
        start: "top bottom",
        end: "center center",
        scrub: true,
        onUpdate: (st) => (asciiReveal.current = st.progress),
      });

      // Pinned headline swap. Scrubbed, so scrolling back reverses it.
      gsap
        .timeline({
          scrollTrigger: { trigger: "#connected", start: "top top", end: "+=120%", pin: true, scrub: true },
        })
        .to(".lq-swap__a", { yPercent: -40, opacity: 0, ease: "power2.in" }, 0.35)
        .fromTo(".lq-swap__b", { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, ease: "power2.out" }, 0.5)
        .to({}, { duration: 0.3 }); // hold the second phrase before unpinning

      // Warped text stack settles flat. Phones get a lighter skew-only version.
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        gsap.fromTo(
          ".lq-warp li",
          { rotateY: -18, skewY: -8, xPercent: (i) => 6 + i * 3, opacity: 0.35 },
          {
            rotateY: 0,
            skewY: 0,
            xPercent: 0,
            opacity: 1,
            stagger: 0.12,
            ease: "none",
            scrollTrigger: { trigger: "#volatility", start: "top 75%", end: "center 45%", scrub: true },
          }
        );
      });
      mm.add("(max-width: 767px)", () => {
        gsap.fromTo(
          ".lq-warp li",
          { skewY: -5, opacity: 0.4 },
          { skewY: 0, opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: { trigger: "#volatility", start: "top 80%", end: "center 50%", scrub: true } }
        );
      });

      // Striped heatmap assembles, then slides away and leaves black
      gsap.fromTo(
        ".lq-stripes__slice",
        { yPercent: (i) => (i % 2 ? 100 : -100) },
        {
          yPercent: 0,
          stagger: 0.03,
          ease: "none",
          scrollTrigger: { trigger: "#breadth", start: "top bottom", end: "top 20%", scrub: true },
        }
      );
      gsap.to(".lq-stripes__slice", {
        yPercent: (i) => (i % 2 ? -100 : 100),
        stagger: 0.03,
        ease: "none",
        immediateRender: false,
        scrollTrigger: { trigger: "#breadth", start: "bottom 90%", end: "bottom top", scrub: true },
      });

    },
    { scope: rootRef, dependencies: [reduced] }
  );

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="lq" ref={rootRef} data-theme={theme}>
      <a className="lq-skip" href="#main">
        Skip to content
      </a>

      <header className="lq-header">
        <Link to="/" className="lq-logo" aria-label="Lumina Quant home">
          <span className="lq-logo__mark" aria-hidden="true" />
          Lumina
        </Link>
        <div className="lq-header__right">
          {user ? (
            <Link to="/app/dashboard" className="lq-header__cta">
              Open terminal
            </Link>
          ) : (
            <a href="#gate" className="lq-header__cta">
              Get access
            </a>
          )}
          <button
            type="button"
            className="lq-marker"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="lq-menu"
            onClick={() => setMenuOpen(true)}
          >
            {glyph}
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav id="lq-menu" className="lq-menu" aria-label="Site">
          <button type="button" className="lq-menu__close" onClick={closeMenu} autoFocus>
            Close
          </button>
          {BELIEFS.map((b) => (
            <a key={b.href} href={b.href} onClick={closeMenu}>
              {b.label}
            </a>
          ))}
          <a href="#gate" onClick={closeMenu}>
            Enter the Wormhole
          </a>
          {user && (
            <>
              <Link to="/app/dashboard">Open terminal</Link>
              <button type="button" onClick={() => leave().then(closeMenu)}>
                Sign out
              </button>
            </>
          )}
        </nav>
      )}

      <main id="main">
        {/* Hero */}
        <section id="hero" className="lq-section lq-hero" data-section-theme="hero" data-glyph="L" aria-labelledby="hero-title">
          <CanvasLayer start={(c) => ribbons(c, { animate: !reduced, getProgress: () => heroProgress.current })} />
          <h1 id="hero-title" className="lq-hero__title">
            <span className="lq-hero__line">
              <span className="lq-hero__word">Signal</span>
            </span>
            <span className="lq-hero__line">
              <span className="lq-hero__word">over noise.</span>
            </span>
          </h1>
          <p className="lq-hero__sub">
            A research terminal for US and Indian stocks: screeners, live sentiment and a map of how companies move
            together.
          </p>
          <span className="lq-scroll-cue" data-hidden={cueHidden} aria-hidden="true">
            Scroll
          </span>
        </section>

        {/* Statement 1 */}
        <section id="information" className="lq-section" data-section-theme="dark" data-glyph="P" aria-labelledby="information-title">
          <CanvasLayer start={(c) => asciiMosaic(c, { animate: !reduced, getReveal: () => asciiReveal.current })} />
          <h2 id="information-title" className="lq-statement">
            Everything is a price.
          </h2>
          <p className="lq-body">
            Earnings, rate decisions, a supplier cutting guidance. Sooner or later each one shows up on a chart. Lumina
            reads those charts for you.
          </p>
        </section>

        {/* Statement 2: pinned headline swap */}
        <section id="connected" className="lq-section" data-section-theme="dark" data-glyph="C" aria-labelledby="connected-title">
          <CanvasLayer start={(c) => network(c, { animate: !reduced })} />
          {reduced ? (
            <h2 id="connected-title" className="lq-statement">
              Markets are connected. Connections are opportunity.
            </h2>
          ) : (
            <h2 id="connected-title" className="lq-statement lq-swap">
              <span className="lq-swap__a">Markets are connected.</span>
              <span className="lq-swap__b" aria-hidden="true">
                Connections are opportunity.
              </span>
            </h2>
          )}
          <p className="lq-body">
            The Correlation Web shows which stocks move together, measured from real daily returns in both markets.
          </p>
        </section>

        {/* Statement 3: warped text stack */}
        <section id="volatility" className="lq-section" data-section-theme="dark" data-glyph="V" aria-labelledby="volatility-title">
          <h2 id="volatility-title" className="sr-only">
            Volatility is information.
          </h2>
          <ul className="lq-warp" aria-hidden="true">
            <li>Volatility isn't meant to be feared.</li>
            <li>Volatility is constant.</li>
            <li>Volatility is measurable.</li>
            <li>Volatility is sentiment.</li>
            <li>Volatility is information.</li>
          </ul>
          <p className="lq-body">
            Lumina's Fear &amp; Greed index ranks six market signals, from the VIX to junk-bond spreads, against a year
            of history. You get one number, and every input behind it.
          </p>
        </section>

        {/* Statement 4: striped heatmap reveal */}
        <section id="breadth" className="lq-section" data-section-theme="dark" data-glyph="B" aria-labelledby="breadth-title">
          <div className="lq-stripes" style={{ "--slices": SLICES, "--tiles": tiles } as React.CSSProperties} aria-hidden="true">
            {Array.from({ length: SLICES }, (_, i) => (
              <div key={i} className="lq-stripes__slice" style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
          <h2 id="breadth-title" className="lq-statement">
            Breadth is edge.
          </h2>
          <ul className="lq-breadth__list">
            <li>Screens</li>
            <li>Signals</li>
            <li>Strategies</li>
          </ul>
        </section>

        <WormholeGate reduced={reduced} />

        <MarketHours />

        {/* Beliefs banner */}
        <nav className="lq-beliefs" aria-label="Our core beliefs">
          <span className="lq-beliefs__label">
            Our core beliefs <span className="lq-beliefs__arrow" aria-hidden="true" />
          </span>
          {BELIEFS.map((b) => (
            <a key={b.href} href={b.href} aria-current={activeBelief === b.href ? "true" : undefined}>
              {b.label}
            </a>
          ))}
        </nav>

        {/* Light breather */}
        <section id="beyond" className="lq-section lq-light" data-section-theme="light" data-glyph="+" aria-labelledby="beyond-title">
          <div>
            <h2 id="beyond-title">Beyond the dashboard.</h2>
            <p>
              Lumina started as a screener. It's becoming a research desk: one place to see what moved, why it moved,
              and what tends to move with it.
            </p>
            <small>
              Lumina Quant is a research tool, not investment advice. Prices may be delayed; NSE data comes from public
              delayed feeds. Past relationships between stocks don't guarantee future ones.
            </small>
          </div>
          <ul className="lq-features">
            <li>
              <span className="lq-features__k">01</span>
              <div>
                <h3>Screener</h3>
                <p>Filter US and NSE stocks by P/E, RSI, MACD crosses and volume surges.</p>
              </div>
            </li>
            <li>
              <span className="lq-features__k">02</span>
              <div>
                <h3>Charts and AI notes</h3>
                <p>Candles with RSI and MACD, plus a short Gemini read on any ticker.</p>
              </div>
            </li>
            <li>
              <span className="lq-features__k">03</span>
              <div>
                <h3>Fear &amp; Greed</h3>
                <p>A sentiment score for each market, with every input visible.</p>
              </div>
            </li>
            <li>
              <span className="lq-features__k">04</span>
              <div>
                <h3>Correlation Web</h3>
                <p>A live map of which stocks move together, by market and time window.</p>
              </div>
            </li>
          </ul>
        </section>
      </main>

      {/* Closing CTA + footer */}
      <footer className="lq-footer" data-section-theme="light" data-glyph="J">
        <div className="lq-footer__cta">
          {user ? (
            <Link to="/app/dashboard" className="lq-glass">
              Open terminal
            </Link>
          ) : (
            <a href="#gate" className="lq-glass">
              Join us
            </a>
          )}
        </div>
        <div className="lq-footer__base">
          <span className="lq-logo">
            <span className="lq-logo__mark" aria-hidden="true" />
            Lumina
          </span>
          <nav aria-label="Terminal">
            <h3>Terminal</h3>
            <ul>
              <li><Link to="/app/dashboard">Dashboard</Link></li>
              <li><Link to="/app/screener">Screener</Link></li>
              <li><Link to="/app/signals">Correlation Web</Link></li>
            </ul>
          </nav>
          <nav aria-label="Explore">
            <h3>Explore</h3>
            <ul>
              {BELIEFS.map((b) => (
                <li key={b.href}><a href={b.href}>{b.label}</a></li>
              ))}
            </ul>
          </nav>
          <div>
            <h3>Data</h3>
            <ul>
              <li>Yahoo Finance</li>
              <li>Finnhub</li>
              <li>FRED, St. Louis Fed</li>
              <li>Financial Modeling Prep</li>
            </ul>
          </div>
          <div className="lq-footer__legal">
            <span>Not investment advice. Data may be delayed.</span>
            <Link to="/privacy">Privacy</Link>
            <span>© {new Date().getFullYear()} Lumina Quant</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
