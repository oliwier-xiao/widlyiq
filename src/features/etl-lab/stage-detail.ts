import { formatNumber, formatPLN } from '@/shared/lib/formatters'
import { STAGE_META, type StageId } from '@/shared/lib/stages'

const decimal = (v: unknown, digits: number) =>
  new Intl.NumberFormat('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v ?? 0))

function counts(map: unknown, strip = ''): string {
  if (!map || typeof map !== 'object') return ''
  return Object.entries(map as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k.replace(strip, '')} ${formatNumber(v)}`)
    .join(' · ')
}

/** One line per stage, built from the stage's own detail JSON so the list never claims more than the run logged. */
export function stageDetail(stage: StageId, detail: Record<string, unknown>): string {
  switch (stage) {
    case 'extract': {
      const modes = Object.values((detail.sources ?? {}) as Record<string, string>)
      const live = modes.filter((m) => m === 'live').length
      return modes.length ? `${modes.length} źródeł: ${live} na żywo, ${modes.length - live} ze snapshotu` : STAGE_META.extract.what
    }
    case 'verify-schema':
      return counts(detail.reasons) || 'wszystkie rekordy poprawne'
    case 'normalize-nbp':
      return `${formatNumber(Number(detail.converted ?? 0))} przeliczeń walut · ${formatNumber(Number(detail.hourly ?? 0))} stawek × 168 h · tabela ${detail.table ?? 'brak danych'}`
    case 'impute-median':
      return `${formatNumber(Number(detail.imputed ?? 0))} ofert uzupełnionych medianą grupy`
    case 'filter-iqr':
      return counts(detail.reasons, 'IQR: ') || 'brak wartości poza płotkami'
    case 'classify-tier': {
      const tiers = (detail.tiers ?? {}) as Record<string, number>
      return ['S', 'A', 'B', 'C'].map((t) => `${t} ${formatNumber(tiers[t] ?? 0)}`).join(' · ')
    }
    case 'onehot-encode':
      return `${formatNumber(Number(detail.columns ?? 0))} kolumn, w tym ${formatNumber(Number(detail.skills ?? 0))} technologii`
    case 'cooccur-matrix': {
      const shape = (detail.shape ?? []) as number[]
      return `${shape[0] ?? 0} technologii, ${formatNumber(Number(detail.pairs ?? 0))} par występujących razem`
    }
    case 'ml-ridge': {
      const truth = detail.ground_truth as { pearson_r?: number } | undefined
      const base = `alfa ${decimal(detail.alpha, 1)} · R² ${decimal(detail.r2_test, 3)} · MAE ${formatPLN(Number(detail.mae_test ?? 0))}`
      return truth?.pearson_r != null ? `${base} · zgodność z prawdziwymi wagami r = ${decimal(truth.pearson_r, 2)}` : base
    }
    case 'plot-mpl':
      return 'wykres zapisany jako SVG, widoczny niżej'
    case 'load-sqlite':
      return `${formatNumber(Number(detail.tables ?? 0))} tabel w jednej transakcji`
    default:
      return STAGE_META[stage].what
  }
}
