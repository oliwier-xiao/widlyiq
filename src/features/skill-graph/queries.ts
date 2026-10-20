import 'server-only'

import { all, get } from '@/shared/db/sqlite'
import type { Filters } from '@/shared/lib/filters'
import { quantile } from '@/shared/lib/stats'

import type { SkillGraphData, SkillNode, SkillPair } from './types'

/** Below this many observed salaries a per-skill median says more about one employer than about the skill. */
export const MIN_SKILL_SAMPLE = 5

type StatRow = { skill: string; demand: number; median_salary: number | null; p25: number | null; p75: number | null; ridge_weight: number | null; heatmap_order: number }
type PairRow = { skill_a: string; skill_b: string; count: number; jaccard: number; lift: number; mean_salary: number }

const OFFER_FILTER = "(:category = 'all' OR o.category = :category) AND (:contract = 'all' OR o.contract = :contract)"

function vocabulary(): StatRow[] {
  return all<StatRow>('SELECT skill, demand, median_salary, p25, p75, ridge_weight, heatmap_order FROM skill_stats ORDER BY heatmap_order')
}

// [sqlite-query] demand inside the selected region, same category and contract filters, matrix untouched
function regionDemand(filters: Filters): Map<string, number> {
  if (filters.region === 'polska') return new Map()
  const rows = all<{ skill: string; n: number }>(
    `SELECT s.skill, count(*) AS n FROM offer_skills s JOIN offers_clean o ON o.offer_id = s.offer_id
     WHERE o.region = :region AND ${OFFER_FILTER} GROUP BY s.skill`,
    { region: filters.region, category: filters.category, contract: filters.contract },
  )
  return new Map(rows.map((r) => [r.skill, r.n]))
}

function toPairs(rows: PairRow[], index: Map<string, number>): SkillPair[] {
  return rows
    .filter((r) => index.has(r.skill_a) && index.has(r.skill_b))
    .map((r) => ({ a: index.get(r.skill_a)!, b: index.get(r.skill_b)!, count: r.count, jaccard: r.jaccard, lift: r.lift, meanSalary: r.mean_salary }))
}

function fromPython(stats: StatRow[], region: Map<string, number>): SkillGraphData {
  const skills: SkillNode[] = stats.map((s) => ({
    skill: s.skill, order: s.heatmap_order, demand: s.demand, median: s.median_salary, p25: s.p25, p75: s.p75,
    weight: s.ridge_weight, regionDemand: region.get(s.skill) ?? 0,
  }))
  const index = new Map(skills.map((s, i) => [s.skill, i]))
  const pairs = toPairs(all<PairRow>('SELECT skill_a, skill_b, count, jaccard, lift, mean_salary FROM skill_cooccurrence'), index)
  const offers = get<{ n: number }>('SELECT count(*) AS n FROM offers_clean')?.n ?? 0
  return { skills, pairs, source: 'python', offers }
}

// [sqlite-query] filtered X.T @ X: a self-join on offer_skills counts every pair of skills sharing an offer
function fromSqlite(stats: StatRow[], filters: Filters, region: Map<string, number>): SkillGraphData {
  const params = { category: filters.category, contract: filters.contract }
  const offers = get<{ n: number }>(`SELECT count(*) AS n FROM offers_clean o WHERE ${OFFER_FILTER}`, params)?.n ?? 0
  const scoped = `SELECT s.offer_id, s.skill FROM offer_skills s JOIN offers_clean o ON o.offer_id = s.offer_id
                  WHERE ${OFFER_FILTER} AND s.skill IN (SELECT skill FROM skill_stats)`
  const counts = all<{ skill_a: string; skill_b: string; count: number; mean_salary: number }>(
    `WITH x AS (${scoped})
     SELECT a.skill AS skill_a, b.skill AS skill_b, count(*) AS count, avg(o.salary_pln_month) AS mean_salary
     FROM x a JOIN x b ON a.offer_id = b.offer_id JOIN offers_clean o ON o.offer_id = a.offer_id
     GROUP BY a.skill, b.skill`,
    params,
  )
  const salaries = all<{ skill: string; salary: number }>(
    `WITH x AS (${scoped}) SELECT x.skill, o.salary_pln_month AS salary FROM x JOIN offers_clean o ON o.offer_id = x.offer_id
     WHERE o.is_imputed = 0 ORDER BY x.skill, o.salary_pln_month`,
    params,
  )
  const bySkill = new Map<string, number[]>()
  for (const r of salaries) {
    const list = bySkill.get(r.skill)
    if (list) list.push(r.salary)
    else bySkill.set(r.skill, [r.salary])
  }
  const freq = new Map(counts.filter((c) => c.skill_a === c.skill_b).map((c) => [c.skill_a, c.count]))

  const skills: SkillNode[] = stats.map((s) => {
    const values = bySkill.get(s.skill) ?? []
    const enough = values.length >= MIN_SKILL_SAMPLE
    return {
      skill: s.skill, order: s.heatmap_order, demand: freq.get(s.skill) ?? 0,
      median: enough ? quantile(values, 0.5) : null, p25: enough ? quantile(values, 0.25) : null,
      p75: enough ? quantile(values, 0.75) : null, weight: s.ridge_weight, regionDemand: region.get(s.skill) ?? 0,
    }
  })
  // Lift and Jaccard are derived exactly as in features.cooccurrence, so both paths read on the same scale.
  const rows: PairRow[] = counts.map((c) => {
    const fa = freq.get(c.skill_a) ?? 0
    const fb = freq.get(c.skill_b) ?? 0
    const union = fa + fb - c.count
    return {
      ...c, jaccard: union > 0 ? c.count / union : 0, lift: fa && fb ? (c.count * offers) / (fa * fb) : 0,
      mean_salary: Math.round(c.mean_salary),
    }
  })
  return { skills, pairs: toPairs(rows, new Map(skills.map((s, i) => [s.skill, i]))), source: 'sqlite', offers }
}

export function getSkillGraph(filters: Filters): SkillGraphData {
  const stats = vocabulary()
  const region = regionDemand(filters)
  return filters.category === 'all' && filters.contract === 'all'
    ? fromPython(stats, region)
    : fromSqlite(stats, filters, region)
}
