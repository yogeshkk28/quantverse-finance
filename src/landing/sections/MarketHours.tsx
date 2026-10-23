import React, { useEffect, useState } from "react";
import { formatWait, joinCities, marketStatus } from "../marketHours";

const SIZE = 400;
const C = SIZE / 2;
const OUTER = 176;
const STEP = 17;

function point(r: number, minutes: number) {
  const a = (minutes / 1440) * Math.PI * 2 - Math.PI / 2; // midnight at the top
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function arc(r: number, start: number, end: number) {
  const span = (end - start + 1440) % 1440;
  const [x0, y0] = point(r, start);
  const [x1, y1] = point(r, end);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${span > 720 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * "Somewhere, a market is open": a live 24-hour dial of the major exchanges on
 * the visitor's own clock, with the hand at the current time.
 */
export default function MarketHours() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const status = marketStatus(now);
  const open = status.filter((s) => s.isOpen);
  const next = status.filter((s) => !s.isOpen).sort((a, b) => a.opensIn - b.opensIn)[0];
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [hx, hy] = point(OUTER + 10, nowMinutes);

  const headline =
    open.length > 0
      ? `Right now, ${joinCities(open.map((s) => s.city))} ${open.length === 1 ? "is" : "are"} trading.`
      : weekend
        ? "The world's markets are resting."
        : "Every market is between bells.";

  return (
    <section id="hours" className="lq-section lq-hours" data-section-theme="dark" data-glyph="H" aria-labelledby="hours-title">
      <div className="lq-hours__text">
        <p className="lq-eyebrow">Market hours, live</p>
        <h2 id="hours-title" className="lq-statement lq-hours__title">
          {headline}
        </h2>
        {next && (
          <p className="lq-hours__next">
            Next bell: <strong>{next.city}</strong> in {formatWait(next.opensIn)}
          </p>
        )}
        <ul className="lq-hours__list">
          {status.map((s) => (
            <li key={s.code} data-open={s.isOpen}>
              <span className="lq-hours__dot" aria-hidden="true" />
              <span className="lq-hours__code">{s.code}</span>
              <span className="lq-hours__city">{s.city}</span>
              <span className="lq-hours__time">{s.localTime}</span>
              <span className="lq-hours__state">{s.isOpen ? "Open" : "Closed"}</span>
            </li>
          ))}
        </ul>
        <p className="lq-hours__note">
          Lumina covers NSE and the US today. Regular hours on your clock; holidays not shown.
        </p>
      </div>

      <svg className="lq-hours__dial" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Trading sessions on a 24-hour dial in your time zone">
        {[0, 360, 720, 1080].map((m) => {
          const [x, y] = point(OUTER + 18, m);
          return (
            <text key={m} x={x} y={y} className="lq-hours__tick" textAnchor="middle" dominantBaseline="middle">
              {String(m / 60).padStart(2, "0")}
            </text>
          );
        })}
        {status.map((s, i) => {
          const r = OUTER - i * STEP;
          return (
            <g key={s.code} data-open={s.isOpen}>
              <circle cx={C} cy={C} r={r} className="lq-hours__track" />
              <path d={arc(r, s.start, s.end)} className="lq-hours__session" />
              <text x={C - 8} y={C - r} className="lq-hours__label" textAnchor="end" dominantBaseline="middle">
                {s.code}
              </text>
            </g>
          );
        })}
        <line x1={C} y1={C} x2={hx} y2={hy} className="lq-hours__hand" />
        <circle cx={C} cy={C} r={4} className="lq-hours__pivot" />
        <text x={C} y={C + 26} className="lq-hours__now" textAnchor="middle">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </text>
      </svg>
    </section>
  );
}
