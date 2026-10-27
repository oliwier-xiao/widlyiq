---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/features"]
---

## Scope

Dashboard shell plus the four views, opening on Market Analytics (`/`, `?view=market`). Visitor mode: Operate. Other views (ETL Lab, Skill Graph, Salary Estimator) inherit this world.

## Audience and job

A typical developer asks "how much is my stack worth in my region" and gets a plain answer first. The course evaluator and recruiters go one layer deeper: pipeline ribbon, offer field, ETL Lab. Constraint: laptop plus lecture-room projector, synthetic snapshot data labeled.

## Direction contract

THESIS: Salaries read like telemetry: every offer is visible as a mark and every lost record is visible on the pipeline ribbon, so the answer comes with its proof. Refuses the KPI-tile row plus chart-cards template.

OWN-WORLD: Carbon #0F1110 top bar with the active tab as an inverted white plate; white work ground; 1px seams, no shadows, no cards; international orange (#FF5B1A) only for Podkarpackie and the answer readout field; grey offer dots for the rest of Poland; darkened stage colours only on the ribbon and in ETL Lab. Archivo variable (wide for titles, condensed for tables, huge condensed readout); no source code in the UI.

STORY: The visitor reads the orange readout (median, GUS multiple, delta to Poland, n), sees their offers in the field, filters, then follows the ribbon into ETL Lab, which explains each stage in plain words.

FIRST VIEWPORT: Carbon bar 48px (wordmark, 4 tabs, provenance at right; "Uruchom pipeline" lives only in ETL Lab, user decision 2026-10-27). Pipeline ribbon 36px full width. Filter toolbar. Left about 62%: offer field beeswarm in four seniority lanes plus a rejected lane. Right about 38%: orange readout on top, region ranking below, portals compact at bottom.

FORM: user-pinned variant C lightened with variant A's shell, then reduced to density 6 at the user's request (typeset plus distill); seed:6a5faefb7807a7ed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Signature interaction and motion

Pipeline ribbon: during a live run, segments fill left to right as stages stream from the Route Handler, counts tick, losses peel off; hovering a segment highlights the same stage in the ETL Lab funnel; a click opens ETL Lab at that stage. Motion grammar: 150 to 250 ms strong ease-out for UI, springs only for the estimator readout, no page-load choreography, reduced motion respected.

## Density and type (user feedback after approval)

The approved sketch is too dense. Build at density about 6, not 8: one job per panel, one primary action, details behind "Pokaż w ETL Lab" and expanders.
Type roles (Archivo, ratio about 1.2), retuned 2026-10-27 after the typeset pass for projector legibility: readout 88px wdth 70 wght 800 tabular; page headline 21 to 24px wdth 100 wght 650; panel title 19px wdth 112 wght 700; subhead 16px 700; body 16px; control 15px 600; table 15px wdth 84 tabular; meta 14px at >= 7:1 contrast; micro 13px is the floor.
Cuts from the sketch: below xl the ribbon carries counts only (labels on hover and in ETL Lab), from xl each count is named ("Duplikaty −78"); Polska percentile labels only P50, full P10/P50/P90 only on the selected lane; rejected lane shows a count, not ranges; readout drops the P10 to P90 range (the field shows it); region ranking shows top 5 plus Polska plus Podkarpackie with "Pokaż wszystkie 16"; provenance stated once in the bar and once per chart footer; no search field and no theme toggle in the first viewport.

## Code removed from the UI (user decision, 2026-10-27)

The code drawer, every "Kod [anchor]" button, anchors in tooltips, the raw JSON dump, internal record ids and column names in copy are gone: the app must be practical, not a show for the evaluator. Panels carry one short subtitle; marks are explained by legends.

## Copy pass (clarify, 2026-10-27)

Numbers reconcile across panels: exact percentiles everywhere, portal bias computed per profile from out-of-fold residuals stored per offer (so its counts sum to the readout's n), and footers name any filter a panel ignores. The transform log speaks the UI's Polish. User decision: portal bias follows the filters.

## Hardening (harden, 2026-10-27)

Run failures speak Polish and name a next step (busy, network, HTTP, Python missing, Python error at a named stage, timeout, cut stream), the ribbon resets to the last good run, success leaves a summary. The estimator shows its data support and warns below 10 offers, keeps profile and stack in the URL, and announces only the settled value. Keyboard: skip link, focus rings on selects, search and field lanes, named ribbon cells.

## Adaptation (adapt, 2026-10-27)

Target scene is a laptop and a 1024 to 1366px projector, phones second. Charts choose geometry by their panel's width so chart text stays at 13px or more from 390 to 1920px (it was 8.7px in the Skill Graph scatter and 10px in the field at 768 to 1024px). Skill Graph keeps the matrix on a full row until 1340px. The ribbon names its counts from 768px. Touch screens get 44px targets and tap-to-inspect.

## Layout (layout, 2026-10-27)

Seam grey no longer shows as a cell (odd suggestion spans the row, the Raw vs Clean list fills the detail's height), the record title in Raw vs Clean dropped below the panel title, and the Next dev badge is off because it covered the field's lane labels on a projector.

## Polish (polish, 2026-10-27)

Browser surfaces themed (caret, search clear button), a Polish error boundary for a failed database read with a retry, a missing-library hint for the most common first-run failure, and the field's axis captions no longer touch or clip in the MEDIUM and MOBILE geometries.

## Unresolved

Known and kept on purpose after the 2026-10-27 audit: the 88px readout and the orange readout field (one answer per view, read from a projector); the violet schema and dedupe stage colour (seven stages need seven distinct hues); blank bands under short panels (largest under "Źródła danych" in ETL Lab); 36px control height; the 0.4s estimator spring; client files over 150 lines (EstimatorWorkbench, CooccurrenceHeatmap, DiffInspector, SkillScatter) to split later.

Live portal endpoints may be blocked; the ribbon must show per-source live or snapshot.
