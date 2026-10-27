import 'server-only'

import { all, json } from '@/shared/db/sqlite'
import type { StageId } from '@/shared/lib/stages'

import type { CleanSide, Note, RawSide, Rejection, Sample, SampleKind } from './types'

const PER_KIND = 8

// Each sample kind is one transformation the inspector can prove; the WHERE clause is the evidence it happened.
const CLEAN_KINDS: [SampleKind, string][] = [
  ['currency', "c.currency <> 'PLN' AND c.transform_log LIKE '%normalize-nbp:%(%'"],
  ['hourly', "c.transform_log LIKE '%stawka godzinowa%'"],
  ['impute', 'c.is_imputed = 1'],
  ['alias', "c.transform_log LIKE '%aliasy technologii%'"],
  ['schema', "c.transform_log LIKE '%verify-schema:%'"],
]
const REJECTED_KINDS: [SampleKind, string][] = [
  ['schema', 'verify-schema'],
  ['dedupe', 'dedupe'],
  ['iqr', 'filter-iqr'],
]

type RawRow = Omit<RawSide, 'skills_raw'> & { offer_id: string; skills_raw: string }
type CleanRow = Omit<CleanSide, 'skills'> & { offer_id: string; source: string; title: string; transform_log: string; skills: string | null }
type RejectedRow = Omit<Rejection, 'stage' | 'kept'> & {
  offer_id: string; source: string; title: string | null; stage: StageId
  kept_source: string | null; kept_city: string | null; kept_salary: number | null
}

const NOTE_STAGE: Record<string, StageId> = {
  harmonize: 'verify-schema',
  'verify-schema': 'verify-schema',
  'normalize-nbp': 'normalize-nbp',
  'impute-median': 'impute-median',
  'classify-tier': 'classify-tier',
}

function toNotes(log: string): Note[] {
  return json<string[]>(log, []).map((entry) => {
    const [prefix, ...rest] = entry.split(': ')
    return { stage: NOTE_STAGE[prefix] ?? 'verify-schema', text: rest.join(': ') || entry }
  })
}

// [sqlite-query] spread samples across portals with ROW_NUMBER so one source never fills the whole list
function cleanSamples(kind: SampleKind, where: string): CleanRow[] {
  return all<CleanRow>(`
    SELECT * FROM (
      SELECT c.offer_id, c.source, c.title, c.category, c.seniority, c.contract, c.region, c.salary_pln_month, c.tier,
             c.gus_multiple, c.is_imputed, c.imputation_group, c.transform_log,
             (SELECT group_concat(s.skill, '|') FROM offer_skills s WHERE s.offer_id = c.offer_id) AS skills,
             ROW_NUMBER() OVER (PARTITION BY c.source ORDER BY c.offer_id) AS rn
      FROM offers_clean c WHERE ${where}
    ) WHERE rn <= 3 ORDER BY rn, source LIMIT ${PER_KIND}`)
}

// [sqlite-query] rejected rows keep no transform log, so the kept duplicate is joined back by the id in its reason
function rejectedSamples(stage: string): RejectedRow[] {
  return all<RejectedRow>(`
    SELECT * FROM (
      SELECT r.offer_id, r.source, r.title, r.stage, r.reason, r.salary_pln_month, r.lower_fence, r.upper_fence,
             r.z_score, r.group_key, k.source AS kept_source, k.city AS kept_city, k.salary_pln_month AS kept_salary,
             ROW_NUMBER() OVER (PARTITION BY r.source, r.reason ORDER BY r.offer_id) AS rn
      FROM rejected_outliers r
      LEFT JOIN offers_clean k ON r.stage = 'dedupe' AND k.offer_id = substr(r.reason, 10)
      WHERE r.stage = ?
    ) WHERE rn <= 2 ORDER BY rn, source, reason LIMIT ${PER_KIND}`, [stage])
}

// [sqlite-query] raw side of every sampled record in one IN query instead of one round trip per row
function rawFor(ids: string[]): Map<string, RawSide> {
  if (ids.length === 0) return new Map()
  const rows = all<RawRow>(
    `SELECT offer_id, title, category_raw, seniority_raw, contract_raw, salary_from, salary_to, currency, period_raw, city, region_raw, skills_raw
     FROM offers_raw WHERE offer_id IN (${ids.map(() => '?').join(',')})`,
    ids,
  )
  return new Map(rows.map(({ offer_id, skills_raw, ...r }) => [offer_id, { ...r, skills_raw: json<string[]>(skills_raw, []) }]))
}

export function getSamples(): Sample[] {
  const byId = new Map<string, Sample>()

  for (const [kind, where] of CLEAN_KINDS) {
    for (const row of cleanSamples(kind, where)) {
      const existing = byId.get(row.offer_id)
      if (existing) {
        existing.kinds.push(kind)
        continue
      }
      const { offer_id, source, title, transform_log, skills, ...clean } = row
      byId.set(offer_id, {
        id: offer_id, kinds: [kind], source, title, raw: null, notes: toNotes(transform_log), rejection: null,
        clean: { ...clean, skills: skills ? skills.split('|') : [] },
      })
    }
  }

  for (const [kind, stage] of REJECTED_KINDS) {
    for (const row of rejectedSamples(stage)) {
      if (byId.has(row.offer_id)) continue
      byId.set(row.offer_id, {
        id: row.offer_id, kinds: [kind], source: row.source, title: row.title ?? '(brak tytułu)', raw: null, clean: null, notes: [],
        rejection: {
          stage: row.stage, reason: row.reason, salary_pln_month: row.salary_pln_month, lower_fence: row.lower_fence,
          upper_fence: row.upper_fence, z_score: row.z_score, group_key: row.group_key,
          kept: row.kept_source ? { source: row.kept_source, city: row.kept_city, salary: row.kept_salary } : null,
        },
      })
    }
  }

  const raws = rawFor([...byId.keys()])
  return [...byId.values()].map((s) => ({ ...s, raw: raws.get(s.id) ?? null }))
}
