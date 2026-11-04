import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useAuth } from "../../context/AuthContext";
import CanvasLayer from "../CanvasLayer";
import { wormhole, Wormhole } from "../canvas/wormhole";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * "Enter the Wormhole": the account gate. The tunnel speeds up as the section
 * scrolls through view. Signed-in visitors warp straight into the terminal;
 * everyone else is sent to create an account or log in.
 */
export default function WormholeGate({ reduced }: { reduced: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const tunnel = useRef<Wormhole | null>(null);
  const [warping, setWarping] = useState(false);

  useGSAP(
    () => {
      if (reduced) return;
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (st) => tunnel.current?.setSpeed(0.2 + Math.sin(st.progress * Math.PI) * 1.6),
      });
    },
    { scope: sectionRef, dependencies: [reduced] }
  );

  async function goIn() {
    setWarping(true);
    // Load the terminal while the tunnel plays, so nothing blinks between the two.
    import("../../App").catch(() => {});
    // The full tunnel acceleration plays here, then the terminal carries on
    // with Freefall, Emergence and Arrival.
    await tunnel.current?.warp(1200);
    navigate("/app/dashboard", { state: { via: "wormhole" } });
  }

  return (
    <section
      id="gate"
      ref={sectionRef}
      className="lq-section lq-gate"
      data-section-theme="hero"
      data-glyph="W"
      aria-labelledby="gate-title"
    >
      <CanvasLayer
        start={(canvas) => wormhole(canvas, { animate: !reduced })}
        onReady={(loop) => (tunnel.current = loop as Wormhole)}
      />
      <div className="lq-gate__inner">
        <p className="lq-eyebrow">Paper trading account</p>
        <h2 id="gate-title" className="lq-statement">
          Enter the Wormhole.
        </h2>

        {user ? (
          <>
            <p className="lq-body">Welcome back, {user.fullName.split(" ")[0]}. Your paper portfolio is waiting.</p>
            <button
              type="button"
              className="lq-btn lq-btn--gold"
              style={{ marginTop: 40 }}
              onClick={goIn}
              disabled={warping}
            >
              {warping ? "Warping…" : "Enter the terminal"} <span className="lq-btn__arrow" aria-hidden="true">→</span>
            </button>
          </>
        ) : (
          <>
            <p className="lq-body">
              Create a free account to start trading US and Indian markets with virtual money.
            </p>
            <div className="lq-gate__ctas">
              <Link to="/signup" className="lq-btn lq-btn--gold">
                Create account <span className="lq-btn__arrow" aria-hidden="true">→</span>
              </Link>
              <Link to="/login" className="lq-btn lq-gate__login">
                Log in
              </Link>
            </div>
            <p className="lq-gate__note">
              Practice money only. No card, no real brokerage. <Link to="/privacy">Privacy policy</Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
