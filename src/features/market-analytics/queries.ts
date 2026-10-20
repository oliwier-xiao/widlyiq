import 'server-only'

import { all, get, json } from '@/shared/db/sqlite'
import type { Filters, Seniority } from '@/shared/lib/filters'
import { median, MIN_SAMPLE, percentiles, type Percentiles } from '@/shared/lib/stats'

export type OfferRow = {
  offer_id: string
  title: string
  company: string | null
  city: string | null
  region: string | null
  seniority: Seniority
  salary_pln_month: number
  source: string
}

export type RejectedRow = { offer_id: string; title: string | null; seniority: Seniority; salary_pln_month: number; reason: string }

export type RegionRow = { region: string; median: number | null; n: number; gus: number; multiple: number | null }

export type PortalRow = {
  source: string
  n: number
  biasPct: number | null
  hourlyShare: number
  mode: 'live' | 'snapshot'
  reason: string | null
  synthetic: boolean
}

export type Answer = {
  n: number
  imputed: number
  pct: Percentiles | null
  nationalP50: number | null
  gus: number
  gusYear: number
}

export type MarketData = {
  field: OfferRow[]
  rejected: RejectedRow[]
  answer: Answer
  regions: RegionRow[]
  polska: RegionRow
  portals: PortalRow[]
}

type Scope = { sql: string; params: Record<string, string> }

// [sqlite-query] filter values arrive whitelisted from parseParams and still travel as bound parameters, never as SQL text
function scope(f: Filters, opts: { region?: boolean; seniority?: boolean; observedOnly?: boolean } = {}): Scope {
  const parts: string[] = []
  const params: Record<string, string> = {}
  // Imputed rows sit exactly on their group median; counting them would pull every percentile toward it.
  if (opts.observedOnly !== false) parts.push('is_imputed = 0')
  if (f.category !== 'all') { parts.push('category = @category'); params.category = f.category }
  if (f.contract !== 'all') { parts.push('contract = @contract'); params.contract = f.contract }
  if (f.portal !== 'all') { parts.push('source = @portal'); params.portal = f.portal }
  if (opts.region && f.region !== 'polska') { parts.push('region = @region'); params.region = f.region }
  if (opts.seniority) { parts.push('seniority = @seniority'); params.seniority = f.seniority }
  return { sql: parts.length ? parts.join(' AND ') : '1 = 1', params }
}

function gusWages(): { year: number; byRegion: Map<string, number> } {
  const rows = all<{ region: string; avg_gross_wage: number; year: number }>(
    'SELECT region, avg_gross_wage, year FROM gus_benchmarks WHERE year = (SELECT max(year) FROM gus_benchmarks)',
  )
  return { year: rows[0]?.year ?? 0, byRegion: new Map(rows.map((r) => [r.region, r.avg_gross_wage])) }
}

export function getMarketData(f: Filters): MarketData {
  const gus = gusWages()
  const gusOf = (region: string) => gus.byRegion.get(region) ?? gus.byRegion.get('polska') ?? 0

  const fieldScope = scope(f)
  const field = all<OfferRow>(
    `SELECT offer_id, title, company, city, region, seniority, salary_pln_month, source FROM offers_clean WHERE ${fieldScope.sql}`,
    fieldScope.params,
  )
  const rejParams: Record<string, string> = {}
  const rejParts = ["stage = 'filter-iqr'"]
  if (f.category !== 'all') { rejParts.push('category = @category'); rejParams.category = f.category }
  if (f.contract !== 'all') { rejParts.push('contract = @contract'); rejParams.contract = f.contract }
  if (f.portal !== 'all') { rejParts.push('source = @portal'); rejParams.portal = f.portal }
  const rejected = all<RejectedRow>(
    `SELECT offer_id, title, seniority, salary_pln_month, reason FROM rejected_outliers WHERE ${rejParts.join(' AND ')}`,
    rejParams,
  )

  const inLane = field.filter((o) => o.seniority === f.seniority)
  const regional = f.region === 'polska' ? inLane : inLane.filter((o) => o.region === f.region)
  const imputedScope = scope(f, { region: true, seniority: true, observedOnly: false })
  const imputed = get<{ n: number }>(
    `SELECT count(*) AS n FROM offers_clean WHERE is_imputed = 1 AND ${imputedScope.sql}`, imputedScope.params,
  )?.n ?? 0
  const answer: Answer = {
    n: regional.length,
    imputed,
    pct: percentiles(regional.map((o) => o.salary_pln_month)),
    nationalP50: inLane.length >= MIN_SAMPLE ? median(inLane.map((o) => o.salary_pln_month)) : null,
    gus: gusOf(f.region === 'zdalnie' ? 'polska' : f.region),
    gusYear: gus.year,
  }

  const byRegion = new Map<string, number[]>()
  for (const o of inLane) {
    if (!o.region || o.region === 'zdalnie') continue
    byRegion.set(o.region, [...(byRegion.get(o.region) ?? []), o.salary_pln_month])
  }
  const regionRow = (region: string, values: number[]): RegionRow => {
    const m = values.length >= MIN_SAMPLE ? median(values) : null
    const wage = gusOf(region)
    return { region, median: m, n: values.length, gus: wage, multiple: m && wage ? m / wage : null }
  }
  const regions = [...gus.byRegion.keys()]
    .filter((r) => r !== 'polska')
    .map((r) => regionRow(r, byRegion.get(r) ?? []))
    .sort((a, b) => (b.multiple ?? -1) - (a.multiple ?? -1) || b.n - a.n)
  const polska = regionRow('polska', inLane.map((o) => o.salary_pln_month))

  return { field, rejected, answer, regions, polska, portals: getPortals() }
}

function getPortals(): PortalRow[] {
  const bias = new Map(all<{ source: string; median_residual_pct: number }>('SELECT source, median_residual_pct FROM portal_bias')
    .map((r) => [r.source, r.median_residual_pct]))
  const counts = all<{ source: string; n: number; hourly: number }>(
    "SELECT source, count(*) AS n, avg(period = 'hour') AS hourly FROM offers_clean GROUP BY source",
  )
  const runId = get<{ run_id: string }>('SELECT run_id FROM pipeline_runs ORDER BY finished_at DESC LIMIT 1')?.run_id
  const logs = new Map(all<{ source: string; mode: 'live' | 'snapshot'; fallback_reason: string | null; meta: string }>(
    'SELECT source, mode, fallback_reason, meta FROM raw_ingestion_logs WHERE run_id = ?', [runId ?? ''],
  ).map((l) => [l.source, l]))
  return counts.map((c) => {
    const log = logs.get(c.source)
    return {
      source: c.source,
      n: c.n,
      biasPct: bias.get(c.source) ?? null,
      hourlyShare: c.hourly,
      mode: log?.mode ?? 'snapshot',
      reason: log?.mode === 'snapshot' ? log.fallback_reason : null,
      synthetic: Boolean(json<{ synthetic?: boolean }>(log?.meta, {}).synthetic),
    }
  }).sort((a, b) => b.n - a.n)
}
