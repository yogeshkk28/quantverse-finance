import { startLoop, seeded, Loop } from "./loop";

/**
 * A price chart drawn as characters: a random-walk close line with the area
 * under it filled, plus volume bars along the bottom. Brighter cells get denser
 * glyphs, glyphs shimmer, and rows are revealed from the bottom as `getReveal()`
 * goes from 0 to 1.
 */
const GLYPHS = " .:-=+*#%@";

export function asciiMosaic(
  canvas: HTMLCanvasElement,
  opts: { animate: boolean; getReveal: () => number; seed?: number }
): Loop {
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const CELL = mobile ? 16 : 12;
  let cols = 0;
  let rows = 0;
  let field: Float32Array = new Float32Array(0);

  const build = (width: number, height: number) => {
    cols = Math.ceil(width / CELL);
    rows = Math.ceil(height / CELL);
    field = new Float32Array(cols * rows);
    const rand = seeded(opts.seed ?? 7);

    // Random-walk closes, one per column, smoothed
    const closes: number[] = [];
    let v = 0.45;
    for (let c = 0; c < cols; c++) {
      v += (rand() - 0.48) * 0.06;
      v = Math.min(0.85, Math.max(0.2, v));
      closes.push(v);
    }
    const smooth = closes.map((_, i) => {
      const w = closes.slice(Math.max(0, i - 2), i + 3);
      return w.reduce((a, b) => a + b, 0) / w.length;
    });
    const volumes = closes.map(() => 0.04 + rand() * 0.12);

    for (let c = 0; c < cols; c++) {
      const lineRow = (1 - smooth[c]) * rows * 0.85;
      for (let r = 0; r < rows; r++) {
        let b = 0;
        const dist = Math.abs(r - lineRow);
        if (dist < 1.2) b = 1; // the price line itself
        else if (r > lineRow) b = Math.max(0, 0.55 - ((r - lineRow) / rows) * 0.9); // area fill fading down
        const volTop = rows * (1 - volumes[c]);
        if (r > volTop) b = Math.max(b, 0.35); // volume bars
        field[r * cols + c] = b;
      }
    }
  };

  let builtFor = "";
  return startLoop(
    canvas,
    ({ ctx, width, height, time }) => {
      const key = `${Math.round(width)}x${Math.round(height)}`;
      if (key !== builtFor) {
        build(width, height);
        builtFor = key;
      }
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${CELL}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textBaseline = "top";

      const reveal = opts.getReveal();
      const firstRow = Math.floor(rows * (1 - reveal));
      const tick = Math.floor(time * 8);

      for (let r = Math.max(0, firstRow); r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const b = field[r * cols + c];
          if (b <= 0.02) continue;
          // shimmer: brightness wobbles per cell over time
          const jitter = opts.animate ? (((c * 73 + r * 151 + tick * 17) % 29) / 29 - 0.5) * 0.18 : 0;
          const level = Math.max(0, Math.min(1, b + jitter));
          const glyph = GLYPHS[Math.round(level * (GLYPHS.length - 1))];
          if (glyph === " ") continue;
          ctx.fillStyle = `rgba(212,175,55,${0.25 + level * 0.65})`;
          ctx.fillText(glyph, c * CELL, r * CELL);
        }
      }
    },
    { animate: opts.animate }
  );
}
