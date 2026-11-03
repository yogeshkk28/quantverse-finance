import React from "react";

/** Where the faint wormholes sit down the page. Percent of viewport, size in px. */
const HOLES = [
  { side: "right" as const, x: -160, y: -12, size: 760, opacity: 1 },
  { side: "left" as const, x: -260, y: 55, size: 680, opacity: 0.7 },
  { side: "right" as const, x: -240, y: 110, size: 620, opacity: 0.5 },
];

function Rings() {
  return (
    <svg className="lq-cosmos__rings" viewBox="0 0 800 800" aria-hidden="true">
      <g fill="none" stroke="#D4AF37">
        <ellipse cx="400" cy="400" rx="390" ry="250" strokeOpacity=".12" />
        <ellipse cx="400" cy="392" rx="310" ry="196" strokeOpacity=".16" />
        <ellipse cx="400" cy="386" rx="240" ry="150" strokeOpacity=".2" />
        <ellipse cx="400" cy="381" rx="180" ry="112" strokeOpacity=".26" />
        <ellipse cx="400" cy="378" rx="128" ry="80" strokeOpacity=".32" />
        <ellipse cx="400" cy="376" rx="86" ry="54" stroke="#8F7BFF" strokeOpacity=".45" />
      </g>
    </svg>
  );
}

/**
 * The Event Horizon background: a faint starfield and a few wormhole rings that
 * rotate very slowly (still when motion is reduced). Fixed behind every page so
 * the jump from the landing tunnel feels like one journey.
 */
export default function Cosmos() {
  return (
    <div className="lq-cosmos" aria-hidden="true">
      {HOLES.map((h, i) => (
        <div
          key={i}
          className="lq-cosmos__hole"
          style={{ [h.side]: h.x, top: `${h.y}vh`, width: h.size, opacity: h.opacity }}
        >
          <div className="lq-cosmos__glow" />
          <Rings />
        </div>
      ))}
    </div>
  );
}
