/**
 * Shared canvas plumbing: sizing for device pixel ratio, a requestAnimationFrame
 * loop that pauses while the canvas is off-screen or the tab is hidden, and a
 * single static frame when animation is turned off (reduced motion).
 */
export interface Frame {
  ctx: CanvasRenderingContext2D;
  width: number; // CSS pixels
  height: number;
  time: number; // seconds since start
  dt: number; // seconds since last frame
}

export interface Loop {
  stop: () => void;
  /** Draw one frame now (used for the reduced-motion still). */
  redraw: () => void;
}

export function startLoop(
  canvas: HTMLCanvasElement,
  draw: (frame: Frame) => void,
  { animate = true, maxDpr = 1.5 }: { animate?: boolean; maxDpr?: number } = {}
): Loop {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { stop: () => {}, redraw: () => {} };

  let width = 0;
  let height = 0;
  let raf = 0;
  let visible = true;
  let last = performance.now();
  const start = last;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const render = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    draw({ ctx, width, height, time: (now - start) / 1000, dt });
  };

  const tick = (now: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    render(now);
    raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (animate && visible && !document.hidden && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  const ro = new ResizeObserver(() => {
    resize();
    if (!animate) render(performance.now());
  });
  ro.observe(canvas);

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    wake();
  });
  io.observe(canvas);

  document.addEventListener("visibilitychange", wake);
  resize();
  render(performance.now());
  wake();

  return {
    stop: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
    },
    redraw: () => render(performance.now()),
  };
}

/** Deterministic pseudo-random numbers so drawings look the same on every load. */
export function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
