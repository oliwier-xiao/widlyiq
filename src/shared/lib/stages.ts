export type StageId =
  | 'extract' | 'verify-schema' | 'dedupe' | 'normalize-nbp' | 'impute-median' | 'filter-iqr'
  | 'classify-tier' | 'onehot-encode' | 'cooccur-matrix' | 'ml-ridge' | 'plot-mpl' | 'load-sqlite'

type StageMeta = { label: string; color: string; what: string }

// One colour per mechanism: the ribbon and the ETL Lab list paint a stage the same way.
export const STAGE_META: Record<StageId, StageMeta> = {
  extract: { label: 'Pobranie', color: 'var(--color-stage-extract)', what: 'oferty z portali, kursy NBP, płace GUS' },
  'verify-schema': { label: 'Schemat', color: 'var(--color-stage-schema)', what: 'błędne typy, ujemne kwoty, nieznane waluty' },
  dedupe: { label: 'Duplikaty', color: 'var(--color-stage-schema)', what: 'ta sama oferta na kilku portalach lub w kilku miastach' },
  'normalize-nbp': { label: 'Waluty NBP', color: 'var(--color-stage-nbp)', what: 'kurs średni NBP, stawki godzinowe × 168 h' },
  'impute-median': { label: 'Imputacja', color: 'var(--color-stage-impute)', what: 'brak widełek uzupełniony medianą grupy' },
  'filter-iqr': { label: 'Outliery', color: 'var(--color-stage-iqr)', what: 'płace poza płotkami IQR w swojej grupie' },
  'classify-tier': { label: 'Tier', color: 'var(--color-stage-tier)', what: 'kategoria oferty i koszyk S/A/B/C wg krotności GUS' },
  'onehot-encode': { label: 'Cechy', color: 'var(--color-stage-model)', what: 'technologie, poziom, kategoria i umowa jako kolumny 0/1' },
  'cooccur-matrix': { label: 'Współwystępowanie', color: 'var(--color-stage-model)', what: 'które technologie pojawiają się razem' },
  'ml-ridge': { label: 'Model Ridge', color: 'var(--color-stage-model)', what: 'regresja grzbietowa, alfa z walidacji krzyżowej' },
  'plot-mpl': { label: 'Wykres', color: 'var(--color-stage-model)', what: 'wykres diagnostyczny IQR z Matplotlib' },
  'load-sqlite': { label: 'Zapis', color: 'var(--color-stage-model)', what: 'jedna transakcja SQLite i eksport CSV, JSON, XLSX' },
}

export const STAGE_ORDER = Object.keys(STAGE_META) as StageId[]

/** The data-flow stages shown on the ribbon; feature and model stages live in ETL Lab. */
export const RIBBON_STAGES: StageId[] = ['extract', 'verify-schema', 'dedupe', 'normalize-nbp', 'impute-median', 'filter-iqr', 'classify-tier']

export type StageSnapshot = {
  stage: StageId
  rows_in: number
  rows_out: number
  removed: number
  duration_ms: number
  detail: Record<string, unknown>
}

export type PipelineEvent =
  | { event: 'run'; status: 'started'; run_id: string; mode: string; stages: StageId[] }
  | ({ event: 'stage'; status: 'running'; stage: StageId; position: number; rows_in: number })
  | ({ event: 'stage'; status: 'done'; position: number } & StageSnapshot)
  | { event: 'source'; source: string; mode: 'live' | 'snapshot'; reason: string | null; records: number | null; duration_ms: number }
  | { event: 'summary'; run_id: string; duration_ms: number; mode: string }
  // Python reports its own failures with after_stage; the route handler adds kind for failures around the process.
  | { event: 'error'; message: string; after_stage?: StageId; kind?: 'spawn' | 'timeout' | 'crash' }

// The wide ribbon names each count, so a bare "140" never has to be decoded from the cell's colour.
const RIBBON_NAMES: Partial<Record<StageId, string>> = {
  extract: 'Surowe', 'verify-schema': 'Schemat', dedupe: 'Duplikaty', 'normalize-nbp': 'Waluty',
  'impute-median': 'Imputacja', 'filter-iqr': 'Outliery', 'classify-tier': 'Czyste',
}

export function ribbonName(stage: StageId): string {
  return RIBBON_NAMES[stage] ?? STAGE_META[stage].label
}

export function ribbonLabel(s: StageSnapshot): string {
  const name = RIBBON_NAMES[s.stage]
  return name ? `${name} ${ribbonShort(s)}` : STAGE_META[s.stage].label
}

/** Phone-width ribbon: the counts alone, so all seven segments and the clean total fit in 390 px. Only removals carry a sign. */
export function ribbonShort(s: StageSnapshot): string {
  const n = (v: unknown) => new Intl.NumberFormat('pl-PL', { useGrouping: 'always' }).format(Number(v ?? 0))
  switch (s.stage) {
    case 'extract': return n(s.rows_out)
    case 'verify-schema':
    case 'dedupe':
    case 'filter-iqr': return `−${n(s.removed)}`
    case 'normalize-nbp': return n(Number(s.detail.converted ?? 0) + Number(s.detail.hourly ?? 0))
    case 'impute-median': return n(s.detail.imputed)
    case 'classify-tier': return n(s.rows_out)
    default: return ''
  }
}
