import type { StageId } from '@/shared/lib/stages'

export const SAMPLE_KINDS = ['all', 'currency', 'hourly', 'impute', 'alias', 'schema', 'dedupe', 'iqr'] as const
export type SampleKind = (typeof SAMPLE_KINDS)[number]

export const SAMPLE_LABELS: Record<SampleKind, string> = {
  all: 'Wszystkie zmiany',
  currency: 'Waluta NBP',
  hourly: 'Stawka godzinowa',
  impute: 'Imputacja',
  alias: 'Aliasy technologii',
  schema: 'Schemat',
  dedupe: 'Duplikaty',
  iqr: 'Outliery IQR',
}

export type RawSide = {
  title: string | null
  seniority_raw: string | null
  contract_raw: string | null
  salary_from: number | null
  salary_to: number | null
  currency: string | null
  period_raw: string | null
  city: string | null
  skills_raw: string[]
}

export type CleanSide = {
  category: string
  seniority: string
  contract: string | null
  region: string | null
  salary_pln_month: number
  skills: string[]
  tier: string
  gus_multiple: number
  is_imputed: number
  imputation_group: string | null
}

export type Rejection = {
  stage: StageId
  reason: string
  salary_pln_month: number | null
  lower_fence: number | null
  upper_fence: number | null
  z_score: number | null
  group_key: string | null
  keptTitle: string | null
}

export type Note = { stage: StageId; text: string }

export type Sample = {
  id: string
  kinds: SampleKind[]
  source: string
  title: string
  raw: RawSide | null
  clean: CleanSide | null
  notes: Note[]
  rejection: Rejection | null
}
