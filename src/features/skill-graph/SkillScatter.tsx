'use client'

import { useMemo, useState } from 'react'

import { formatNumber, formatPLN, formatSignedPLN } from '@/shared/lib/formatters'

import { usePairSelection } from './PairSelection'
import { offersLabel } from './plural'

import type { SkillNode } from './types'

type Point = SkillNode & { median: number; cx: number; cy: number; r: number; ring: number }
type Label = { skill: string; x: number; y: number; anchor: 'start' | 'end' }

type Geo = { W: number; H: number; M: { l: number; r: number; t: number; b: number }; font: number; labels: number }
// A phone gets its own coordinate system rather than a shrunken desktop chart, so labels stay at a readable size.
const FULL: Geo = { W: 640, H: 460, M: { l: 62, r: 20, t: 26, b: 46 }, font: 12, labels: 10 }
const COMPACT: Geo = { W: 380, H: 400, M: { l: 52, r: 10, t: 26, b: 46 }, font: 11, labels: 6 }
const thousands = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 })
const LOG_TICKS = [5, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000]

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = (s.length - 1) / 2
  return (s[Math.floor(mid)] + s[Math.ceil(mid)]) / 2
}

/** Ten labels chosen for contrast: the most demanded, the best and worst paid, and the largest Ridge premiums. */
function pickLabelled(points: Point[], forced: string[], limit: number): Set<string> {
  const picked = new Set<string>(forced)
  const take = (list: Point[], n: number) => list.slice(0, n).forEach((p) => picked.size < limit + forced.length && picked.add(p.skill))
  take([...points].sort((a, b) => b.demand - a.demand), 3)
  take([...points].sort((a, b) => b.median - a.median), 3)
  take([...points].sort((a, b) => a.median - b.median), 2)
  take([...points].sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0)), 10)
  return picked
}

function placeLabels(points: Point[], picked: Set<string>, { W, M, font }: Geo): Label[] {
  const placed: { x0: number; x1: number; y: number }[] = []
  return points
    .filter((p) => picked.has(p.skill))
    .sort((a, b) => a.cy - b.cy)
    .map((p) => {
      const width = p.skill.length * 6.4 * (font / 12) + 4
      const fits = (side: 'r' | 'l') => {
        const x0 = side === 'r' ? p.cx + p.r + 5 : p.cx - p.r - 5 - width
        const inside = side === 'r' ? x0 + width < W - M.r : x0 > M.l
        // A label printed over another skill's dot reads as that skill's name, so prefer the clear side.
        const clear = !points.some((q) => q !== p && q.cx + q.r > x0 && q.cx - q.r < x0 + width && Math.abs(q.cy - p.cy) < q.r + 7)
        return inside && clear
      }
      const right = fits('r') || (!fits('l') && p.cx + p.r + 5 + width < W - M.r)
      const x = right ? p.cx + p.r + 5 : p.cx - p.r - 5
      const [x0, x1] = right ? [x, x + width] : [x - width, x]
      let y = p.cy + 4
      // Nudge downwards until the label clears every label already placed on overlapping columns.
      while (placed.some((q) => Math.abs(q.y - y) < 13 && q.x0 < x1 && x0 < q.x1)) y += 13
      placed.push({ x0, x1, y })
      return { skill: p.skill, x, y, anchor: right ? 'start' : 'end' }
    })
}

