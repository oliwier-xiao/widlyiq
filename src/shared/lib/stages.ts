export type StageId =
  | 'extract' | 'verify-schema' | 'dedupe' | 'normalize-nbp' | 'impute-median' | 'filter-iqr'
  | 'classify-tier' | 'onehot-encode' | 'cooccur-matrix' | 'ml-ridge' | 'plot-mpl' | 'load-sqlite'

export type Anchor =
  | 'extract' | 'xml-nbp' | 'xlsx-gus' | 'verify-schema' | 'normalize-nbp' | 'impute-median' | 'filter-iqr'
  | 'classify-tier' | 'onehot-encode' | 'cooccur-matrix' | 'ml-ridge' | 'plot-mpl' | 'sqlite-query'

export const ANCHORS: readonly Anchor[] = [
  'extract', 'xml-nbp', 'xlsx-gus', 'verify-schema', 'normalize-nbp', 'impute-median', 'filter-iqr',
  'classify-tier', 'onehot-encode', 'cooccur-matrix', 'ml-ridge', 'plot-mpl', 'sqlite-query',
]

type StageMeta = { label: string; color: string; anchor: Anchor; what: string }

// One colour per mechanism: the ribbon, the ETL Lab list and the code drawer all paint a stage the same way.
export const STAGE_META: Record<StageId, StageMeta> = {
  extract: { label: 'Pobranie', color: 'var(--color-stage-extract)', anchor: 'extract', what: 'API portali, NBP XML, GUS XLSX, fallback do snapshotów' },
  'verify-schema': { label: 'Schemat', color: 'var(--color-stage-schema)', anchor: 'verify-schema', what: 'typy, ujemne kwoty, nieznane waluty, kwoty w tysiącach' },
  dedupe: { label: 'Duplikaty', color: 'var(--color-stage-schema)', anchor: 'verify-schema', what: 'ta sama oferta na kilku portalach lub w kilku miastach' },
  'normalize-nbp': { label: 'Waluty NBP', color: 'var(--color-stage-nbp)', anchor: 'normalize-nbp', what: 'kurs średni NBP, stawki godzinowe × 168 h' },
  'impute-median': { label: 'Imputacja', color: 'var(--color-stage-impute)', anchor: 'impute-median', what: 'brak widełek uzupełniony medianą grupy, is_imputed = 1' },
  'filter-iqr': { label: 'Outliery', color: 'var(--color-stage-iqr)', anchor: 'filter-iqr', what: 'płotki IQR k = 1,5 na log(płacy) i Z-Score' },
  'classify-tier': { label: 'Tier', color: 'var(--color-stage-tier)', anchor: 'classify-tier', what: 'kategoria z tytułu i stacku, koszyki S/A/B/C wg krotności GUS' },
  'onehot-encode': { label: 'One-hot', color: 'var(--color-stage-model)', anchor: 'onehot-encode', what: 'skille, kategoria, umowa, poziom, StandardScaler' },
  'cooccur-matrix': { label: 'X.T @ X', color: 'var(--color-stage-model)', anchor: 'cooccur-matrix', what: 'macierz współwystępowania na macierzy rzadkiej' },
  'ml-ridge': { label: 'RidgeCV', color: 'var(--color-stage-model)', anchor: 'ml-ridge', what: 'regresja grzbietowa, alfa z walidacji krzyżowej' },
  'plot-mpl': { label: 'Wykres', color: 'var(--color-stage-model)', anchor: 'plot-mpl', what: 'diagnostyka IQR w Matplotlib, zapis do SVG' },
  'load-sqlite': { label: 'SQLite', color: 'var(--color-stage-model)', anchor: 'sqlite-query', what: 'jedna transakcja, tryb WAL, eksport CSV / JSON / XLSX' },
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
  | ({ event: 'stage'; status: 'done'; position: number; anchor: string } & StageSnapshot)
  | { event: 'source'; source: string; mode: 'live' | 'snapshot'; reason: string | null; records: number | null; duration_ms: number }
  | { event: 'summary'; run_id: string; duration_ms: number; mode: string }
  | { event: 'error'; message: string; after_stage?: string }

export function ribbonLabel(s: StageSnapshot): string {
  const n = (v: unknown) => new Intl.NumberFormat('pl-PL', { useGrouping: 'always' }).format(Number(v ?? 0))
  switch (s.stage) {
    case 'extract': return `${n(s.rows_out)} surowych`
    case 'verify-schema': return `−${n(s.removed)} schemat`
    case 'dedupe': return `−${n(s.removed)} duplikaty`
    case 'normalize-nbp': return `${n(s.detail.converted)} walut · ${n(s.detail.hourly)} × 168 h`
    case 'impute-median': return `${n(s.detail.imputed)} imputacji`
    case 'filter-iqr': return `−${n(s.removed)} IQR`
    case 'classify-tier': return `${n(s.rows_out)} czystych`
    default: return STAGE_META[s.stage].label
  }
}

/** Phone-width ribbon: the counts alone, so all seven segments and the clean total fit in 390 px. */
export function ribbonShort(s: StageSnapshot): string {
  const n = (v: unknown) => new Intl.NumberFormat('pl-PL', { useGrouping: 'always' }).format(Number(v ?? 0))
  switch (s.stage) {
    case 'extract': return n(s.rows_out)
    case 'verify-schema':
    case 'dedupe':
    case 'filter-iqr': return `−${n(s.removed)}`
    case 'normalize-nbp': return n(s.detail.converted)
    case 'impute-median': return `+${n(s.detail.imputed)}`
    case 'classify-tier': return n(s.rows_out)
    default: return ''
  }
}
