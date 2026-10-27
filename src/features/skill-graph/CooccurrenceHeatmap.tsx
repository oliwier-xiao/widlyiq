'use client'

import { memo, useMemo, useState } from 'react'

import { CATEGORY_LABELS } from '@/shared/lib/filters'
import { formatNumber, formatPLN, formatSignedPLN, inOffers, offersLabel } from '@/shared/lib/formatters'

import { usePairSelection, type Cell } from './PairSelection'
import type { SkillNode, SkillPair } from './types'

type Metric = 'count' | 'lift' | 'jaccard'
type Max = Record<Metric, number>

const METRICS: { id: Metric; label: string }[] = [
  { id: 'count', label: 'Liczba ofert' },
  { id: 'lift', label: 'Lift' },
  { id: 'jaccard', label: 'Jaccard' },
]
const CELL = 15
const LEFT = 104
const TOP = 104
// Room on the right for the last rotated column labels, which otherwise clip at the edge.
const RIGHT = 56
const PAPER = [255, 255, 255]
const CARBON = [15, 17, 16]
const dec1 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dec2 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Single-hue ramp from paper to carbon: projectors shift hues, but they keep lightness order. */
function shade(t: number): string {
  const k = Math.min(1, Math.max(0, t))
  const c = PAPER.map((p, i) => Math.round(p + (CARBON[i] - p) * k))
  return `rgb(${c[0]} ${c[1]} ${c[2]})`
}

function intensity(metric: Metric, p: SkillPair, max: Max): number {
  if (metric === 'count') return Math.sqrt(p.count / max.count)
  if (metric === 'jaccard') return p.jaccard / max.jaccard
  // Lift below 1 means "less than chance"; the ramp starts at 1 so darker always reads as "travel together".
  return p.lift <= 1 ? 0 : Math.log(p.lift) / Math.log(max.lift)
}

function usePairIndex(skills: SkillNode[], pairs: SkillPair[], minPairCount: number) {
  return useMemo(() => {
    const n = skills.length
    const lookup = new Map(pairs.map((p) => [p.a * n + p.b, p]))
    const off = pairs.filter((p) => p.a !== p.b)
    const max: Max = {
      count: Math.max(1, ...off.map((p) => p.count)),
      jaccard: Math.max(0.01, ...off.map((p) => p.jaccard)),
      lift: Math.max(1.01, ...off.filter((p) => p.count >= minPairCount).map((p) => p.lift)),
    }
    const maxDemand = Math.max(1, ...pairs.filter((p) => p.a === p.b).map((p) => p.count))
    // Lift on two or three shared offers is noise, so the ranked list only trusts pairs with real support.
    const topPairs = off.filter((p) => p.a < p.b && p.count >= minPairCount).sort((x, y) => y.lift - x.lift).slice(0, 10)
    return { n, lookup, max, maxDemand, topPairs }
  }, [skills, pairs, minPairCount])
}

const Cells = memo(function Cells({ n, lookup, metric, max, maxDemand }: {
  n: number; lookup: Map<number, SkillPair>; metric: Metric; max: Max; maxDemand: number
}) {
  const rects = []
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const p = lookup.get(i * n + j)
      const x = LEFT + j * CELL
      const y = TOP + i * CELL
      if (i === j) {
        // The diagonal is demand, not a pair, so it gets its own mark: a grey square sized by offer count.
        const side = p ? Math.max(2, (CELL - 3) * Math.sqrt(p.count / maxDemand)) : 0
        rects.push(
          <g key={`${i}-${j}`}>
            <rect x={x} y={y} width={CELL} height={CELL} fill="var(--color-toolbar)" data-i={i} data-j={j} />
            {side > 0 && <rect x={x + (CELL - side) / 2} y={y + (CELL - side) / 2} width={side} height={side} fill="var(--color-dot)" data-i={i} data-j={j} />}
          </g>,
        )
      } else {
        rects.push(
          <rect key={`${i}-${j}`} x={x} y={y} width={CELL} height={CELL} data-i={i} data-j={j}
            fill={p ? shade(intensity(metric, p, max)) : 'var(--color-paper)'} />,
        )
      }
    }
  }
  return <>{rects}</>
})

