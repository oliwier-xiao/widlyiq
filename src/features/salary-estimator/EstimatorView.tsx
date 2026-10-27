import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/ssr'

import type { RunMetrics } from '@/shared/db/run'
import { CATEGORIES, CONTRACTS, type Filters } from '@/shared/lib/filters'
import { formatNumber, formatPLN } from '@/shared/lib/formatters'
import { Panel, SeamGrid } from '@/shared/ui/Panel'
import type { ViewProps } from '@/shared/ui/types'

import { EstimatorWorkbench } from './EstimatorWorkbench'
import type { Profile } from './model'
import { getEstimatorData, type EstimatorData, type ExportFile } from './queries'

const decimal = (v: number, digits: number) => v.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function initialProfile(filters: Filters): Omit<Profile, 'skills'> {
  // The estimator needs one concrete profile, so "all" filters fall back to the most common choice.
  return {
    seniority: filters.seniority,
    category: (CATEGORIES as readonly string[]).includes(filters.category) ? filters.category : 'backend',
    contract: (CONTRACTS as readonly string[]).includes(filters.contract) ? filters.contract : 'b2b',
    region: filters.region,
  }
}

export function EstimatorView({ filters, regions, run }: ViewProps) {
  const data = getEstimatorData()
  return (
    <SeamGrid className="lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <EstimatorWorkbench
        weights={data.weights}
        gusWages={data.gusWages}
        gusYear={data.gusYear}
        defaultStacks={data.defaultStacks}
        categorySkills={data.categorySkills}
        regions={regions}
        initial={initialProfile(filters)}
        mae={run.metrics.mae_test}
      />
      <ModelPanel metrics={run.metrics} />
      <ExportPanel matrix={data.matrix} files={data.exports} />
    </SeamGrid>
  )
}

function ModelPanel({ metrics }: { metrics: RunMetrics }) {
  const truth = metrics.ground_truth
  return (
    <Panel
      title="Model"
      subtitle={`RidgeCV wyjaśnia ${Math.round(metrics.r2_test * 100)}% zmienności płac w ofertach, których nie widział przy treningu.`}
      bodyClassName="px-5 pb-5"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Metric term="R² na zbiorze testowym" value={decimal(metrics.r2_test, 3)} />
        <Metric term="Średni błąd (MAE)" value={formatPLN(metrics.mae_test)} />
        <Metric term="Alfa z walidacji krzyżowej" value={decimal(metrics.alpha, 1)} />
        <Metric term="Oferty trening / test" value={`${formatNumber(metrics.n_train)} / ${formatNumber(metrics.n_test)}`} />
        <Metric term="Cechy wejściowe" value={formatNumber(metrics.n_features)} />
        {truth && <Metric term="Zgodność wag" value={`r = ${decimal(truth.pearson_r, 2)}`} />}
      </dl>
      {truth && (
        <p className="mt-4 max-w-[64ch] t-body text-ink-2">
          Dane portali są syntetyczne, więc prawdziwe premie {truth.skills_compared} technologii są znane i można sprawdzić, jak dobrze model je odtworzył.
        </p>
      )}
    </Panel>
  )
}

function Metric({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="t-meta">{term}</dt>
      <dd className="mt-0.5 t-figure-sm">{value}</dd>
    </div>
  )
}

function formatBytes(bytes: number): string {
  return bytes >= 1_000_000 ? `${decimal(bytes / 1_000_000, 1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`
}

const FORMAT_LABELS: Record<ExportFile['format'], string> = { csv: 'CSV', json: 'JSON', xlsx: 'XLSX' }

function ExportPanel({ matrix, files }: { matrix: EstimatorData['matrix']; files: ExportFile[] }) {
  return (
    <Panel
      title="Eksport macierzy cech"
      subtitle={`${formatNumber(matrix.rows)} wierszy × ${formatNumber(matrix.columns)} kolumn, w tym ${formatNumber(matrix.modelColumns)} cech modelu.`}
      bodyClassName="px-5 pb-5"
    >
      <ul className="flex flex-wrap gap-2">
        {files.map((f) => (
          <li key={f.format}>
            {f.bytes === null ? (
              <span className="inline-flex h-10 items-center gap-2 border border-seam px-4 t-control font-medium text-ink-2">
                {FORMAT_LABELS[f.format]} · brak pliku
              </span>
            ) : (
              <a
                href={`/api/export?format=${f.format}`}
                download
                className="inline-flex h-10 items-center gap-2 bg-carbon px-4 t-control text-paper transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-carbon-2 active:scale-[0.97]"
              >
                <DownloadSimpleIcon size={16} weight="bold" aria-hidden />
                {FORMAT_LABELS[f.format]}
                <span className="font-medium text-dot-soft">{formatBytes(f.bytes)}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-[64ch] t-body text-ink-2">
        Jeden wiersz to jedna oferta po czyszczeniu: technologie, poziom, kategoria i umowa jako kolumny 0/1,
        cechy liczbowe po standaryzacji, płaca miesięczna i znacznik uzupełnionej płacy.
      </p>
    </Panel>
  )
}
