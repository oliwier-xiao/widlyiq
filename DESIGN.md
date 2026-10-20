---
name: WidlyIQ
description: Polish IT salaries read like telemetry, every number shown with the pipeline that produced it.
colors:
  carbon: "#0f1110"
  carbon-2: "#2a2d2b"
  paper: "#ffffff"
  toolbar: "#f3f4f1"
  seam: "#daddd6"
  ink: "#0f1110"
  ink-2: "#4a5059"
  ink-3: "#6b7069"
  dot: "#8b908a"
  dot-soft: "#c9ccc6"
  signal: "#ff5b1a"
  signal-ink: "#b83a0b"
  signal-wash: "#fff1ea"
  signal-rule: "#c2430f"
  signal-sub-ink: "#4a1d07"
  ok: "#136234"
  warn: "#8a3d06"
  warn-wash: "#fdf3e8"
  error: "#a11b15"
  live: "#3ccf74"
  stage-extract: "#2549b8"
  stage-schema: "#7432b8"
  stage-nbp: "#095a63"
  stage-impute: "#8a3d06"
  stage-iqr: "#a11b15"
  stage-tier: "#136234"
  stage-model: "#44505e"
typography:
  readout:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "88px"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
    fontVariation: "'wdth' 70"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.25
    fontVariation: "'wdth' 100"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
    fontVariation: "'wdth' 112"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontVariation: "'wdth' 100"
  table:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 450
    lineHeight: 1.35
    fontFeature: "tnum"
    fontVariation: "'wdth' 82"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    fontVariation: "'wdth' 90"
  control:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
  code:
    fontFamily: "Red Hat Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  none: "0px"
spacing:
  seam: "1px"
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "#ff6f36"
  button-primary-disabled:
    backgroundColor: "#ffb08c"
  button-primary-large:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "48px"
  button-solid:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
  button-solid-hover:
    backgroundColor: "{colors.carbon-2}"
  button-code:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "28px"
  button-code-hover:
    backgroundColor: "{colors.toolbar}"
  select:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "0 32px 0 12px"
    height: "36px"
  segmented:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "3px"
    height: "36px"
  segmented-selected:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.paper}"
  tab:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.dot-soft}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
  tab-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  app-bar:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.paper}"
    height: "48px"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "16px 20px"
  answer-readout:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    typography: "{typography.readout}"
    padding: "20px 24px"
  toolbar:
    backgroundColor: "{colors.toolbar}"
    padding: "10px 24px"
  ribbon:
    backgroundColor: "{colors.toolbar}"
    height: "44px"
  table-row-selected:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.paper}"
---

# Design System: WidlyIQ

## Overview

**Creative North Star: "The Telemetry Console"**

Every salary is a reading and every reading carries its proof. The system is a carbon instrument bar over a white work ground, divided by 1px seams into flat panels that tile edge to edge. Nothing floats, nothing is rounded, nothing casts a shadow. Depth comes from inversion: carbon plates hold the active tab, the selected seniority, the selected region row and the selected skill; white holds everything at rest.

Colour is a measuring device, not decoration. Grey offer dots carry the whole of Poland; international orange marks the visitor's answer (the readout field, Podkarpackie, the one primary action); seven darkened syntax-derived stage colours belong to the pipeline alone and appear only where a stage is named (ribbon, ETL Lab stage list, code drawer). One variable family, Archivo, carries every role by moving its width axis: condensed and huge for the readout, condensed for tables, wide for panel titles. Red Hat Mono appears only on code anchors and the drawer.

Light only, by decision: the dashboard is presented on a lecture-room projector and read from a distance. Density sits around 6: one job per panel, one primary action per view, detail behind "Kod", "Pokaż w ETL Lab" and expanders.

**Key Characteristics:**
- Carbon 48px bar, white ground, 1px seams painted by the grid gap, never by panels.
- Square corners everywhere (0px); no shadows, no cards, no gradients.
- Selection by inversion to a carbon plate (or a white plate on carbon).
- Orange is the answer and the action; stage colours are the pipeline; grey is everyone else.
- One width-axis family for all text roles; mono only for code.
- Motion runs only when data moves: a live pipeline run, a filter re-swarm, the drawer.

