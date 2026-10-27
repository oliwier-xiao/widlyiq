'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type PointerEvent } from 'react'

import { PORTAL_LABELS, SENIORITY_LABELS, toSearch, type Filters, type Seniority } from '@/shared/lib/filters'
import { formatNumber, formatPLN, formatRegion, offersLabel } from '@/shared/lib/formatters'

import type { FieldLayout } from './field'

type Hover = { kind: 'offer' | 'rejected'; i: number; cx: number; cy: number }

// Exact values, like the readout beside the field: a P50 of 17 675 rounded to 17 700 looks like a different number.
const k = (v: number) => formatNumber(v)

// Measured Archivo advance per character, as a share of the font size: 0.48 regular, 0.54 bold, rounded up for safety.
const textWidth = (text: string, size: number, bold: boolean) => text.length * size * (bold ? 0.56 : 0.5)

// The stored reason starts with the rule that fired ("IQR: poniżej dolnego płotka"); the tooltip turns it into a phrase.
const rejectedWhy = (reason: string) =>
  reason.startsWith('IQR: ') ? `odrzucona przez IQR, ${reason.slice(5)}` : `odrzucona: ${reason}`

type BandText = { x: number; text: string }

/**
 * Each percentile label starts beside its own tick. A narrow band would stack P50 on top of P10 or P90,
 * so the outer labels step outward until they clear P50. Near the plot's edge there is no room to step into,
 * so P50 first slides inward far enough to leave its neighbours a place, and all three stay on one line.
 */
function bandLabels(
  region: NonNullable<FieldLayout['lanes'][number]['region']>,
  sizes: { p50: number; meta: number; bold: boolean; outer: boolean },
  minX: number,
  maxX: number,
) {
  const GAP = 6
  const p10Text = region.p10 && sizes.outer ? `P10 ${k(region.p10.value)}` : null
  const p90Text = region.p90 && sizes.outer ? `P90 ${k(region.p90.value)}` : null
  const w10 = p10Text ? textWidth(p10Text, sizes.meta, false) : 0
  const w90 = p90Text ? textWidth(p90Text, sizes.meta, false) : 0
  const p50Text = `P50 ${k(region.p50.value)}`
  const w50 = textWidth(p50Text, sizes.p50, sizes.bold)
  const x50 = Math.min(
    Math.max(region.p50.x, minX + (w10 ? w10 + GAP : 0) + w50 / 2),
    maxX - (w90 ? w90 + GAP : 0) - w50 / 2,
  )
  const p50: BandText = { x: x50, text: p50Text }
  // P10 is end-anchored and P90 start-anchored, so each x is the label's inner edge.
  const p10: BandText | null = p10Text && region.p10
    ? { x: Math.max(Math.min(region.p10.x - GAP, x50 - w50 / 2 - GAP), minX + w10), text: p10Text }
    : null
  const p90: BandText | null = p90Text && region.p90
    ? { x: Math.min(Math.max(region.p90.x + GAP, x50 + w50 / 2 + GAP), maxX - w90), text: p90Text }
    : null
  return { p10, p50, p90 }
}

