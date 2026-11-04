import React, { useEffect, useRef, useState } from "react";

/**
 * Through the wormhole: the 2.6 s jump from the landing page into the terminal.
 *
 *   01 Ignition   0.0 – 0.4 s  rings converge on a single point of light
 *   02 Freefall   0.4 – 1.5 s  tunnel rings rush past, gold deepens into violet,
 *                              ticker symbols drift along the walls
 *   03 Emergence  1.5 – 1.9 s  a soft warm bloom (no hard flash), rings widen off-screen
 *   04 Arrival    1.9 – 2.6 s  the bloom fades and the dashboard panels settle in
 *
 * Skip appears after 0.5 s. Reduced motion gets a 300 ms crossfade instead.
 * The dashboard mounts underneath while this plays, so its data loads during Freefall.
 */

const TOTAL = 2600;
const T_IGNITE = 400;
const T_FREEFALL = 1500;
const T_EMERGE = 1900;
const SYMBOLS = ["NVDA", "BTC", "NIFTY", "DAX", "S&P 500", "RELIANCE", "GOLD", "NIKKEI", "ETH", "FTSE", "TCS", "AAPL"];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function mix(a: [number, number, number], b: [number, number, number], t: number) {
  return a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",");
}
const GOLD: [number, number, number] = [212, 175, 55];
const LILAC: [number, number, number] = [201, 162, 240];
const VIOLET: [number, number, number] = [143, 123, 255];

