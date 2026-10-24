import { startLoop, Loop } from "./loop";

/**
 * Hero visual: a few hundred thin lines that together read as a swirl of silk.
 * Each line is a sine path whose phase and amplitude drift with time and with
 * scroll progress, coloured from pale gold through gold to amber.
 */
export function ribbons(canvas: HTMLCanvasElement, opts: { animate: boolean; getProgress: () => number }): Loop {
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const LINES = mobile ? 90 : 200;
  const STEPS = mobile ? 60 : 110;

  const colour = (k: number, alpha: number) => {
    // k 0..1: pale gold → gold → amber
    const stops = [
      [245, 230, 202],
      [212, 175, 55],
      [240, 145, 63],
    ];
    const seg = k < 0.5 ? 0 : 1;
    const t = k < 0.5 ? k / 0.5 : (k - 0.5) / 0.5;
    const [a, b] = [stops[seg], stops[seg + 1]];
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  };

  return startLoop(
    canvas,
    ({ ctx, width, height, time }) => {
      const p = opts.getProgress(); // 0 at top of page, 1 when the hero has scrolled away
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 0.6;

      const cx = width * 0.55;
      const cy = height * 0.52;
      const spanX = width * 0.75;

      for (let i = 0; i < LINES; i++) {
        const k = i / (LINES - 1);
        const phase = k * Math.PI * 1.6 + time * 0.25 + p * 2.2;
        const amp = height * (0.16 + 0.12 * Math.sin(k * Math.PI * 2 + time * 0.15)) * (1 - p * 0.4);
        const twist = 0.6 + 0.4 * Math.sin(time * 0.2 + k * 3);
        ctx.strokeStyle = colour((k + p * 0.6) % 1, 0.08 + 0.1 * (1 - Math.abs(k - 0.5) * 2));
        ctx.beginPath();
        for (let s = 0; s <= STEPS; s++) {
          const t = s / STEPS;
          const x = cx - spanX / 2 + t * spanX;
          const envelope = Math.sin(t * Math.PI); // pinch both ends like a ribbon
          const y =
            cy +
            Math.sin(t * Math.PI * 2 * twist + phase) * amp * envelope +
            Math.cos(t * Math.PI * 3 - phase * 0.5) * amp * 0.25 * envelope +
            (k - 0.5) * height * 0.12 * envelope;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    },
    { animate: opts.animate }
  );
}
