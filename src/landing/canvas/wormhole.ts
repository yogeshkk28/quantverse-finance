import { startLoop, Loop } from "./loop";

export interface Wormhole extends Loop {
  setSpeed: (speed: number) => void;
  /** Accelerate into the tunnel and flash; resolves when the animation ends. */
  warp: (ms: number) => Promise<void>;
}

/**
 * A tunnel of rings flying toward the viewer. Rings are spaced in depth (z);
 * each frame they move closer, and those that pass the camera loop to the back.
 */
export function wormhole(canvas: HTMLCanvasElement, opts: { animate: boolean }): Wormhole {
  const RINGS = 42;
  const rings = Array.from({ length: RINGS }, (_, i) => ({ z: (i + 1) / RINGS, hue: i % 3 }));
  let speed = 0.25;
  let warpStart = 0;
  let warpMs = 0;
  let warpDone: (() => void) | null = null;

  const loop = startLoop(
    canvas,
    ({ ctx, width, height, time, dt }) => {
      let s = speed;
      let flash = 0;
      if (warpDone) {
        const t = Math.min(1, (performance.now() - warpStart) / warpMs);
        s = speed + t * t * 9;
        flash = Math.max(0, (t - 0.7) / 0.3);
        if (t >= 1) {
          const done = warpDone;
          warpDone = null;
          done();
        }
      }

      ctx.fillStyle = "rgba(0,0,0,0.35)"; // short trails
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2 + Math.sin(time * 0.4) * width * 0.02;
      const cy = height / 2 + Math.cos(time * 0.3) * height * 0.02;
      const base = Math.max(width, height) * 0.06;

      for (const ring of rings) {
        if (opts.animate || warpDone) {
          ring.z -= dt * s * 0.35;
          if (ring.z <= 0.02) ring.z += 1;
        }
        const r = base / ring.z;
        if (r > Math.max(width, height) * 1.2) continue;
        const alpha = Math.min(1, (1 - ring.z) * 1.2) * 0.55;
        const colours = ["212,175,55", "245,230,202", "240,145,63"];
        ctx.strokeStyle = `rgba(${colours[ring.hue]},${alpha})`;
        ctx.lineWidth = Math.max(0.5, 2.2 * (1 - ring.z));
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (flash > 0) {
        ctx.fillStyle = `rgba(255,248,230,${flash})`;
        ctx.fillRect(0, 0, width, height);
      }
    },
    { animate: opts.animate }
  );

  return {
    ...loop,
    setSpeed: (v) => {
      speed = v;
    },
    warp: (ms) =>
      new Promise<void>((resolve) => {
        if (!opts.animate) return resolve();
        warpStart = performance.now();
        warpMs = ms;
        warpDone = resolve;
      }),
  };
}
