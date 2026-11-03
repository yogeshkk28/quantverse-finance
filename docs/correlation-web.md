# Correlation Web: methods

The Correlation Web is a market-structure lab for the stocks in `server/universe.ts`.
Everything is computed on the server from about two years of daily closes
(Yahoo Finance) and is descriptive history, not a forecast.

## Pipeline

1. **Returns.** Simple daily returns, aligned on the days every stock traded.
   *Market-adjusted* (default) uses the residual after an OLS fit on the
   benchmark index (`^GSPC`, `^NSEI`). Both bases are winsorised at ±3 robust
   standard deviations (median absolute deviation), so one extreme day cannot
   create a link on its own.
2. **Correlation estimator** (`server/quant/estimators.ts`)
   - *Ledoit–Wolf* (default): shrinkage towards a constant-correlation target
     with the analytically optimal intensity δ* (Ledoit & Wolf 2003, "Honey, I
     shrunk the sample covariance matrix").
   - *Noise-filtered*: random-matrix filtering. Eigenvalues inside the
     Marchenko–Pastur band λ± = σ²(1 ± √(N/T))² are replaced by their mean
     (trace preserved), with σ² = 1 − λ₁/N when a market mode sits above the
     band (Laloux et al. 1999; Plerou et al. 2002).
   - *Sample*: plain Pearson correlation, for comparison.
3. **Distance.** d = √(2(1 − ρ)) (Mantegna 1999), a proper metric.
4. **Partial correlations** from the inverse of the cleaned matrix,
   ρᵢⱼ·rest = −Pᵢⱼ / √(PᵢᵢPⱼⱼ). An edge is drawn when the Fisher z-test with
   T − (N − 2) − 3 effective observations clears a Bonferroni-corrected
   threshold. With too few days for that test, the N strongest ties are shown
   and the page says so.

## Networks (`server/quant/networks.ts`)

| View | Construction | Edges |
|---|---|---|
| Backbone | Minimum spanning tree on d (Kruskal) | N − 1 |
| Filtered graph | TMFG (Massara, Di Matteo & Aste 2016), greedy planar triangulation on ρ | 3N − 6 |
| Direct ties | Significant partial correlations | varies |
| Threshold | \|ρ\| above a Bonferroni-corrected bar | varies |
| Lead-lag | Next-day residual cross-correlation, Bonferroni-tested, stronger than the reverse direction | varies |

**Edge reliability.** MST edges carry the share of 100 moving-block bootstrap
replicas (5-day blocks, Ledoit–Wolf estimator) whose MST contains them
(Tumminello et al. 2007). Unreliable edges are drawn faint.

TMFG is used instead of the PMFG: it keeps the same planar, clique-rich
structure, but runs in O(N²) instead of needing repeated planarity tests.

## Groups and centrality

- **Clusters** (`server/quant/clustering.ts`): average-linkage hierarchical
  clustering on d. The tree is cut at the k (2–7) with the highest mean
  silhouette (Rousseeuw 1987). Below ~0.1 the page flags the groups as weak.
  The dendrogram's leaf order seriates the heatmap.
- **Centrality**, measured on the TMFG: strength, eigenvector centrality
  (weights (1 + ρ)/2), betweenness and closeness (Brandes, path length d).
  The *hub score* is the mean percentile of the four. Top 20% are *core hubs*;
  high betweenness with low strength is a *bridge*; bottom 30% is the
  *periphery*, which tends to diversify (Pozzi, Di Matteo & Aste 2013).

## Spectrum and regime

- **Eigen-spectrum** of the sample matrix against λ+: the number of factors
  above noise, the market-mode share λ₁/N, the absorption ratio (top ⌈N/5⌉
  eigenvalues) and the effective rank exp(H(λ/N)).
- **Regime monitor** (`server/quant/regimes.ts`), rolling 60-session windows
  every 5 sessions on raw returns: average correlation (raw and
  market-adjusted), absorption ratio and its standardised 15-day vs. 1-year
  shift (Kritzman, Li, Page & Rigobon 2011), normalised MST length and MST
  edge survival (Onnela et al. 2003). The state is *tightly coupled* when the
  latest absorption ratio is in the top 20% of its history or has shifted up by
  at least 1σ, *dispersed* in the bottom 20%, otherwise *normal*.

## Pair drill-down

Rolling 60-session correlation of two stocks (raw and market-adjusted) and the
cross-correlation function of their residuals at lags −5…+5, with the ±1.96/√T
band for pure noise.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/correlation-web/structure?market=US\|IN&days=30\|90\|250&basis=residual\|raw&estimator=lw\|rmt\|sample` | matrix, partials, spectrum, networks, clusters, centrality |
| `GET /api/correlation-web/dynamics?market=US\|IN` | rolling regime metrics |
| `GET /api/correlation-web/pair?market=&a=&b=&days=` | rolling pair correlation and CCF |
| `GET /api/correlation-web/events?market=&symbol=` | event study (unchanged) |
| `GET /api/correlation-web?market=&days=&mode=` | legacy threshold web, used by the dashboard preview |

Results are cached for 10 minutes per market, window, basis and estimator.

## Validation

`npm run validate:web` runs the engine on synthetic markets with planted
structure and checks that it recovers it: the Jacobi eigensolver against
A v = λ v; exactly the planted eigen-modes above λ+; perfect cluster recovery
of three planted sectors; MST and TMFG edge counts and within-sector share;
bootstrap reliabilities; partial correlation removing an indirect A–C link in
an A → B → C chain; no structure claimed on pure noise; a planted stress
window flagged as coupled with a contracting tree; and a planted one-day lead
found by the cross-correlation.
