---
target: dashboard widlyiq (src/app/page.tsx)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/odata/PRZ/Techniki_analizy_danych/widlyiq/src/app/page.tsx"
target_fingerprint: "sha256:200404c1b70c305c219c5e572012ba19c5756f8268f614e1b2ee0c31d4d06794"
target_path: /home/odata/PRZ/Techniki_analizy_danych/widlyiq/src/app/page.tsx
timestamp: 2026-10-27T14-19-49Z
slug: src-app-page-tsx
closed: true
---
Method: dual-agent (A: design review sub-agent · B: detector and browser sub-agent)

# Critique: WidlyIQ dashboard (src/app/page.tsx and four views)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Live run streams well; on non-ETL views a finished run ends silently; failure shows only in the ribbon status, hidden below 1024 px. |
| 2 | Match System / Real World | 3 | Market headline is exemplary plain Polish; jargon leaks: Bias, Lift/Jaccard undefined, Tier, "Ostatni run", "Live z fallbackiem", "Podk.". |
| 3 | User Control and Freedom | 2 | URL filters and reset work; estimator stack is component state, lost on tab switch or reload; a run cannot be cancelled. |
| 4 | Consistency and Standards | 2 | Visual system near perfect; meanings drift: P50 17 700 vs 17 675, Polska 19 400 vs 19 350 zł, Outliery vs IQR, run vs przebieg. |
| 5 | Error Prevention | 2 | MIN_SAMPLE 10 and imputed exclusion exemplary; estimator prints an 88 px figure for a zero-offer profile; DB-rewriting run is one unconfirmed click. |
| 6 | Recognition Rather Than Recall | 3 | Legends and tooltips work; below 1280 px the ribbon shows bare counts; heatmap clusters are numbers named only below the matrix. |
| 7 | Flexibility and Efficiency | 2 | Clickable ranking rows, lanes, pair pinning, export; no skip link (14 Tab stops before the first filter), no shortcuts. |
| 8 | Aesthetic and Minimalist Design | 3 | One job per panel; noise in edge states (7 rows "n 0 · za mało ofert", 40 chips, near-empty 40x40 matrix). |
| 9 | Error Recovery | 2 | Market empty states excellent; pipeline errors are the last stderr line with no next step; 409 also reads "przerwany". |
| 10 | Help and Documentation | 3 | Subtitles and caveats well placed; Lift, Jaccard, Tier S/A/B/C, "płotki" undefined where they appear. |
| Total | | 25/40 | Acceptable (upper end) |

## Design Specificity Verdict

LLM: authored for the product in the shell and Market view (telemetry console, pipeline ribbon with loss notches and stage deep links, IQR-rejected lane, plain-language percentile sentence). Specificity drops in Estymator (generic calculator layout) and Skill Graph (generic 40x40 heatmap plus bubble scatter, no answer for the developer). Missed opportunity: the proof idea stops at the ribbon; figures do not lead back to their offers.

Deterministic scan: impeccable detect on src gives 0 findings (also with --no-config and --no-inline-ignores). Rendered scans: only the advisory flat-type-hierarchy on skills and estimator (desktop and 390). Partly real: the 19/16 ratio is a DESIGN.md decision, but Skill Graph has no visible answer sentence. The detector missed every data-reconciliation, state, error-path and SVG-size-at-1024 issue. No false positives. One market scan crashed (scanner browser), retries clean. Also from B: the Raw vs Clean record title is an h3 at 24 px, larger than the 19 px h2 panel titles.

Overlays: detect.js injected on all four views in headless Chromium; no user-visible [Human] tab. Console matched the CLI.

## Overall Impression

Market is strong: the sentence answers before the chart and statistical honesty shows everywhere. Weakest where the evaluator will check at the defense: numbers that disagree across panels, an estimator that answers where data is absent, and a weak end of a pipeline run.

## What's Working

