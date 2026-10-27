import 'server-only'

import { all, get, json } from './sqlite'

export type StageRow = {
  position: number
  stage: string
  rows_in: number
  rows_out: number
  removed: number
  duration_ms: number
  detail: Record<string, unknown>
}

export type SourceLog = {
  source: string
  mode: 'live' | 'snapshot'
  fallback_reason: string | null
  records: number | null
  duration_ms: number
  http_status: number | null
  synthetic: boolean
}

export type RunCounts = {
  raw: number
  schema_rejected: number
  duplicates: number
  imputed: number
  outliers: number
  clean: number
  by_source: Record<string, number>
}

export type RunMetrics = {
  alpha: number
  r2_test: number
  mae_test: number
  n_train: number
  n_test: number
  n_features: number
  nbp_table: string
  nbp_date: string
  gus_year: number
  ground_truth?: { pearson_r: number; skills_compared: number }
}

export type RunInfo = {
  runId: string
  startedAt: string
  finishedAt: string
  durationMs: number
  mode: 'live' | 'snapshot'
  counts: RunCounts
  metrics: RunMetrics
  stages: StageRow[]
  sources: SourceLog[]
  synthetic: boolean
}

type RunRow = { run_id: string; started_at: string; finished_at: string; duration_ms: number; mode: 'live' | 'snapshot'; counts: string; metrics: string }
type StageDbRow = Omit<StageRow, 'detail'> & { detail: string }
type LogDbRow = Omit<SourceLog, 'synthetic'> & { meta: string }

// [sqlite-query] latest run plus its stage and source rows; the ribbon and every provenance label read from here
export function getLatestRun(): RunInfo | null {
  const run = get<RunRow>('SELECT * FROM pipeline_runs ORDER BY finished_at DESC LIMIT 1')
  if (!run) return null
  const stages = all<StageDbRow>('SELECT * FROM pipeline_stages WHERE run_id = ? ORDER BY position', [run.run_id])
  const logs = all<LogDbRow>(
    'SELECT source, mode, fallback_reason, records, duration_ms, http_status, meta FROM raw_ingestion_logs WHERE run_id = ?',
    [run.run_id],
  )
  const sources = logs.map(({ meta, ...log }) => ({ ...log, synthetic: Boolean(json<{ synthetic?: boolean }>(meta, {}).synthetic) }))
  return {
    runId: run.run_id,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    durationMs: run.duration_ms,
    mode: run.mode,
    counts: json<RunCounts>(run.counts, {} as RunCounts),
    metrics: json<RunMetrics>(run.metrics, {} as RunMetrics),
    stages: stages.map((s) => ({ ...s, detail: json(s.detail, {}) })),
    sources,
    synthetic: sources.some((s) => s.synthetic),
  }
}

export function getRegions(): string[] {
  return all<{ region: string }>(
    "SELECT DISTINCT region FROM offers_clean WHERE region IS NOT NULL ORDER BY region",
  ).map((r) => r.region)
}