export function SkillScatter({ skills, regionLabel, compact = false }: { skills: SkillNode[]; regionLabel: string | null; compact?: boolean }) {
  const geo = compact ? COMPACT : FULL
  const { W, H, M } = geo
  const [active, setActive] = useState<string | null>(null)
  const { activeSkills } = usePairSelection()

  const model = useMemo(() => {
    const valid = skills.filter((s): s is SkillNode & { median: number } => s.demand > 0 && s.median != null)
    const dMin = Math.min(...valid.map((s) => s.demand)) * 0.8
    const dMax = Math.max(...valid.map((s) => s.demand)) * 1.25
    const step = Math.max(...valid.map((s) => s.median)) - Math.min(...valid.map((s) => s.median)) < 15000 ? 2500 : 5000
    const yMin = Math.floor((Math.min(...valid.map((s) => s.median)) - 1000) / step) * step
    const yMax = Math.ceil((Math.max(...valid.map((s) => s.median)) + 1000) / step) * step
    const x = (d: number) => M.l + ((Math.log(d) - Math.log(dMin)) / (Math.log(dMax) - Math.log(dMin))) * (W - M.l - M.r)
    const y = (v: number) => H - M.b - ((v - yMin) / (yMax - yMin)) * (H - M.t - M.b)
    const wMax = Math.max(1, ...valid.map((s) => Math.abs(s.weight ?? 0)))
    const rMax = Math.max(1, ...valid.map((s) => s.regionDemand))
    const points: Point[] = valid.map((s) => {
      const r = 3.5 + 9 * Math.sqrt(Math.abs(s.weight ?? 0) / wMax)
      return { ...s, cx: x(s.demand), cy: y(s.median), r, ring: s.regionDemand > 0 ? r + 2.5 + 8 * Math.sqrt(s.regionDemand / rMax) : 0 }
    })
    const yTicks: number[] = []
    for (let v = yMin; v <= yMax; v += step) yTicks.push(v)
    const inRange = LOG_TICKS.filter((t) => t >= dMin && t <= dMax)
    // Keep about six ticks whatever the range, so a narrow filter still gets a readable axis.
    const stride = Math.max(1, Math.ceil(inRange.length / 6))
    return {
      points, x, y, yTicks,
      xTicks: inRange.filter((_, i) => i % stride === 0),
      guide: { x: x(median(valid.map((s) => s.demand))), y: y(median(valid.map((s) => s.median))) },
    }
  }, [skills, W, H, M])
  const labels = useMemo(() => placeLabels(model.points, pickLabelled(model.points, activeSkills, geo.labels), geo), [model.points, activeSkills, geo])

  if (model.points.length === 0) {
    return <p className="px-5 pb-6 text-[15px] text-ink-2">Za mało ofert z widełkami w tym filtrze, żeby policzyć mediany technologii.</p>
  }

  const hovered = model.points.find((p) => p.skill === active) ?? null
  const plotRight = W - M.r
  const plotBottom = H - M.b

  return (
    <div className="px-3 pb-2">
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label="Popyt na technologie a mediana płacy">
        <g className="t-table" fontSize={geo.font} fill="var(--color-ink-2)">
          {model.yTicks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={plotRight} y1={model.y(t)} y2={model.y(t)} stroke="var(--color-seam)" />
              <text x={M.l - 8} y={model.y(t) + 4} textAnchor="end">{`${thousands.format(t / 1000)} tys.`}</text>
            </g>
          ))}
          {model.xTicks.map((t) => (
            <text key={t} x={model.x(t)} y={plotBottom + 18} textAnchor="middle">{formatNumber(t)}</text>
          ))}
          <text x={M.l} y={M.t - 10} fill="var(--color-ink-2)">zł / mies., mediana</text>
          <text x={plotRight} y={H - 6} textAnchor="end">liczba ofert, skala log</text>
        </g>
        <line x1={M.l} x2={plotRight} y1={plotBottom} y2={plotBottom} stroke="var(--color-ink)" />
        {/* Medians of both axes split the plane into the four readings a job seeker cares about. */}
        <g stroke="var(--color-dot)" strokeDasharray="3 4">
          <line x1={model.guide.x} x2={model.guide.x} y1={M.t} y2={plotBottom} />
          <line x1={M.l} x2={plotRight} y1={model.guide.y} y2={model.guide.y} />
        </g>
        <g fontSize={11.5} fill="var(--color-ink-2)" className="t-table" aria-hidden>
          <text x={M.l + 6} y={M.t + 12}>rzadkie, lepiej płatne</text>
          <text x={plotRight - 6} y={M.t + 12} textAnchor="end">popularne, lepiej płatne</text>
          <text x={M.l + 6} y={plotBottom - 8}>rzadkie, słabiej płatne</text>
          <text x={plotRight - 6} y={plotBottom - 8} textAnchor="end">popularne, słabiej płatne</text>
        </g>
        {model.points.map((p) => {
          const positive = (p.weight ?? 0) >= 0
          const isActive = p.skill === active
          return (
            <g
              key={p.skill}
              tabIndex={0}
              role="img"
              aria-label={`${p.skill}: ${offersLabel(p.demand)}, mediana ${formatPLN(p.median)}, premia Ridge ${formatSignedPLN(p.weight ?? 0)}`}
              onPointerEnter={() => setActive(p.skill)}
              onPointerLeave={() => setActive((a) => (a === p.skill ? null : a))}
              onFocus={() => setActive(p.skill)}
              onBlur={() => setActive((a) => (a === p.skill ? null : a))}
              className="cursor-default outline-none"
            >
              {p.ring > 0 && <circle cx={p.cx} cy={p.cy} r={p.ring} fill="none" stroke="var(--color-signal)" strokeWidth={1} strokeOpacity={0.75} />}
              {activeSkills.includes(p.skill) && <circle cx={p.cx} cy={p.cy} r={(p.ring || p.r) + 4} fill="none" stroke="var(--color-ink)" strokeWidth={2} />}
              <circle cx={p.cx} cy={p.cy} r={Math.max(p.r, 8)} fill="transparent" />
              <circle
                cx={p.cx}
                cy={p.cy}
                r={p.r}
                fill={positive ? 'var(--color-ink)' : 'var(--color-paper)'}
                stroke="var(--color-ink)"
                strokeWidth={isActive ? 2.5 : 1.5}
              />
            </g>
          )
        })}
        <g className="t-table" fontSize={12.5} fontWeight={600} fill="var(--color-ink)" pointerEvents="none">
          {labels.map((l) => (
            <text key={l.skill} x={l.x} y={l.y} textAnchor={l.anchor} paintOrder="stroke" stroke="var(--color-paper)" strokeWidth={3}>
              {l.skill}
            </text>
          ))}
        </g>
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 w-[232px] bg-carbon px-3 py-2.5 text-paper"
          style={{
            left: `clamp(8px, calc(${(hovered.cx / W) * 100}% - 116px), calc(100% - 240px))`,
            top: `calc(${(hovered.cy / H) * 100}% ${hovered.cy < H * 0.4 ? `+ ${hovered.r + 12}px` : `- ${hovered.r + 12}px`})`,
            transform: hovered.cy < H * 0.4 ? undefined : 'translateY(-100%)',
          }}
          role="status"
        >
          <p className="text-[15px] font-bold">{hovered.skill}</p>
          <dl className="t-table mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-[13px] text-dot-soft">
            <dt>Popyt</dt><dd className="text-right text-paper">{offersLabel(hovered.demand)}</dd>
            <dt>Mediana</dt><dd className="text-right text-paper">{formatPLN(hovered.median)}</dd>
            <dt>P25 do P75</dt><dd className="text-right text-paper">{formatNumber(hovered.p25)} do {formatPLN(hovered.p75)}</dd>
            <dt>Premia Ridge</dt><dd className="text-right text-paper">{formatSignedPLN(hovered.weight ?? 0)}</dd>
            {regionLabel && <><dt>{regionLabel}</dt><dd className="text-right text-paper">{offersLabel(hovered.regionDemand)}</dd></>}
          </dl>
        </div>
      )}
    </div>
    </div>
  )
}