## Colors

A near-neutral, faintly green-grey world with one hot signal and a closed set of pipeline stage colours.

### Primary
- **International Signal Orange** (signal): the answer readout field, Podkarpackie dots and P10 to P90 band, the "Uruchom pipeline" primary button. Text on it is ink, never white. Snapshot provenance uses a hollow grey square and the filter-pending sweep is ink, so orange never means "status".
- **Burnt Signal Ink** (signal-ink): orange as text or line on white, where signal itself fails contrast: focus rings, code anchor tokens, the anchor line number in the drawer.
- **Signal Wash** (signal-wash): the highlighted anchor line in the code drawer.
- **Readout Rule** (signal-rule) and **Readout Sub-ink** (signal-sub-ink): the dividing rules and secondary text inside the orange readout. Secondary text on orange is a dark tint of the same hue, never grey.

### Secondary (stage colours)
- **Extract Blue** (stage-extract), **Schema Violet** (stage-schema, also dedupe), **NBP Teal** (stage-nbp), **Impute Rust** (stage-impute), **IQR Red** (stage-iqr), **Tier Green** (stage-tier), **Model Slate** (stage-model, the feature and model stages). One colour per mechanism; paper text sits on them on the ribbon. In the code drawer the same hues colour syntax (keyword, def, builtin, number, string), so a stage reads the same in UI and source. IQR Red also marks the rejected lane and its hollow dots.

### Tertiary (status)
- **Ok Green** (ok), **Warn Rust** (warn) with **Warn Wash** (warn-wash), **Error Red** (error): status text and inline notices. They share hexes with the tier, impute and IQR stage colours on purpose.
- **Live Green** (live): only the live-provenance square in the carbon bar.

### Neutral
- **Carbon** (carbon): the app bar, drawer header, tooltips, selected plates, solid buttons. **Carbon Lift** (carbon-2): hover on carbon and dividers inside the bar.
- **Paper** (paper): the work ground and panel fill. **Toolbar Grey** (toolbar): ribbon and filter bar ground, row hover, skeletons.
- **Seam** (seam): every 1px divider and control border.
- **Ink** (ink), **Ink 2** (ink-2, meta text at 7:1 or better on paper and toolbar), **Ink 3** (ink-3, line numbers only).
- **Offer Dot** (dot, at 70% opacity) and **Soft Dot** (dot-soft): Poland-wide offer marks, inactive ranking bars, muted text on carbon.

### Named Rules
**The Answer Is Orange Rule.** Signal orange marks only what belongs to the visitor: their answer, their region, their one action. Anything else that turns orange dilutes the reading.

**The Stage Colour Rule.** Stage colours appear only where a pipeline stage is named. They never decorate a chart about the market.

**The Same-Hue Ink Rule.** Secondary text on a saturated field is a dark tint of that field's hue, not grey.

## Typography

**Display Font:** Archivo variable with the wdth axis (fallback ui-sans-serif, system-ui)
**Body Font:** Archivo (same family)
**Label/Mono Font:** Red Hat Mono (fallback ui-monospace), code only

**Character:** One grotesque stretched and squeezed into every job: the readout is a condensed numeric slab, panel titles go wide and confident, tables condense so columns stay tight on a projector. The mono is a precise lab label, never a style.

### Hierarchy
- **Readout** (800, 88px, line-height 0.88, wdth 70, tabular, -0.02em): the one answer number per view (median, estimate).
- **Headline** (650, 22px, 1.25, wdth 100): the plain-language sentence that opens a view, up to 78ch.
- **Title** (700, 17px, 1.2, wdth 112): panel titles and the readout's profile line.
- **Body** (400, 16px, 1.5): explanations; supporting prose at 15px ink-2 up to 68ch.
- **Control** (600, 15px): tabs, segmented options, select values, primary button.
- **Table** (450, 14px, 1.35, wdth 82, tabular): table rows, axis labels, ribbon labels on desktop.
- **Label / Meta** (500, 13px, 1.4, wdth 90, ink-2): subtitles, column heads, footers, provenance.
- **Code** (400, 13px Red Hat Mono, 1.55): anchors like `[filter-iqr]`, file paths, the drawer.

