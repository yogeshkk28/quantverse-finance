# Lumina Quant

A quantitative finance terminal: dashboard, screener, charts, paper portfolio and a correlation web
for US and Indian (NSE) stocks. React 19 + Vite front end served by an Express server that holds all API keys.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the keys you have. Every key is optional; the app says
   on screen when a value is delayed, sample data or unavailable.
3. `npm run dev`, then open http://localhost:3000

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
