'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type PointerEvent } from 'react'

import { PORTAL_LABELS, SENIORITY_LABELS, toSearch, type Filters, type Seniority } from '@/shared/lib/filters'
import { formatNumber, formatPLN, formatRegion } from '@/shared/lib/formatters'

import type { FieldLayout } from './field'
import { FIELD } from './field'

type Hover = { kind: 'offer' | 'rejected'; i: number; cx: number; cy: number }

const k = (v: number) => `${formatNumber(Math.round(v / 100) * 100)}`

export function OfferField({ layout, filters }: { layout: FieldLayout; filters: Filters }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [hover, setHover] = useState<Hover | null>(null)
  const { width, height, lanes, ticks, radius } = layout
  const regionName = filters.region === 'polska' ? 'Polska' : formatRegion(filters.region)
  const plotBottom = lanes.length * FIELD.laneHeight

  const select = (s: Seniority) =>
    startTransition(() => router.push(toSearch('market', filters, { seniority: s }), { scroll: false }))

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const t = e.target as SVGElement
    const i = t.dataset.i
    if (i === undefined) return setHover(null)
    setHover({ kind: t.dataset.k as Hover['kind'], i: Number(i), cx: Number(t.getAttribute('cx')), cy: Number(t.getAttribute('cy')) })
  }

  const detail = hover && (hover.kind === 'offer' ? layout.offers[hover.i] : layout.rejected[hover.i])

  return (
    <div className="relative overflow-x-auto px-2 pb-1">
      <div className="relative min-w-[720px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" onPointerMove={onMove} onPointerLeave={() => setHover(null)}
          role="img" aria-label={`Pole ofert: ${layout.total} ofert na osi płac w czterech poziomach seniority`}>
          {ticks.map((t) => (
            <g key={t.value}>
              <line x1={t.x} x2={t.x} y1={0} y2={plotBottom} className="stroke-seam" strokeWidth={1} />
              <text x={t.x} y={plotBottom + 22} textAnchor="middle" className="fill-ink-2 text-[13px] tnum">{formatNumber(t.value / 1000)} tys.</text>
            </g>
          ))}
          <text x={FIELD.plotRight} y={plotBottom + 38} textAnchor="end" className="fill-ink-2 text-[12px]">zł / mies.</text>
          <line x1={FIELD.rejLeft - 14} x2={FIELD.rejLeft - 14} y1={0} y2={plotBottom} className="stroke-seam" strokeWidth={1} />
          <text x={(FIELD.rejLeft + FIELD.rejRight) / 2} y={plotBottom + 38} textAnchor="middle" className="fill-stage-iqr text-[12px] font-semibold">Odrzucone IQR</text>
          <text x={FIELD.rejLeft} y={plotBottom + 22} className="fill-ink-2 text-[12px]">nisko</text>
          <text x={FIELD.rejRight} y={plotBottom + 22} textAnchor="end" className="fill-ink-2 text-[12px]">wysoko</text>

          {lanes.map((l) => {
            const active = l.seniority === filters.seniority
            const bandY = l.top + 28
            return (
              <g key={l.seniority}>
                <line x1={0} x2={width} y1={l.top + FIELD.laneHeight} y2={l.top + FIELD.laneHeight} className="stroke-seam" />
                <g role="button" tabIndex={0} aria-pressed={active} aria-label={`Pokaż poziom ${SENIORITY_LABELS[l.seniority]}`}
                  className="cursor-pointer outline-none" onClick={() => select(l.seniority)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select(l.seniority)}>
                  <rect x={0} y={l.top + 70} width={82} height={34} className={active ? 'fill-carbon' : 'fill-transparent'} />
                  <text x={10} y={l.top + 93} className={`text-[17px] font-bold ${active ? 'fill-paper' : 'fill-ink'}`}>{SENIORITY_LABELS[l.seniority]}</text>
                </g>
                <text x={10} y={l.top + 120} className="fill-ink-2 text-[12px] tnum">
                  n {formatNumber(l.n)}{filters.region !== 'polska' ? ` · ${regionName.slice(0, 4)}. ${formatNumber(l.nRegion)}` : ''}
                </text>

                {l.national && (
                  <g>
                    <line x1={l.national.x} x2={l.national.x} y1={bandY + 13} y2={bandY + 23} className="stroke-ink-2" strokeWidth={2} />
                    {active && <text x={l.national.x + 6} y={bandY + 23} className="fill-ink-2 text-[12px] tnum">Polska {k(l.national.value)}</text>}
                  </g>
                )}
                {l.region ? (
                  <g>
                    {l.region.p10 && l.region.p90 && (
                      <>
                        <line x1={l.region.p10.x} x2={l.region.p90.x} y1={bandY} y2={bandY} className="stroke-signal" strokeWidth={3} />
                        <line x1={l.region.p10.x} x2={l.region.p10.x} y1={bandY - 6} y2={bandY + 6} className="stroke-signal" strokeWidth={2} />
                        <line x1={l.region.p90.x} x2={l.region.p90.x} y1={bandY - 6} y2={bandY + 6} className="stroke-signal" strokeWidth={2} />
                        <text x={l.region.p10.x - 6} y={bandY - 8} textAnchor="end" className="fill-ink text-[12px] tnum">P10 {k(l.region.p10.value)}</text>
                        <text x={l.region.p90.x + 6} y={bandY - 8} className="fill-ink text-[12px] tnum">P90 {k(l.region.p90.value)}</text>
                      </>
                    )}
                    <rect x={l.region.p50.x - 2.5} y={bandY - 9} width={5} height={18} className="fill-signal stroke-carbon" strokeWidth={1} />
                    <text x={l.region.p50.x} y={bandY - 13} textAnchor="middle" className={`fill-ink tnum ${active ? 'text-[13px] font-bold' : 'text-[12px]'}`}>
                      P50 {k(l.region.p50.value)}
                    </text>
                  </g>
                ) : (
                  filters.region !== 'polska' && (
                    <text x={FIELD.labelWidth} y={bandY + 4} className="fill-ink-2 text-[12px]">
                      {regionName}: n = {l.nRegion}, poniżej progu 10, więc percentyle ukryte; kropki zostają
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
                  <circle key={`r${d.id}`} cx={d.cx} cy={d.cy} r={3.4} data-i={d.i} data-k="rejected" className="fill-paper stroke-stage-iqr" strokeWidth={1.4} />
                ))}
              </g>
            )
          })}
          {hover && <circle cx={hover.cx} cy={hover.cy} r={radius + 3} className="pointer-events-none fill-none stroke-carbon" strokeWidth={1.5} />}
        </svg>

        {hover && detail && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[300px] bg-carbon px-3 py-2 text-paper"
            style={{ left: `${(hover.cx / width) * 100}%`, top: `${(hover.cy / height) * 100}%`, transform: 'translate(-50%, calc(-100% - 12px))' }}
            role="status"
          >
            <p className="text-[14px] font-semibold leading-tight">{detail.title ?? 'Oferta bez tytułu'}</p>
            <p className="mt-1 text-[13px] text-dot-soft tnum">
              {formatPLN(detail.salary_pln_month)}
              {'reason' in detail ? ` · odrzucona: ${detail.reason}` : ` · ${[detail.company, detail.city ?? 'zdalnie', PORTAL_LABELS[detail.source]].filter(Boolean).join(' · ')}`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