function cellFrom(target: EventTarget): Cell | null {
  const el = target as SVGElement
  const i = el.dataset?.i
  const j = el.dataset?.j
  return i !== undefined && j !== undefined ? [Number(i), Number(j)] : null
}

export function CooccurrenceHeatmap({ skills, pairs, minPairCount }: { skills: SkillNode[]; pairs: SkillPair[]; minPairCount: number }) {
  const [metric, setMetric] = useState<Metric>('count')
  const { hover, pinned, active, setHover, togglePin } = usePairSelection()
  const { n, lookup, max, maxDemand } = usePairIndex(skills, pairs, minPairCount)
  const size = n * CELL
  const seams = skills.flatMap((s, i) => (i > 0 && s.cluster !== skills[i - 1].cluster ? [i] : []))
  const raw = [0, ...seams].map((start, k) => {
    const end = k < seams.length ? seams[k] : skills.length
    const label = skills[start].clusterLabel
    const members = skills.slice(start, end)
    const lead = [...members].sort((a, b) => b.demand - a.demand)[0]?.skill ?? ''
    return { n: k + 1, start, end, name: label ? CATEGORY_LABELS[label] ?? label : 'Inne', lead, members: members.map((x) => x.skill) }
  })
  // Several clusters can share a dominant category; the most demanded skill tells them apart ("Backend · Docker").
  const blocks = raw.map((b) => (raw.filter((o) => o.name === b.name).length > 1 ? { ...b, name: `${b.name} · ${b.lead}` } : b))
  const grid = (compact: boolean) => (
    <svg
      viewBox={compact ? `${LEFT - 1} ${TOP - 26} ${size + 2} ${size + 27}` : `0 0 ${LEFT + size + RIGHT} ${TOP + size + 4}`}
      className="block h-auto w-full"
      style={compact ? undefined : { maxWidth: LEFT + size + RIGHT }}
      role="img"
      aria-label={`Macierz współwystępowania ${n} technologii, miara: ${METRICS.find((m) => m.id === metric)?.label}. Lista najsilniejszych par jest obok.`}
    >
      {!compact && (
        <g className="t-chart" fontSize={14}>
          {skills.map((s, i) => {
            const on = active !== null && (active[0] === i || active[1] === i)
            const fill = on ? 'var(--color-ink)' : 'var(--color-ink-2)'
            return (
              <g key={s.skill}>
                <text x={LEFT - 6} y={TOP + i * CELL + 11} textAnchor="end" fill={fill} fontWeight={on ? 700 : 450}>{s.skill}</text>
                <text transform={`translate(${LEFT + i * CELL + 11} ${TOP - 6}) rotate(-60)`} fill={fill} fontWeight={on ? 700 : 450}>{s.skill}</text>
              </g>
            )
          })}
        </g>
      )}
      <g
        onPointerMove={(e) => {
          const c = cellFrom(e.target)
          if (c && (hover?.[0] !== c[0] || hover?.[1] !== c[1])) setHover(c)
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const c = cellFrom(e.target)
          if (c) togglePin(c)
        }}
        className="cursor-crosshair"
      >
        <Cells n={n} lookup={lookup} metric={metric} max={max} maxDemand={maxDemand} />
      </g>
      {/* Seams mark the flat cut of the clustering tree, so a white block reads as "these groups rarely meet", not missing data. */}
      <g pointerEvents="none" stroke="var(--color-carbon)" strokeWidth={1.5}>
        {seams.map((i) => (
          <g key={i}>
            <line x1={LEFT + i * CELL} x2={LEFT + i * CELL} y1={TOP} y2={TOP + size} />
            <line x1={LEFT} x2={LEFT + size} y1={TOP + i * CELL} y2={TOP + i * CELL} />
          </g>
        ))}
      </g>
      {!compact && (
        // Numbers in the right margin tie each block to its name in the legend, so the legend never repeats the axis labels.
        <g className="t-chart" fontSize={14} fontWeight={700} fill="var(--color-ink)" pointerEvents="none">
          {blocks.map((b) => (
            <text key={b.n} x={LEFT + size + 10} y={TOP + ((b.start + b.end) / 2) * CELL + 5}>{b.n}</text>
          ))}
        </g>
      )}
      {compact && (
        // Without axis labels on a phone, each cluster block carries its number from the legend below the grid.
        <g className="t-chart" fontSize={20} fontWeight={700} fill="var(--color-ink)" pointerEvents="none">
          {blocks.map((b) => (
            <text key={b.n} x={LEFT + ((b.start + b.end) / 2) * CELL} y={TOP - 7} textAnchor="middle">{b.n}</text>
          ))}
        </g>
      )}
      <rect x={LEFT} y={TOP} width={size} height={size} fill="none" stroke="var(--color-seam)" pointerEvents="none" />
      {active && (
        <g pointerEvents="none" fill="none">
          <rect x={LEFT} y={TOP + active[0] * CELL} width={size} height={CELL} stroke="var(--color-ink-2)" />
          <rect x={LEFT + active[1] * CELL} y={TOP} width={CELL} height={size} stroke="var(--color-ink-2)" />
          <rect x={LEFT + active[1] * CELL - 1} y={TOP + active[0] * CELL - 1} width={CELL + 2} height={CELL + 2}
            stroke="var(--color-ink)" strokeWidth={2} strokeDasharray={pinned ? undefined : '3 2'} />
        </g>
      )}
    </svg>
  )

  return (
    <div className="px-5 pb-2">
      <div role="radiogroup" aria-label="Miara współwystępowania" className="mb-3 inline-flex h-9 border border-seam bg-paper p-[3px]">
        {METRICS.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={metric === m.id} onClick={() => setMetric(m.id)}
            className={`px-3 t-control transition-colors duration-150 ${metric === m.id ? 'bg-carbon text-paper' : 'text-ink-2 hover:text-ink'}`}>
            {m.label}
          </button>
        ))}
      </div>
      {/* Desktop keeps 15 px cells with labels; a phone drops the labels so all 40 columns fit, and the pair panel names the tap. */}
      <div className="hidden md:block">{grid(false)}</div>
      <div className="md:hidden">{grid(true)}</div>
      <Legend metric={metric} max={max} />
      <ol className="mt-3 grid gap-y-1 border-t border-seam pt-3 t-meta md:flex md:flex-wrap md:gap-x-5" aria-label="Klastry technologii">
        {blocks.map((b) => (
          <li key={b.n} className="flex gap-2">
            <span className="w-4 shrink-0 font-bold text-ink tnum md:w-auto">{b.n}</span>
            {/* Desktop shows every name on the axes; a phone has no axis labels, so the members are listed here. */}
            <span><span className="font-semibold text-ink">{b.name}</span><span className="md:hidden">: {b.members.join(', ')}</span></span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Legend({ metric, max }: { metric: Metric; max: Max }) {
  const end = metric === 'count' ? offersLabel(max.count) : metric === 'lift' ? `${dec1.format(max.lift)}×` : dec2.format(max.jaccard)
  const start = metric === 'lift' ? '1× i mniej' : '0'
  return (
    <div className="t-meta mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="flex items-center gap-2">
        {start}
        <span className="flex" aria-hidden>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => <span key={t} className="size-3.5" style={{ background: shade(t), outline: '1px solid var(--color-seam)' }} />)}
        </span>
        {end}
      </span>
      <span className="flex items-center gap-2">
        <span className="grid size-3.5 place-items-center bg-toolbar" aria-hidden><span className="size-2 bg-dot" /></span>
        przekątna: popyt technologii
      </span>
    </div>
  )
}

export function PairPanel({ skills, pairs, minPairCount }: { skills: SkillNode[]; pairs: SkillPair[]; minPairCount: number }) {
  const { active, pinned, setPinned } = usePairSelection()
  const { n, lookup, topPairs } = usePairIndex(skills, pairs, minPairCount)

  return (
    <div className="grid gap-6 px-5 pb-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <Readout skills={skills} lookup={lookup} n={n} cell={active} pinned={pinned !== null} onUnpin={() => setPinned(null)} />
      <div>
        <h3 className="t-subhead">Najsilniejsze pary (lift)</h3>
        <p className="t-meta">Pary z co najmniej {minPairCount} wspólnymi ofertami.</p>
        {topPairs.length === 0 && (
          <p className="t-body mt-2 text-ink-2">W tym filtrze żadna para nie ma tylu wspólnych ofert. Poszerz filtr.</p>
        )}
        <ol className="mt-2 divide-y divide-seam border-y border-seam empty:hidden">
          {topPairs.map((p) => {
            const on = pinned?.[0] === p.a && pinned?.[1] === p.b
            return (
              <li key={`${p.a}-${p.b}`}>
                <button type="button" onClick={() => setPinned(on ? null : [p.a, p.b])} aria-pressed={on}
                  className={`flex w-full items-baseline justify-between gap-3 px-2 py-1.5 text-left t-table hover:bg-toolbar ${on ? 'bg-toolbar font-bold' : ''}`}>
                  <span className="truncate">{skills[p.a].skill} + {skills[p.b].skill}</span>
                  <span className="shrink-0 text-ink-2">{dec1.format(p.lift)}× · {formatNumber(p.count)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function Readout({ skills, lookup, n, cell, pinned, onUnpin }: {
  skills: SkillNode[]; lookup: Map<number, SkillPair>; n: number; cell: Cell | null; pinned: boolean; onUnpin: () => void
}) {
  if (!cell) {
    return (
      <div className="border-t border-seam pt-3">
        <p className="t-body text-ink-2">Najedź na komórkę albo wybierz parę z listy. Kliknięcie przypina parę.</p>
      </div>
    )
  }
  const [i, j] = cell
  const a = skills[i]
  const b = skills[j]
  const pair = lookup.get(i * n + j)
  let sentence: string
  if (i === j) {
    sentence = `${a.skill}: ${offersLabel(a.demand)}, mediana ${formatPLN(a.median)}, premia Ridge ${formatSignedPLN(a.weight ?? 0)}.`
  } else if (!pair) {
    sentence = `${a.skill} i ${b.skill} nie występują razem w żadnej ofercie.`
  } else {
    const relation = pair.lift >= 1.05
      ? `${dec1.format(pair.lift)} raza częściej niż przy niezależnym popycie`
      : pair.lift <= 0.95
        ? `rzadziej, niż wynikałoby z niezależnego popytu (lift ${dec1.format(pair.lift)})`
        : 'mniej więcej tak często, jak przy niezależnym popycie'
    sentence = `${a.skill} i ${b.skill} występują razem ${inOffers(pair.count)}, ${relation}; średnia płaca ${formatPLN(pair.meanSalary)}.`
  }
  return (
    <div className="border-t border-ink pt-3" aria-live="polite">
      <p className="t-body text-ink">{sentence}</p>
      {i !== j && pair && (
        <dl className="t-table mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-ink-2">
          <dt>Jaccard</dt><dd className="text-right text-ink">{dec2.format(pair.jaccard)}</dd>
          <dt>{a.skill} łącznie</dt><dd className="text-right text-ink">{offersLabel(a.demand)}</dd>
          <dt>{b.skill} łącznie</dt><dd className="text-right text-ink">{offersLabel(b.demand)}</dd>
        </dl>
      )}
      {pinned && (
        <button type="button" onClick={onUnpin} className="mt-3 t-control text-ink underline underline-offset-[3px]">
          Odepnij (Esc)
        </button>
      )}
    </div>
  )
}
