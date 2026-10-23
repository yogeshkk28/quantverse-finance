import React, { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useAuth } from "../../context/AuthContext";
import CanvasLayer from "../CanvasLayer";
import { wormhole, Wormhole } from "../canvas/wormhole";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * "Enter the Wormhole": the email gate. The tunnel speeds up as the section
 * scrolls through view; a successful sign-up plays a warp, then opens the terminal.
 */
export default function WormholeGate({ reduced }: { reduced: boolean }) {
  const { user, enter } = useAuth();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const tunnel = useRef<Wormhole | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "warping">("idle");
  const [error, setError] = useState<string | null>(null);

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
    setStatus("warping");
    await tunnel.current?.warp(1200);
    navigate("/app/dashboard");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") || "");
    setError(null);
    setStatus("sending");
    const result = await enter(email);
    if (!result.ok) {
      setStatus("idle");
      setError(result.error);
      return;
    }
    await goIn();
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
        <p className="lq-eyebrow">Early access</p>
        <h2 id="gate-title" className="lq-statement">
          Enter the Wormhole.
        </h2>

        {user ? (
          <>
            <p className="lq-body">You're signed in as {user.email}. The terminal is one step away.</p>
            <button
              type="button"
              className="lq-btn lq-btn--gold"
              style={{ marginTop: 40 }}
              onClick={goIn}
              disabled={status === "warping"}
            >
              Enter the terminal <span className="lq-btn__arrow" aria-hidden="true">→</span>
            </button>
          </>
        ) : (
          <>
            <p className="lq-body">Leave your email to open the terminal. No password, no card.</p>
            <form className="lq-form" onSubmit={onSubmit} noValidate>
              <label htmlFor="gate-email" className="sr-only">
                Email address
              </label>
              <input
                id="gate-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                aria-invalid={error ? true : undefined}
                aria-describedby="gate-msg"
              />
              <button type="submit" className="lq-btn lq-btn--gold" disabled={status !== "idle"}>
                {status === "idle" ? "Enter" : status === "sending" ? "Opening…" : "Warping…"}
                <span className="lq-btn__arrow" aria-hidden="true">→</span>
              </button>
            </form>
            <p id="gate-msg" className="lq-form__msg" data-kind={error ? "error" : "info"} role="status" aria-live="polite">
              {error ?? ""}
            </p>
            <p className="lq-gate__note">Early preview. Your email is only used to let you in.</p>
          </>
        )}
      </div>
    </section>
  );
}
