import type { Filters, Seniority } from '@/shared/lib/filters'
import { SENIORITIES } from '@/shared/lib/filters'
import { median, MIN_SAMPLE, percentiles, quantile } from '@/shared/lib/stats'

import type { OfferRow, RejectedRow } from './queries'

export type Geometry = {
  width: number; laneHeight: number; labelWidth: number; plotRight: number; rejLeft: number; rejRight: number
  axis: number; dotCenter: number; spread: number; maxRadius: number; tickStep: number; rejCols: number; rejGap: number; compact: boolean
  /** Text sizes in chart units: meta labels, axis ticks, lane names and the selected lane's P50. */
  meta: number; tick: number; name: number; p50: number
}
/**
 * Three geometries instead of one scaled SVG: a 900-unit chart shrunk to a phone turns 13 px labels into 5 px ones.
 * The page picks one by the width of the field's own container (MarketView switches at 600 and 830 px), each band
 * starting where its meta text reaches 13 px, so labels stay readable from a 390 px phone to a 1920 px projector.
 */
export const DESKTOP: Geometry = { width: 900, laneHeight: 214, labelWidth: 104, plotRight: 752, rejLeft: 784, rejRight: 888, axis: 46,
  dotCenter: 124, spread: 60, maxRadius: 3.4, tickStep: 5000, rejCols: 3, rejGap: 11, compact: false, meta: 14.5, tick: 14.5, name: 18, p50: 15.5 }
export const MEDIUM: Geometry = { width: 620, laneHeight: 196, labelWidth: 100, plotRight: 506, rejLeft: 530, rejRight: 612, axis: 46,
  dotCenter: 116, spread: 54, maxRadius: 3.1, tickStep: 10000, rejCols: 2, rejGap: 10, compact: false, meta: 14, tick: 14, name: 17, p50: 15 }
// 80 units of label column fit "452 oferty" at 14 under the level name without touching the leftmost dots.
export const MOBILE: Geometry = { width: 400, laneHeight: 150, labelWidth: 80, plotRight: 322, rejLeft: 342, rejRight: 396, axis: 46,
  dotCenter: 92, spread: 38, maxRadius: 2.6, tickStep: 10000, rejCols: 2, rejGap: 9, compact: true, meta: 14, tick: 14, name: 16, p50: 15 }
const MAX_DOTS = 2400

export type Dot = { cx: number; cy: number; hi: boolean; i: number; id: string }
export type Marker = { x: number; value: number }
export type Lane = {
  seniority: Seniority
  top: number
  n: number
  nRegion: number
  dots: Dot[]
  national: Marker | null
  region: { p10: Marker | null; p50: Marker; p90: Marker | null } | null
  rejectedLow: Dot[]
  rejectedHigh: Dot[]
}
export type FieldLayout = {
  g: Geometry
  width: number
  height: number
  lanes: Lane[]
  ticks: Marker[]
  radius: number
  offers: Pick<OfferRow, 'title' | 'company' | 'city' | 'salary_pln_month' | 'source'>[]
  rejected: Pick<RejectedRow, 'title' | 'salary_pln_month' | 'reason'>[]
  shown: number
  total: number
}

/** Greedy beeswarm: each dot takes the nearest vertical slot that does not overlap a neighbour already placed. */
function swarm(xs: number[], r: number, maxOffset: number): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0])
  const placed: { x: number; y: number }[] = []
  const ys = new Array<number>(xs.length).fill(0)
  const d = 2 * r + 0.4
  let start = 0
  for (const [x, i] of order) {
    while (start < placed.length && placed[start].x < x - d) start += 1
    const near = placed.slice(start)
    let chosen = 0
    for (let k = 0; k < 400; k += 1) {
      const y = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * (r * 1.05)
      if (Math.abs(y) > maxOffset) { chosen = Math.sign(y) * maxOffset; break }
      if (near.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= d * d)) { chosen = y; break }
    }
    placed.push({ x, y: chosen })
    ys[i] = chosen
  }
  return ys
}