export default function WormholeTransition({
  reduced,
  fromGate = false,
  onArrive,
  onDone,
}: {
  reduced: boolean;
  /** The landing gate already played Ignition and ended on a white flash: start in Freefall, out of that light. */
  fromGate?: boolean;
  /** Called once when Arrival starts (or straight away on skip / reduced motion). */
  onArrive: () => void;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showSkip, setShowSkip] = useState(false);
  const [fade, setFade] = useState(1);
  const doneRef = useRef(false);
  const arrivedRef = useRef(false);

  const arrive = () => {
    if (arrivedRef.current) return;
    arrivedRef.current = true;
    onArrive();
  };
  const finish = () => {
    if (doneRef.current) return;
    arrive();
    doneRef.current = true;
    onDone();
  };

  // Reduced motion: a plain 300 ms crossfade from the page colour.
  useEffect(() => {
    if (!reduced) return;
    arrive();
    const raf = requestAnimationFrame(() => setFade(0));
    const id = window.setTimeout(finish, 320);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      finish();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const RINGS = 36;
    const rings = Array.from({ length: RINGS }, (_, i) => ({ z: (i + 1) / RINGS }));
    const glyphs = SYMBOLS.map((s, i) => ({
      s,
      a: (i / SYMBOLS.length) * Math.PI * 2 + 0.3,
      z: 0.25 + ((i * 7) % 10) / 12,
    }));

    const start = performance.now() - (fromGate ? T_IGNITE : 0);
    let last = start;
    let raf = 0;
    const skipTimer = window.setTimeout(() => setShowSkip(true), fromGate ? 300 : 500);

    const draw = (now: number) => {
      const t = now - start;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cx = w / 2;
      const cy = h / 2;
      const big = Math.max(w, h);

      // Background: deep space with short trails.
      ctx.fillStyle = t < T_IGNITE ? "rgba(5,5,8,0.55)" : "rgba(6,6,12,0.32)";
      ctx.fillRect(0, 0, w, h);

      // Colour drifts gold → lilac → violet through Freefall.
      const f = clamp01((t - T_IGNITE) / (T_FREEFALL - T_IGNITE));
      const deep = f < 0.5 ? mix(GOLD, LILAC, f * 2) : mix(LILAC, VIOLET, (f - 0.5) * 2);

      if (t < T_IGNITE) {
        // 01 Ignition: rings converge and collapse to a point of light.
        const p = ease(t / T_IGNITE);
        for (let i = 0; i < 6; i++) {
          const r = lerp(big * (0.5 - i * 0.07), 6 + i * 2, p);
          ctx.strokeStyle = `rgba(212,175,55,${0.15 + i * 0.08})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, r, r * 0.62, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 + p * 30);
        g.addColorStop(0, "rgba(245,230,202,0.95)");
        g.addColorStop(1, "rgba(212,175,55,0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - 120, cy - 120, 240, 240);
      } else {
        // 02 Freefall (and the tail into Emergence): a tunnel flying at the viewer.
        const speed = t < T_FREEFALL ? 0.6 + f * f * 4.5 : 5 + (t - T_FREEFALL) / 120;
        const base = big * 0.05;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, big * 0.45);
        glow.addColorStop(0, `rgba(143,123,255,${0.12 + f * 0.3})`);
        glow.addColorStop(1, "rgba(6,6,12,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        for (const ring of rings) {
          ring.z -= dt * speed * 0.3;
          if (ring.z <= 0.02) ring.z += 1;
          const r = base / ring.z;
          if (r > big * 1.3) continue;
          const near = 1 - ring.z;
          ctx.strokeStyle = `rgba(${ring.z < 0.35 ? deep : mix(GOLD, VIOLET, f * 0.6)},${clamp01(near * 1.2) * 0.7})`;
          ctx.lineWidth = Math.max(0.5, 2.4 * near);
          ctx.beginPath();
          ctx.ellipse(cx, cy, r, r * 0.62, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Ticker symbols drifting along the tunnel walls.
        ctx.font = "500 12px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        for (const g of glyphs) {
          g.z -= dt * speed * 0.22;
          if (g.z <= 0.05) g.z += 1;
          const r = (base * 2.2) / g.z;
          const a = clamp01((1 - g.z) * 1.4) * (t < T_FREEFALL ? 0.8 : 0.4);
          ctx.fillStyle = `rgba(245,230,202,${a})`;
          ctx.fillText(g.s, cx + Math.cos(g.a) * r, cy + Math.sin(g.a) * r * 0.62);
        }
      }

      // Coming from the gate: fade out of the landing page's white flash.
      if (fromGate && t < T_IGNITE + 350) {
        ctx.fillStyle = `rgba(255,248,230,${1 - (t - T_IGNITE) / 350})`;
        ctx.fillRect(0, 0, w, h);
      }

      // 03 Emergence and 04 Arrival: a warm bloom that swells, then fades out.
      if (t >= T_FREEFALL) {
        const up = ease(clamp01((t - T_FREEFALL) / (T_EMERGE - T_FREEFALL)));
        const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, big * (0.2 + up * 0.7));
        bloom.addColorStop(0, `rgba(255,248,234,${0.9 * up})`);
        bloom.addColorStop(0.45, `rgba(245,230,202,${0.55 * up})`);
        bloom.addColorStop(1, `rgba(143,123,255,${0.15 * up})`);
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, w, h);
      }
      if (t >= T_EMERGE) {
        arrive();
        setFade(1 - ease(clamp01((t - T_EMERGE) / (TOTAL - T_EMERGE))));
      }

      if (t >= TOTAL) {
        finish();
        return;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(skipTimer);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // Escape skips too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100]"
      style={{
        opacity: fade,
        background: reduced ? "var(--lq-bg)" : fromGate ? "#fff8e6" : "#050508",
        transition: reduced ? "opacity 300ms ease" : undefined,
        pointerEvents: fade < 0.3 ? "none" : "auto",
      }}
      role="presentation"
    >
      {!reduced && <canvas ref={canvasRef} className="block w-full h-full" aria-hidden="true" />}
      <p className="sr-only" role="status">
        Entering the terminal
      </p>
      {showSkip && !reduced && (
        <button type="button" onClick={finish} className="lq-btn lq-btn--ghost absolute bottom-8 right-8">
          Skip
        </button>
      )}
    </div>
  );
}
