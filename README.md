# Lumina Quant

A quantitative finance terminal: dashboard, screener, charts, paper portfolio and a correlation web
for US and Indian stocks: every listed company on NASDAQ, NYSE, NYSE American, NSE and BSE. React 19 + Vite front end served by an Express server that holds all API keys.

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

## Theme: Event Horizon

Every colour, font and shared part lives in one file, `src/theme/event-horizon.css`. It defines the
`--lq-*` CSS variables, Tailwind utilities that read them (`bg-lq-surface`, `text-lq-gold`, `border-lq-line`, …)
and shared classes (`.lq-panel`, `.lq-card`, `.lq-chip`, `.lq-btn`, `.lq-lbl`, `.lq-table`). Gold marks what you can
act on, violet is atmosphere only, green and red only show price direction. Add a token there before using a new colour.

Arriving from the landing gate plays the wormhole transition (`src/app/WormholeTransition.tsx`) every time;
add `?warp` to any `/app` URL to replay it. Reduced-motion users get a short crossfade.

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
| Prices, history, indicators | Yahoo Finance chart endpoint | US, NSE (`.NS`) and BSE (`.BO`), delayed, no key, cached 5 min |
| Stock lists | Symbol master (see above) | Exchange listing files checked daily |
| Real-time US prices | Finnhub (`FINNHUB_API`) | Optional, overrides Yahoo for US stocks |
| P/E, ROE, market cap | Financial Modeling Prep (`FINANCIAL_MODELING_API`) | US only on the free plan; otherwise sample values marked `*` |
| Macro strip | FRED (`FRED_API`) | CPI and GDP shown as year-over-year % |
| Fear & Greed | Computed in `server/fearGreed.ts` | Momentum, volatility, safe-haven demand, breadth, strength, junk-bond spread |
| News | NewsData.io (`NEWS_IO_API`) | |
| AI analysis | Gemini (`GEMINI_API_KEY`) | |

## Stock universe

Three layers, from widest to narrowest:

| Layer | Size | Where | Used by |
| --- | --- | --- | --- |
| Symbol master | ≈11,000 stocks: NASDAQ, NYSE, NYSE American, NSE, plus BSE listings not on NSE | `server/symbols/master.json`, `server/symbolMaster.ts` | Search, quotes and charts for any stock |
| Screener | ≈1,300: the hand-picked list plus US stocks of $10B and up and Indian mid and large caps | `server/screenerUniverse.ts` | `/api/screener` |
| Tracked | 26 | `server/universe.ts` | Dashboard, sentiment, Correlation Web |

Prices are never prefetched for the symbol master: a stock's quote and history come from Yahoo
when someone opens it. Search and lookup are local and instant.

- `searchSymbols(query, limit, market?)` in `server/symbolMaster.ts` ranks exact ticker, ticker prefix,
  name prefix and word matches, larger companies first. `findSymbol(id)` resolves `MRF`, `MRF.NS`,
  `NSE:MRF` or `BRK.B`.
- `GET /api/quote/:id` returns a ticker (price, change, RSI, beta…) for any listed stock, `GET /api/symbols/:id`
  resolves a listing without prices, and `GET /api/symbols/stats` gives counts and how fresh the list is.
  `/api/history/:id` and `/api/chart/:id` accept any listed stock too.
- Ids are the ticker without its exchange suffix (`AAPL`, `MRF`). When a US and an Indian stock share a
  ticker, the larger keeps it and the other uses its full symbol (`HAL.NS`) or `<ticker>.US`.

**Keeping it current.** Once a day the server reads the exchanges' own listing files (NASDAQ Trader's
`nasdaqlisted.txt` and `otherlisted.txt`, NSE's `EQUITY_L.csv`) and adds any new listing to
`server/data/symbol-additions.json`, so IPOs show up in search without a rebuild. To refresh sectors
and market caps too, run `npm run symbols:build`, which rebuilds `master.json` from
[US-Stock-Symbols](https://github.com/rreichel3/US-Stock-Symbols) (NASDAQ's screener export, for market caps)
and [FinanceDatabase](https://github.com/JerBouma/FinanceDatabase) (MIT; sectors, ISINs and the NSE/BSE lists).