1. Ribbon plus rejected lane make the transformation visible (loss notches, tooltips, cross-highlight, #etap deep links, hollow red rings with reasons).
2. Statistical honesty: n 10 threshold, imputed rows excluded from percentiles and said so, concrete widen actions on empty profiles.
3. "Skąd ta kwota" makes the linear model legible; parts add up exactly to the estimate (21 220 to 18 193 zł verified).

## Priority Issues

[P1] Numbers do not reconcile across panels and filter scope is invisible. Field rounds P50 to hundreds (17 700, Polska 19 400) next to exact 17 675 and 19 350; IQR chart "zachowane 1031" vs ribbon "1 171 czystych" with no note that 1 031 = 1 171 − 140 imputed; Bias portali (market-analytics/queries.ts:126-147) ignores all filters and includes imputed rows while saying "za ten sam profil"; Skill Graph region filter only changes the orange rings. Fix: one rounding rule per figure or "≈"; caption "1 031 ofert z widełkami, bez 140 uzupełnionych"; Bias follows filters or says "cały zbiór"; Skill Graph footer "macierz i mediany: cała Polska". Command: /impeccable clarify.

[P1] Estymator answers confidently where data is absent and forgets the stack. Lead · Mobile · UoP · Podkarpackie shows 27 912 zł while Market has zero offers; "Typowy zakres" is estimate ± global MAE for every profile; stack lives in useState (EstimatorWorkbench.tsx:33) and resets on navigation. Fix: "Podobnych ofert w danych: N", caution state below N 10 with a link to Market, rename to "Błąd modelu ±3 279 zł", profile and skills in the URL. Command: /impeccable harden.

[P1] At 1024 px the evidence layer falls below the system's 13 px floor. Skill Graph heatmap labels 9.7 px, scatter 8.7-9.4 px; field meta labels are 12 units (11 px at 1024, 11.6 px at 1440); ribbon shows bare counts below 1280 px; ETL stage list wraps numbers ("93 / ms"). The last polish fixed the field geometry but missed Skill Graph. Fix: MEDIUM geometry for Skill Graph charts, field meta 12 to 14 units, two-line ribbon cells between 1024 and 1279 px, stage counts under the description below 1280 px. Command: /impeccable adapt.

[P2] End and failure of a pipeline run at the defense. Raw stderr after "Przebieg przerwany:" (RunToolbar.tsx:26), 409 also "przerwany"; after an error the ribbon stays half-filled (PipelineRibbon.tsx:22) over panels from the previous run; invisible below 1024 px outside ETL Lab; success ends with only a new timestamp. Fix: Polish messages with an action ("Uruchom w trybie snapshot"), ribbon returns to the last committed run with a "ostatni przebieg nieudany" flag, one-line summary on every view. Command: /impeccable harden.

[P2] Keyboard and screen-reader gaps. Offer-field lane buttons have outline-none (OfferField.tsx:102-103), focus invisible (WCAG 2.4.7); selects focus is a 1 px border change; ribbon links read "178", "+140" below 1280 px; no skip link; estimator readout aria-live plus spring re-announces. Fix: 2 px signal-ink stroke on :focus-visible, global outline on selects, aria-label with stage name, skip link, aria-live after the spring settles. Command: /impeccable audit.

## Persona Red Flags

Alex (power user): cannot bookmark or share a stack; 14 Tab stops before the first filter; Bias portali unchanged after Senior to Mid, concludes the panel is broken.

Sam (keyboard, screen reader): no visible focus on field lanes; hears "link, 178"; cannot reach any offer or rejected record (pointer-only tooltips); mobile tabs 30 px, seniority options 28 px.

Evaluator at the defense (1024x768 projector): unlabeled ribbon numbers, 9 px chart text in Skill Graph; 17 700 vs 17 675 and 1 031 vs 1 171 unexplained; Raw vs Clean "Co zmienił pipeline" lists 2 changes while umowa, region and kategoria also changed and are not highlighted (DiffInspector.tsx:104-110); dedupe sample gives only the kept title; asks "on what data?" for 27 912 zł on an empty profile.

## Minor Observations

- Next.js dev badge covers the "Senior" lane label; use next start or devIndicators false at the defense.
- Region abbreviations via slice(0, 4): "Mało. 12" reads as "few".
- Empty ranking shows 7 rows "n 0 · za mało ofert"; zero should read "brak", one sentence is enough.
- "Każda umowa" mixes B2B netto and UoP brutto with no caveat.
- "Co podniesie szacunek" grid shows a grey empty cell with an odd count.
- Raw keys in copy: "seniority c_level → lead", "fullstack × junior × b2b", double colon "odrzucona: IQR: poniżej…".
- Native blue clear button on the search input.
- Two skills with identical coordinates share one dot with two stacked labels (Swift, TypeScript under narrow filters); text does not overlap but the dot is ambiguous.
- Known and accepted, noted only: violet schema stage, blank band under "Źródła danych", 36 px controls, 0.4 s spring; at 1024 px the stacked estimator readout pushes "Skąd ta kwota" below the fold.

## Questions to Consider

1. Why is the database-rewriting "Uruchom pipeline" the one orange action on every view? What if only ETL Lab owned the run?
2. What if the estimate were a marker inside the Market offer field, among real offers for that profile?
3. What question does Skill Graph answer for a developer from Rzeszów? Would "pick your technology, see its partners, premium and Podkarpackie demand" beat a 40x40 matrix?
4. Why can't "38 ofert" or a ranking row open those offers and the stages that touched them?