Secondary figures inside the readout use 26px, weight 800, wdth 90, tabular. The wordmark is 19px, weight 800, wdth 125, -0.01em.

### Named Rules
**The Role Not Size Rule.** Type is applied by role (readout, headline, panel, table, meta, code). Retune a role; never hand-set a new size for one screen.

**The Width Axis Rule.** Hierarchy moves on width as much as weight: numbers condense, titles widen. Do not add a second sans family.

**The Polish Numerals Rule.** Every number goes through the pl-PL formatters: always-on grouping with a narrow space ("8 196"), decimal comma, true minus "−", "zł" after the value, "×" for GUS multiples, "brak danych" for missing values. All numerals in tables and readouts are tabular.

## Layout

Full-bleed, edge-to-edge. Stack from top: sticky carbon bar (48px), pipeline ribbon (44px, including a 6px loss-notch row), filter toolbar (toolbar grey, 10px by 24px padding, 8px gaps), then a seam grid of panels. Desktop views split two columns at lg: Market about 1.6fr to minmax(400px, 1fr), ETL Lab 1.7fr to minmax(320px, 1fr), Skill Graph 1.25fr to 1fr, Estimator 0.92fr to 1.08fr. Below lg everything stacks; on phones the tabs drop to their own scrolling row under the wordmark and ribbon segments show counts only.

Spacing is a 4px rhythm: panel headers 16px top by 20px sides, body gaps 8 and 12px, readout 20px by 24px. Horizontal page gutter is 16px, 24px from lg.

**The Seam Grid Rule.** Panels sit in a grid with a 1px gap over a seam-coloured ground; the gap is the border. Panels themselves never draw borders.

## Elevation & Depth

Flat. There are no shadows anywhere in the system. Depth is conveyed by inversion (carbon plates against paper, a paper plate against carbon), by tonal steps (paper, toolbar grey) and by the 1px seam. The only layered surfaces are the code drawer (a full-height paper sheet over a carbon scrim at 30%) and carbon tooltips, and neither casts a shadow.

### Named Rules
**The No-Lift Rule.** Nothing rises off the page. If something needs emphasis, invert it or seam it off; never shadow it.

## Shapes

Square. Every corner in the system is 0px: buttons, selects, chips, tabs, panels, tooltips, the drawer, the provenance and legend squares. The only round forms are data: offer dots, rejected-lane hollow rings, the spinner. Markers that are not data (legend keys, stage keys, accent flags in selects) are small squares, 8 to 10px.

## Components

### Buttons
- **Shape:** square (0px).
- **Primary ("Uruchom pipeline"):** signal ground, ink text, 15px semibold, 36px tall with 16px sides; large variant 48px with 24px sides and 17px text. Phosphor play icon, filled. One per view; ETL Lab hides it because its run toolbar owns the action.
- **Hover / Active / Disabled:** hover lightens to #ff6f36, active scales to 0.97 over 150ms ease-out, busy shows a 14px spinner, the current stage name and a pale #ffb08c ground with a progress cursor.
- **Solid:** carbon ground, paper text, hover carbon-2. Used for filter-widening links in the readout and export buttons.
- **Code button ("Kod [anchor]"):** 28px tall, paper ground, seam border, Red Hat Mono 12px with the anchor in ink-2, code icon. Hover toolbar grey. One per panel.
- **Text action:** ink, underlined at 3px offset ("Pokaż w ETL Lab", "Przywróć domyślne", "Pokaż pozostałe").

### Chips (skill tokens)
- **Style:** paper ground, seam border, control-weight label with a small tabular premium in ink-2.
- **State:** selected inverts to carbon with paper text.

### Cards / Containers (panels)
- **Corner Style:** 0px.
- **Background:** paper.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none; the seam grid paints the divider.
- **Internal Padding:** header 16px by 20px with a title and optional meta subtitle; footer in meta 12px by 20px for provenance.