export function OfferField({ layout, filters }: { layout: FieldLayout; filters: Filters }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [hover, setHover] = useState<Hover | null>(null)
  const { g, width, height, lanes, ticks, radius } = layout
  const regionName = filters.region === 'polska' ? 'Polska' : formatRegion(filters.region)
  const metaX = g.compact ? 6 : 10
  const plotBottom = lanes.length * g.laneHeight
  // Chart text sizes are in SVG units, so they scale with the chart's geometry like every other mark.
  const META = g.meta

  const select = (s: Seniority) =>
    startTransition(() => router.push(toSearch('market', filters, { seniority: s }), { scroll: false }))

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const t = e.target as SVGElement
    const i = t.dataset.i
    if (i === undefined) return setHover(null)
    setHover({ kind: t.dataset.k as Hover['kind'], i: Number(i), cx: Number(t.getAttribute('cx')), cy: Number(t.getAttribute('cy')) })
  }

  const detail = hover && (hover.kind === 'offer' ? layout.offers[hover.i] : layout.rejected[hover.i])
  // Above the first lane there is no room for the tooltip, so it flips below the dot; near the sides it slides inward.
  const below = hover ? hover.cy < 90 : false
  const fx = hover ? hover.cx / width : 0.5
  const shiftX = fx < 0.2 ? '-12%' : fx > 0.8 ? '-88%' : '-50%'

  return (
    <div className="relative px-2 pb-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" onPointerMove={onMove} onPointerDown={onMove}
        // A finger lifting fires pointerleave at once, so on touch the tooltip stays until the next tap elsewhere.
        onPointerLeave={(e) => e.pointerType !== 'touch' && setHover(null)}
        role="group" aria-label={`Pole ofert: ${offersLabel(layout.total)} na osi płac w czterech poziomach seniority`}>
        {ticks.map((t) => (
          <g key={t.value}>
            <line x1={t.x} x2={t.x} y1={0} y2={plotBottom} className="stroke-seam" strokeWidth={1} />
            {/* A phone keeps the ticks bare ("20") and names the unit once, or seven "tys." labels collide. */}
            <text x={t.x} y={plotBottom + 22} textAnchor="middle" fontSize={g.tick} className="fill-ink-2 tnum">
              {formatNumber(t.value / 1000)}{g.compact ? '' : ' tys.'}
            </text>
          </g>
        ))}
        <text x={g.plotRight} y={plotBottom + 40} textAnchor="end" fontSize={META} className="fill-ink-2">{g.compact ? 'tys. zł / mies.' : 'zł / mies.'}</text>
        <line x1={g.rejLeft - 12} x2={g.rejLeft - 12} y1={0} y2={plotBottom} className="stroke-seam" strokeWidth={1} />
        {/* End-anchored to the chart's edge so the caption never clips; a phone keeps "IQR" and lets the legend name it. */}
        <text x={width - 2} y={plotBottom + 40} textAnchor="end" fontSize={META} className="fill-stage-iqr font-semibold">
          {g.compact ? 'IQR' : 'Odrzucone IQR'}
        </text>
        {!g.compact && (
          <>
            <text x={g.rejLeft} y={plotBottom + 22} fontSize={META} className="fill-ink-2">nisko</text>
            <text x={g.rejRight} y={plotBottom + 22} textAnchor="end" fontSize={META} className="fill-ink-2">wysoko</text>
          </>
        )}

        {lanes.map((l) => {
          const active = l.seniority === filters.seniority
          const bandY = l.top + 28
          const box = l.top + g.dotCenter - 17
          const labels = l.region ? bandLabels(l.region, { p50: active ? g.p50 : META, meta: META, bold: active, outer: !g.compact }, 2, g.rejLeft - 16) : null
          return (
            <g key={l.seniority}>
              <line x1={0} x2={width} y1={l.top + g.laneHeight} y2={l.top + g.laneHeight} className="stroke-seam" />
              <g role="button" tabIndex={0} aria-pressed={active} aria-label={`Pokaż poziom ${SENIORITY_LABELS[l.seniority]}`}
                className="group cursor-pointer outline-none" onClick={() => select(l.seniority)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(l.seniority) } }}>
                {/* An SVG group draws no focus outline of its own, so keyboard focus gets a ring around the label plate. */}
                <rect x={1} y={box - 3} width={g.labelWidth - 12} height={40} className="fill-none stroke-signal-ink opacity-0 group-focus-visible:opacity-100" strokeWidth={2} />
                <rect x={0} y={box} width={g.labelWidth - 14} height={34} className={active ? 'fill-carbon' : 'fill-transparent'} />
                <text x={g.compact ? 6 : 10} y={box + 23} fontSize={g.name} className={`font-bold ${active ? 'fill-paper' : 'fill-ink'}`}>
                  {SENIORITY_LABELS[l.seniority]}
                </text>
              </g>
              <text x={metaX} y={box + 50} fontSize={META} className="fill-ink-2 tnum">{offersLabel(l.n)}</text>
              {/* The orange dot is the legend's mark for the chosen region, so the count needs no truncated region name. */}
              {filters.region !== 'polska' && (
                <g>
                  <circle cx={metaX + 3.5} cy={box + 53 + META - 5} r={3.5} className="fill-signal" />
                  <text x={metaX + 11} y={box + 53 + META} fontSize={META} className="fill-ink-2 tnum">
                    {formatNumber(l.nRegion)}<title>{`${regionName}: ${offersLabel(l.nRegion)}`}</title>
                  </text>
                </g>
              )}

              {l.national && (
                <g>
                  <line x1={l.national.x} x2={l.national.x} y1={bandY + 13} y2={bandY + 23} className="stroke-ink-2" strokeWidth={2} />
                  {active && !g.compact && <text x={l.national.x + 6} y={bandY + 23} fontSize={META} className="fill-ink-2 tnum">Polska {k(l.national.value)}</text>}
                </g>
              )}
              {l.region && labels ? (
                <g>
                  {l.region.p10 && l.region.p90 && (
                    <>
                      <line x1={l.region.p10.x} x2={l.region.p90.x} y1={bandY} y2={bandY} className="stroke-signal" strokeWidth={3} />
                      <line x1={l.region.p10.x} x2={l.region.p10.x} y1={bandY - 6} y2={bandY + 6} className="stroke-signal" strokeWidth={2} />
                      <line x1={l.region.p90.x} x2={l.region.p90.x} y1={bandY - 6} y2={bandY + 6} className="stroke-signal" strokeWidth={2} />
                      {!g.compact && (
                        <>
                          {labels.p10 && <text x={labels.p10.x} y={bandY - 8} textAnchor="end" fontSize={META} className="fill-ink tnum">{labels.p10.text}</text>}
                          {labels.p90 && <text x={labels.p90.x} y={bandY - 8} fontSize={META} className="fill-ink tnum">{labels.p90.text}</text>}
                        </>
                      )}
                    </>
                  )}
                  <rect x={l.region.p50.x - 2.5} y={bandY - 9} width={5} height={18} className="fill-signal stroke-carbon" strokeWidth={1} />
                  <text x={labels.p50.x} y={bandY - 13} textAnchor="middle" fontSize={active ? g.p50 : META} className={`fill-ink tnum ${active ? 'font-bold' : ''}`}>
                    {labels.p50.text}
                  </text>
                </g>
              ) : (
                filters.region !== 'polska' && (
                  <text x={g.labelWidth} y={bandY + 4} fontSize={META} className="fill-ink-2">
                    {`${g.compact ? '' : `${regionName}: `}${l.nRegion === 0 ? 'brak ofert' : `${offersLabel(l.nRegion)}, za mało na percentyle`}`}
                  </text>
                )
              )}

              <g>
                {l.dots.filter((d) => !d.hi).map((d) => (
                  <circle key={d.id} cx={d.cx} cy={d.cy} r={radius} data-i={d.i} data-k="offer" className="field-dot fill-dot" fillOpacity={0.7} />
                ))}
                {l.dots.filter((d) => d.hi).map((d) => (
                  <circle key={d.id} cx={d.cx} cy={d.cy} r={radius + 0.6} data-i={d.i} data-k="offer" className="field-dot fill-signal stroke-paper" strokeWidth={0.8} />
                ))}
              </g>
              {[...l.rejectedLow, ...l.rejectedHigh].map((d) => (
                <circle key={`r${d.id}`} cx={d.cx} cy={d.cy} r={g.compact ? 2.8 : 3.4} data-i={d.i} data-k="rejected" className="fill-paper stroke-stage-iqr" strokeWidth={1.4} />
              ))}
            </g>
          )
        })}
        {hover && <circle cx={hover.cx} cy={hover.cy} r={radius + 3} className="pointer-events-none fill-none stroke-carbon" strokeWidth={1.5} />}
      </svg>

      {hover && detail && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[280px] bg-carbon px-3 py-2 text-paper"
          style={{
            left: `${fx * 100}%`,
            top: `${(hover.cy / height) * 100}%`,
            transform: `translate(${shiftX}, ${below ? '14px' : 'calc(-100% - 12px)'})`,
          }}
          role="status"
        >
          <p className="t-control">{detail.title ?? 'Oferta bez tytułu'}</p>
          <p className="mt-1 t-meta text-dot-soft tnum">
            {formatPLN(detail.salary_pln_month)}
            {'reason' in detail ? ` · ${rejectedWhy(detail.reason)}` : ` · ${[detail.company, detail.city ?? 'zdalnie', PORTAL_LABELS[detail.source]].filter(Boolean).join(' · ')}`}
          </p>
        </div>
      )}
    </div>
  )
}
