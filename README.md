# Lumina Quant

A quantitative finance terminal: dashboard, screener, charts, paper portfolio and a correlation web
for US and Indian (NSE) stocks. React 19 + Vite front end served by an Express server that holds all API keys.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the keys you have. Every key is optional; the app says
   on screen when a value is delayed, sample data or unavailable.
3. `npm run dev`, then open http://localhost:3000

## Landing page and sign-up

`/` is the scroll-driven landing page (`src/landing/`, GSAP + Lenis, canvas visuals). The
"Enter the Wormhole" form near the bottom takes an email and opens the terminal at `/app/dashboard`.
This is placeholder auth (`server/auth.ts`): no password, a 30-day session cookie, and users stored in
`server/data/auth.json` (gitignored). It gates the UI only; the `/api` data routes stay open.

## How the Correlation Web works

`server/impact.ts` builds the web from about two years of daily closes per market (`/api/correlation-web`):

- **Market-adjusted links** (default lens): each stock's daily return minus what its beta to the index
  (S&P 500 or Nifty 50) explains. Two stocks are linked when these residuals correlate. Residuals are
  clipped at ±3 robust standard deviations so a single extreme day can't create a link.
- **Raw links**: plain correlation of daily returns, for comparison.
- **Lead-lag**: stock A's residual today against stock B's residual tomorrow. A pair is drawn only if it
  clears a Bonferroni-corrected significance threshold across every ordered pair and beats the reverse
  direction. Needs at least 60 sessions.
- **Event study** (`/api/correlation-web/events`): for a selected stock, its 12 largest market-adjusted
  moves in two years, and what each peer did that day and over the next five sessions. A peer is marked
  significant only if a t-test passes after correcting for the number of peers tested.

All of this describes the past and is not a forecast.

## Where the data comes from

| Data | Source | Notes |
| --- | --- | --- |
| Prices, history, indicators | Yahoo Finance chart endpoint | US and NSE (`.NS`), delayed, no key, cached 5 min |
| Real-time US prices | Finnhub (`FINNHUB_API`) | Optional, overrides Yahoo for US stocks |
| P/E, ROE, market cap | Financial Modeling Prep (`FINANCIAL_MODELING_API`) | US only on the free plan; otherwise sample values marked `*` |
| Macro strip | FRED (`FRED_API`) | CPI and GDP shown as year-over-year % |
| Fear & Greed | Computed in `server/fearGreed.ts` | Momentum, volatility, safe-haven demand, breadth, strength, junk-bond spread |
| News | NewsData.io (`NEWS_IO_API`) | |
| AI analysis | Gemini (`GEMINI_API_KEY`) | |

The tracked stocks live in `server/universe.ts`. Add a symbol there and it appears everywhere.