function stride<T>(rows: T[], keep: (r: T) => boolean, limit: number): T[] {
  if (rows.length <= limit) return rows
  // Highlighted rows always survive; the rest are thinned with a fixed stride so redraws stay stable.
  const kept = rows.filter(keep)
  const rest = rows.filter((r) => !keep(r))
  const step = Math.ceil(rest.length / Math.max(1, limit - kept.length))
  return [...kept, ...rest.filter((_, i) => i % step === 0)]
}

export function layoutField(field: OfferRow[], rejected: RejectedRow[], f: Filters, g: Geometry = DESKTOP): FieldLayout {
  const isHi = (o: OfferRow) => f.region !== 'polska' && o.region === f.region
  const shownRows = stride(field, isHi, MAX_DOTS)
  const sorted = field.map((o) => o.salary_pln_month).sort((a, b) => a - b)
  const lo = Math.max(0, Math.floor((quantile(sorted, 0.003) ?? 0) / 5000) * 5000)
  const hi = Math.ceil((quantile(sorted, 0.997) ?? 50000) / 5000) * 5000
  const { width, laneHeight, labelWidth, plotRight, rejLeft, rejRight, axis } = g
  const x = (v: number) => labelWidth + ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo || 1)) * (plotRight - labelWidth)
  const busiest = Math.max(1, ...SENIORITIES.map((s) => shownRows.filter((o) => o.seniority === s).length))
  const radius = Math.min(g.maxRadius, Math.max(1.4, 3.6 - busiest / 260))
  const step = hi - lo > 50000 ? Math.max(10000, g.tickStep) : g.tickStep
  const shownIndex = new Map(shownRows.map((o, i) => [o, i]))
  const rejectedIndex = new Map(rejected.map((r, i) => [r, i]))

  const lanes: Lane[] = SENIORITIES.map((s, li) => {
    const top = li * laneHeight
    const cy = top + g.dotCenter
    const rows = shownRows.filter((o) => o.seniority === s)
    const ys = swarm(rows.map((o) => x(o.salary_pln_month)), radius, g.spread)
    const all = field.filter((o) => o.seniority === s).map((o) => o.salary_pln_month)
    const regional = f.region === 'polska' ? all : field.filter((o) => o.seniority === s && isHi(o)).map((o) => o.salary_pln_month)
    const pct = percentiles(regional)
    const nat = all.length >= MIN_SAMPLE ? median(all) : null
    const rej = rejected.filter((r) => r.seniority === s)
    const lanePct = all.length ? (quantile([...all].sort((a, b) => a - b), 0.5) ?? 0) : 0
    const toRejDots = (list: RejectedRow[], left: number) =>
      list.slice(0, g.rejCols * 6).map((r, k) => ({
        cx: left + (k % g.rejCols) * g.rejGap, cy: cy - 22 + Math.floor(k / g.rejCols) * 9, hi: false, i: rejectedIndex.get(r) ?? 0, id: r.offer_id,
      }))
    return {
      seniority: s,
      top,
      n: all.length,
      nRegion: regional.length,
      dots: rows.map((o, k) => ({ cx: x(o.salary_pln_month), cy: cy + ys[k], hi: isHi(o), i: shownIndex.get(o) ?? 0, id: o.offer_id })),
      national: nat === null ? null : { x: x(nat), value: nat },
      region: pct ? {
        p10: s === f.seniority ? { x: x(pct.p10), value: pct.p10 } : null,
        p50: { x: x(pct.p50), value: pct.p50 },
        p90: s === f.seniority ? { x: x(pct.p90), value: pct.p90 } : null,
      } : null,
      rejectedLow: toRejDots(rej.filter((r) => r.salary_pln_month < lanePct), rejLeft + 4),
      rejectedHigh: toRejDots(rej.filter((r) => r.salary_pln_month >= lanePct), (rejLeft + rejRight) / 2 + 4),
    }
  })

  const ticks: Marker[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push({ x: x(v), value: v })
  return {
    g,
    width,
    height: SENIORITIES.length * laneHeight + axis,
    lanes,
    ticks,
    radius,
    offers: shownRows.map(({ title, company, city, salary_pln_month, source }) => ({ title, company, city, salary_pln_month, source })),
    rejected: rejected.map(({ title, salary_pln_month, reason }) => ({ title, salary_pln_month, reason })),
    shown: shownRows.length,
    total: field.length,
  }
}