### Inputs / Fields
- **Select:** 36px, paper ground, seam border, meta label inline before a 15px semibold value, bold caret at right. A signal square flags Podkarpackie when selected. Focus moves the border to ink.
- **Segmented control (seniority):** 36px seam-bordered paper track with 3px inset; the chosen option is a carbon plate with paper text, others ink-2 turning ink on hover.
- **Focus (global):** 2px signal-ink outline, 2px offset.
- **Pending:** a 2px ink sweep runs along the bottom of the filter bar while a filter transition is in flight.

### Navigation
- **App bar:** carbon, 48px, sticky. Wordmark at left, tabs, provenance chip (seam-bordered square plus "Snapshot · dane syntetyczne"), primary action at right.
- **Tabs:** 15px semibold, soft-dot text turning paper on hover; the active tab is a paper plate with ink text. The plate moves instantly, only colour transitions (150ms).
- **Mobile:** tabs move to a second, horizontally scrolling row under a carbon-2 hairline.

### Pipeline Ribbon (signature)
Seven flat stage segments with 2px gaps on toolbar grey, each filled with its stage colour and a paper count label ("1 307 surowych", "−78 duplikaty"). Loss stages carry a notch in the 6px row below, its width scaled to the share of records dropped. Hover or focus outlines the segment in paper, highlights the same stage across the ETL Lab list and drawer, and shows a carbon tooltip with the anchor. During a live run, pending cells are grey, the running cell shows 45° moving stripes, and each finished cell fills left to right (320ms ease-out). At rest, nothing animates.

### Answer Readout (signature)
An orange field with the profile as a title, n at right, the 88px readout with its unit, a sentence of basis, and a two-cell grid of secondary figures divided by readout rules. Secondary text uses signal-sub-ink. A "Kod" button closes the field.

### Offer Field (signature)
A beeswarm of offers on a salary axis in four seniority lanes plus a rejected lane. Poland in grey dots at 70%, the selected region in signal dots with a paper stroke, rejected offers as hollow IQR Red rings. The selected lane label is a carbon plate; the regional P50 is a small signal bar with carbon stroke. Dots glide 200ms ease-out to new positions on a filter change.

### Code Drawer
A paper sheet up to 720px from the right over a 30% carbon scrim, with a carbon header (file path in mono, anchor in signal). Enters on a 320ms drawer curve (0.32, 0.72, 0, 1), exits in 180ms; reduced motion swaps to a fade. The anchor line gets a signal-wash band.

### Ranking and tables
Rows in table type on seam hairlines, grey bars, hover toolbar grey. The selected region inverts the full row to carbon with a signal bar; the Polska reference row uses a dashed ink-2 rule instead of a bar.

## Do's and Don'ts

### Do:
- **Do** tile panels in a seam grid with a 1px gap; let the grid draw every divider.
- **Do** mark selection by inversion: a carbon plate on paper, a paper plate on carbon.
- **Do** keep signal orange for the visitor's answer, region and single primary action, and set ink (not white) on it.
- **Do** colour a stage only with its stage token, and only where the stage is named.
- **Do** run every number through the pl-PL formatters with tabular figures, true minus and narrow-space grouping.
- **Do** keep motion to data events: 150 to 250ms ease-out (0.23, 1, 0.32, 1) for UI, a spring (0.4s, no bounce) only for the estimator readout count, and respect reduced motion.
- **Do** label synthetic or snapshot data wherever a figure could be taken for live market data: once in the bar and once per chart footer.

### Don't:
- **Don't** add shadows, rounded corners, cards, or gradients.
- **Don't** introduce a second sans family; move Archivo's width axis instead.
- **Don't** use Red Hat Mono for anything but code, anchors and file paths.
- **Don't** put grey text on the orange field; use signal-sub-ink.
- **Don't** add page-load choreography; a resting dashboard never animates.
- **Don't** add a dark theme; the system is light-only for the projector.
- **Don't** build a KPI-tile row or a row of three equal cards; one answer readout per view carries the figure.
