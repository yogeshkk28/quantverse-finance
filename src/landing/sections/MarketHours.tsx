import React, { useEffect, useState } from "react";
import {
  dialGroups,
  formatWait,
  joinCities,
  marketStatus,
  MarketState,
  REGIONS,
  ExchangeStatus,
} from "../marketHours";

const SIZE = 400;
const C = SIZE / 2;
const OUTER = 176;
const STEP = 17;

const STATE_LABEL: Record<MarketState, string> = { open: "Open", lunch: "Lunch", closed: "Closed" };

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

function headlineFor(status: ExchangeStatus[], now: Date): string {
  const open = status.filter((s) => s.state === "open");
  const cities = [...new Set(open.map((s) => s.city))];
  if (cities.length > 3) return `Right now, ${open.length} of ${status.length} markets are trading.`;
  if (cities.length > 0) return `Right now, ${joinCities(cities)} ${cities.length === 1 ? "is" : "are"} trading.`;
  if (status.some((s) => s.state === "lunch")) return "Asia is at lunch.";
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  return weekend ? "The world's markets are resting." : "Every market is between bells.";
}

/**
 * "Somewhere, a market is open": a live 24-hour dial of the ten largest
 * exchanges on the visitor's own clock, plus the full top-20 list by region.
 */
export default function MarketHours() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const status = marketStatus(now);
  const groups = dialGroups(status);
  const openCount = status.filter((s) => s.state === "open").length;
  const next = status.filter((s) => s.state !== "open").sort((a, b) => a.opensIn - b.opensIn)[0];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [hx, hy] = point(OUTER + 10, nowMinutes);

  return (
    <section id="hours" className="lq-section lq-hours" data-section-theme="dark" data-glyph="H" aria-labelledby="hours-title">
      <div className="lq-hours__text">
        <p className="lq-eyebrow">Market hours, live</p>
        <h2 id="hours-title" className="lq-statement lq-hours__title">
          {headlineFor(status, now)}
        </h2>
        {next && (
          <p className="lq-hours__next">
            Next bell: <strong>{next.city}</strong> in {formatWait(next.opensIn)}
          </p>
        )}

        <ul className="lq-hours__list" aria-label="Ten largest exchanges">
          {groups.map(({ label, members, lead }) => (
            <li key={label} data-state={lead.state}>
              <span className="lq-hours__dot" aria-hidden="true" />
              <span className="lq-hours__market">
                <span className="lq-hours__name">{label}</span>
                <span className="lq-hours__codes">{members.map((m) => m.code).join(" · ")}</span>
              </span>
              <span className="lq-hours__clock">
                <span className="lq-hours__time">{lead.localTime}</span>
                <span className="lq-hours__tz">{lead.utcOffset}</span>
              </span>
              <span className="lq-hours__state">{STATE_LABEL[lead.state]}</span>
            </li>
          ))}
        </ul>

        <details className="lq-hours__all">
          <summary>
            All 20 markets <span>{openCount} open now</span>
          </summary>
          {REGIONS.map((region) => (
            <div key={region} className="lq-hours__region">
              <h3>{region}</h3>
              <ul>
                {status
                  .filter((s) => s.region === region)
                  .map((s) => (
                    <li key={s.code} data-state={s.state}>
                      <span className="lq-hours__dot" aria-hidden="true" />
                      <span className="lq-hours__market">
                        <span className="lq-hours__name">{s.name}</span>
                        <span className="lq-hours__codes">
                          {s.city}, {s.country}
                        </span>
                      </span>
                      <span className="lq-hours__clock">
                        <span className="lq-hours__time">{s.localTime}</span>
                        <span className="lq-hours__tz">{s.state === "open" ? s.utcOffset : `opens ${formatWait(s.opensIn)}`}</span>
                      </span>
                      <span className="lq-hours__badge" data-coverage={s.coverage}>
                        {s.coverage === "covered" ? (
                          <>
                            Live data
                            <br />
                            Paper trading
                          </>
                        ) : (
                          "Coming soon"
                        )}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </details>

        <p className="lq-hours__note">
          Lumina has live data for the US and NSE today, with more markets on the way. Regular hours on your clock;
          exchange holidays not shown.
        </p>
      </div>

      <svg className="lq-hours__dial" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Trading sessions of the ten largest exchanges on a 24-hour dial in your time zone">
        {[0, 360, 720, 1080].map((m) => {
          const [x, y] = point(OUTER + 18, m);
          return (
            <text key={m} x={x} y={y} className="lq-hours__tick" textAnchor="middle" dominantBaseline="middle">
              {String(m / 60).padStart(2, "0")}
            </text>
          );
        })}
        {groups.map(({ label, lead }, i) => {
          const r = OUTER - i * STEP;
          return (
            <g key={label} data-state={lead.state}>
              <circle cx={C} cy={C} r={r} className="lq-hours__track" />
              {lead.viewerSessions.map(([a, b]) => (
                <path key={a} d={arc(r, a, b)} className="lq-hours__session" />
              ))}
              <text x={C - 8} y={C - r} className="lq-hours__label" textAnchor="end" dominantBaseline="middle">
                {label}
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
