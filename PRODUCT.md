# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Pinned by the user: Python 3 ETL (pandas, NumPy, scikit-learn, Matplotlib/Seaborn) writing one SQLite file (`data/widlyiq.db`), read by a Next.js 16 App Router dashboard (TypeScript, `better-sqlite3`). The dashboard triggers the pipeline through a Route Handler that spawns `python_etl/run_pipeline.py`.

## Users

Primary: the course evaluator (lecturer or committee, Politechnika Rzeszowska, "Techniki analizy danych") assessing a data-analysis project. Their job is to verify that every ETL and statistical step is real, correct, and traceable to the code that does it, and to judge the depth of the analysis.

Also primary, confirmed by the user: a typical IT specialist (for example a developer from Podkarpackie) who wants a plain answer to "how much is my stack worth here, and what would raise it". The dashboard must work for this person without any knowledge of ETL or statistics.

Secondary: recruiters and hiring engineers reading the project as a portfolio piece. Their job is to judge engineering and data skill in a few minutes.

The user asked for a middle path: the project shows off engineering and data skills like a portfolio, but heavy terminology and code that do not serve a usable function are a failure.

## Product Purpose

WidlyIQ (`widlyiq`) is a Polish tech compensation ETL and AI feature store. It ingests raw job-offer data from SOLID.Jobs, No Fluff Jobs and Just Join IT (JSON), NBP exchange-rate tables (XML) and GUS regional wage benchmarks (XLSX); validates, deduplicates, converts currencies, imputes gaps with group medians, rejects outliers (IQR / Z-Score), classifies offers into categories and income tiers S/A/B/C, builds a feature matrix (one-hot, ordinal, StandardScaler, co-occurrence X.T @ X), trains RidgeCV, and shows the results in four views: ETL Lab, Market Analytics, Skill Graph, Salary Estimator.

Success: during the defense the evaluator runs the pipeline live, sees every stage's row counts and diffs, and can trace any number on screen back to its stage, table and code anchor.

## Positioning

Not a salary listing site. A transparent pipeline where each transformation is inspectable: funnel counts per stage, raw versus clean diff, a rejected-outliers table, imputation flags, the diagnostic Matplotlib chart, and a code drawer that opens the exact source behind a stage. Market numbers are always read against GUS regional wages, with emphasis on Podkarpackie and Rzeszów.

## Operating Context

Built and worked on a laptop. Presented on a lecture-room projector during the project defense, read from a distance. The room network may be blocked, so the pipeline falls back to local snapshots (`python_etl/snapshots/`) and the demo must still run end to end.

## Capabilities and Constraints

- Four views: ETL Lab (pipeline run, funnel, raw vs clean inspector, diagnostic SVG, code drawer), Market Analytics (global filters, P10 to P90 percentiles, GUS regional comparison, portal bias), Skill Graph (demand vs salary scatter, co-occurrence heatmap), Salary Estimator (stack-based ML premium in PLN, GUS multiple, export of the feature matrix to CSV, JSON, XLSX).
- SQLite tables: `raw_ingestion_logs`, `offers_clean`, `offer_skills`, `ai_feature_matrix`, `rejected_outliers`, `skill_cooccurrence`, `gus_benchmarks`, `ml_feature_weights`.
- Hourly rates normalize to monthly with 168 h. Imputed values carry `is_imputed = 1`.
- UI copy: Polish, with technical terms left in English (pipeline, P90, IQR, one-hot, Ridge).
- Architecture: thin routes in `src/app`, one feature slice per view in `src/features`, primitives in `src/shared`.
- Code comments explain why, never what; Ctrl+F anchors such as `[filter-iqr]` mark key mechanisms.

## Brand Commitments

- Name: WidlyIQ, package `widlyiq`.
- Voice: precise, engineering-first, Polish with English terms of art.
- Category references named by the user: Linear, Vercel Analytics, Stripe Sigma ("Pro-Tool / Data Intelligence").
- Dials set by the user: DESIGN_VARIANCE 7, MOTION_INTENSITY 6, VISUAL_DENSITY 8, then lowered by the user after reviewing the sketch: density about 6, cleaner text structure, unnecessary elements removed.
- Bans set by the user: no AI gradients, no row of three equal cards, no em-dash, no placeholder names such as "Jane Doe".
- Candidate directions named by the user for the first round: A High-Contrast Quantitative Desk, B Editorial Statistical Lab, C Modern Cloud Telemetry.

## Evidence on Hand

None yet. Snapshot records (at least 1200, with deliberate anomalies and gaps) will be synthetic and must be labeled synthetic wherever a viewer could take them for live market data. No invented market statistics, salary reports or source claims. NBP and GUS are real public sources; a snapshot of them is labeled with its date.

## Product Principles

1. Useful first, impressive second: every screen answers a plain user question in plain words; the method, math and code sit one click deeper, never in the way.
2. Every number is traceable to its stage, table and code anchor.
3. Show the transformation, not only the result: removed, imputed and rejected rows are first-class data.
4. Demo-proof: the pipeline runs offline from snapshots and says which source it used.
5. Regional lens: national figures are read against GUS regional wages, Podkarpackie first.
6. Data provenance is always visible: live, snapshot or synthetic.

## Accessibility & Inclusion

Projector legibility: high contrast for text and data labels (WCAG AA as the floor), sizes readable from the back of a room, and colour never the only carrier of meaning in charts, since projectors shift and wash out hues.
