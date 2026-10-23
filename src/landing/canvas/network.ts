import { startLoop, seeded, Loop } from "./loop";

/** Slowly drifting nodes joined when close: a quiet preview of the Correlation Web. */
export function network(canvas: HTMLCanvasElement, opts: { animate: boolean }): Loop {
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const N = mobile ? 28 : 60;
  const rand = seeded(11);
  const nodes = Array.from({ length: N }, () => ({
    x: rand(),
    y: rand(),
    vx: (rand() - 0.5) * 0.012,
    vy: (rand() - 0.5) * 0.012,
    r: 1.5 + rand() * 2.5,
    gold: rand() > 0.6,
  }));

  return startLoop(
    canvas,
    ({ ctx, width, height, dt }) => {
      ctx.clearRect(0, 0, width, height);
      const reach = Math.min(width, height) * 0.22;
      for (const n of nodes) {
        if (opts.animate) {
          n.x += n.vx * dt;
          n.y += n.vy * dt;
          if (n.x < 0 || n.x > 1) n.vx *= -1;
          if (n.y < 0 || n.y > 1) n.vy *= -1;
        }
      }
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = (a.x - b.x) * width;
          const dy = (a.y - b.y) * height;
          const d = Math.hypot(dx, dy);
          if (d < reach) {
            ctx.strokeStyle = `rgba(212,175,55,${0.22 * (1 - d / reach)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x * width, a.y * height);
            ctx.lineTo(b.x * width, b.y * height);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = n.gold ? "rgba(212,175,55,0.9)" : "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(n.x * width, n.y * height, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { animate: opts.animate }
  );
}
