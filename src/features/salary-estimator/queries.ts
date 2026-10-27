import 'server-only'

import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

import { all, get } from '@/shared/db/sqlite'

import type { Weight } from './model'

export type ExportFile = { format: 'csv' | 'json' | 'xlsx'; bytes: number | null }

export type EstimatorData = {
  weights: Weight[]
  gusWages: Record<string, number>
  gusYear: number
  defaultStacks: Record<string, string[]>
  categorySkills: Record<string, string[]>
  matrix: { rows: number; columns: number; modelColumns: number }
  exports: ExportFile[]
  /** Offers with a salary range per "category|seniority|contract|region", so the estimate can say how much data stands behind it. */
  support: Record<string, number>
}

type WeightRow = {
  feature: string
  label: string
  feature_group: Weight['group']
  weight: number
  scaler_mean: number | null
  scaler_scale: number | null
  support: number | null
}

const MIN_STACK = 3
// Example stacks per category. Snapshot skills are sampled uniformly inside a category, so raw frequency
// alone would hand out an incoherent stack (Ruby with Scala and PHP); presets are filled from frequency only when short.
const PRESETS: Record<string, string[]> = {
  backend: ['Java', 'Spring', 'PostgreSQL', 'Docker'],
  frontend: ['TypeScript', 'React', 'Next.js', 'CSS'],
  fullstack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
  data: ['Python', 'SQL', 'Spark', 'Pandas'],
  devops: ['Kubernetes', 'Docker', 'AWS', 'Linux'],
  mobile: ['Kotlin', 'Swift'],
  testing: ['Cypress', 'JavaScript', 'SQL', 'Jira'],
  security: ['Linux', 'Python', 'AWS', 'Bash'],
  ai: ['Python', 'Pandas', 'AWS', 'Kubernetes'],
}
const RELEVANT_SHARE = 0.05
const NON_FEATURE_COLUMNS = new Set(['offer_id', 'source', 'salary_pln_month', 'is_imputed'])

// [sqlite-query] the whole model fits in a few dozen rows, so the client recomputes predictions without a round trip
export function getEstimatorData(): EstimatorData {
  const weights = all<WeightRow>(
    'SELECT feature, label, feature_group, weight, scaler_mean, scaler_scale, support FROM ml_feature_weights',
  ).map((w) => ({
    feature: w.feature, label: w.label, group: w.feature_group, weight: w.weight,
    mean: w.scaler_mean, scale: w.scaler_scale, support: w.support,
  }))

  const gusYear = get<{ year: number }>('SELECT max(year) AS year FROM gus_benchmarks')?.year ?? 0
  const gusWages = Object.fromEntries(
    all<{ region: string; avg_gross_wage: number }>(
      'SELECT region, avg_gross_wage FROM gus_benchmarks WHERE year = ?', [gusYear],
    ).map((r) => [r.region, r.avg_gross_wage]),
  )

  const vocabulary = new Set(weights.filter((w) => w.group === 'skill').map((w) => w.label))
  const popular = all<{ category: string; skill: string; n: number; total: number }>(
    `SELECT o.category, s.skill, count(*) AS n,
            (SELECT count(*) FROM offers_clean c WHERE c.category = o.category) AS total
       FROM offer_skills s JOIN offers_clean o ON o.offer_id = s.offer_id
      GROUP BY o.category, s.skill ORDER BY o.category, n DESC`,
  )
  // A skill counts as relevant to a category when enough of its offers ask for it; suggestions only come from these.
  const categorySkills: Record<string, string[]> = {}
  for (const row of popular) {
    if (!vocabulary.has(row.skill) || row.n < Math.max(5, row.total * RELEVANT_SHARE)) continue
    categorySkills[row.category] ??= []
    categorySkills[row.category].push(row.skill)
  }
  const defaultStacks: Record<string, string[]> = {}
  for (const [category, relevant] of Object.entries(categorySkills)) {
    const stack = (PRESETS[category] ?? []).filter((s) => vocabulary.has(s))
    for (const s of relevant) if (stack.length < MIN_STACK && !stack.includes(s)) stack.push(s)
    defaultStacks[category] = stack
  }

  // [sqlite-query] one grouped count covers every profile the four controls can form, so the client never asks again
  const support = Object.fromEntries(all<{ key: string; n: number }>(
    `SELECT coalesce(category, '') || '|' || seniority || '|' || coalesce(contract, '') || '|' || coalesce(region, '') AS key,
            count(*) AS n
       FROM offers_clean WHERE is_imputed = 0 GROUP BY key`,
  ).map((r) => [r.key, r.n]))

  const rows = get<{ n: number }>('SELECT count(*) AS n FROM ai_feature_matrix')?.n ?? 0
  const columns = all<{ name: string }>('PRAGMA table_info(ai_feature_matrix)')
  const exportDir = path.join(process.cwd(), 'data', 'exports')
  const exports = (['csv', 'json', 'xlsx'] as const).map((format) => {
    const file = path.join(exportDir, `feature_matrix.${format}`)
    return { format, bytes: existsSync(file) ? statSync(file).size : null }
  })

  return {
    weights,
    gusWages,
    gusYear,
    defaultStacks,
    categorySkills,
    matrix: { rows, columns: columns.length, modelColumns: columns.filter((c) => !NON_FEATURE_COLUMNS.has(c.name)).length },
    exports,
    support,
  }
}
