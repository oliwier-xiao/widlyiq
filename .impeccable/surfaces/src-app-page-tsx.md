---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/features"]
---

## Scope

Dashboard shell plus the four views, opening on Market Analytics (`/`, `?view=market`). Visitor mode: Operate. Other views (ETL Lab, Skill Graph, Salary Estimator) inherit this world.

## Audience and job

A typical developer asks "how much is my stack worth in my region" and gets a plain answer first. The course evaluator and recruiters go one layer deeper: pipeline ribbon, offer field, code drawer. Constraint: laptop plus lecture-room projector, synthetic snapshot data labeled.

## Direction contract

THESIS: Salaries read like telemetry: every offer is visible as a mark and every lost record is visible on the pipeline ribbon, so the answer comes with its proof. Refuses the KPI-tile row plus chart-cards template.

OWN-WORLD: Carbon #0F1110 top bar with the active tab as an inverted white plate; white work ground; 1px seams, no shadows, no cards; international orange (#FF5B1A) only for Podkarpackie and the answer readout field; grey offer dots for the rest of Poland; darkened syntax-derived stage colours only on the ribbon, trace and code drawer. Archivo variable (wide for titles, condensed for tables, huge condensed readout), Red Hat Mono only for code anchors.

STORY: The visitor reads the orange readout (median, GUS multiple, delta to Poland, n), sees their offers in the field, filters, then follows "Kod" or the ribbon into ETL Lab and the Python source.

FIRST VIEWPORT: Carbon bar 48px (wordmark, 4 tabs, provenance, primary "Uruchom pipeline" at right). Pipeline ribbon 36px full width. Filter toolbar. Left about 62%: offer field beeswarm in four seniority lanes plus a rejected lane. Right about 38%: orange readout on top, region ranking below, portals compact at bottom.

FORM: user-pinned variant C lightened with variant A's shell, then reduced to density 6 at the user's request (typeset plus distill); seed:6a5faefb7807a7ed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Signature interaction and motion

Pipeline ribbon: during a live run, segments fill left to right as stages stream from the Route Handler, counts tick, losses peel off; hovering a segment highlights the same stage across the trace, the ETL Lab funnel and the code drawer. Motion grammar: 150 to 250 ms strong ease-out for UI, springs only for the estimator readout and drawer drag, no page-load choreography, reduced motion respected.

## Density and type (user feedback after approval)

The approved sketch is too dense. Build at density about 6, not 8: one job per panel, one primary action, details behind "Pokaż w ETL Lab", "Kod" and expanders.
Type roles (Archivo, ratio about 1.2): readout 88px wdth 70 wght 800 tabular; page headline 22px wdth 100 wght 650; panel title 17px wdth 112 wght 700; body 16px; table and axis 14px wdth 82 tabular; meta 13px at >= 7:1 contrast; code 13px Red Hat Mono.
Cuts from the sketch: ribbon carries counts only (labels on hover and in ETL Lab); Polska percentile labels only P50, full P10/P50/P90 only on the selected lane; rejected lane shows a count, not ranges; readout drops the P10 to P90 range (the field shows it); region ranking shows top 5 plus Polska plus Podkarpackie with "Pokaż wszystkie 16"; provenance stated once in the bar and once per chart footer; no search field and no theme toggle in the first viewport; one "Kod" affordance per panel.

## Unresolved

Live portal endpoints may be blocked; the ribbon must show per-source live or snapshot.
