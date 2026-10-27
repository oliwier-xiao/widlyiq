'use client'

import { useState } from 'react'

import { formatDateTime, formatDuration, formatNumber, plural } from '@/shared/lib/formatters'
import { STAGE_META, STAGE_ORDER } from '@/shared/lib/stages'
import { usePipelineRun, type RunMode } from '@/shared/ui/PipelineRun'
import { RunPipelineButton } from '@/shared/ui/RunPipelineButton'

const MODES: [RunMode, string][] = [['live', 'Live'], ['snapshot', 'Tylko snapshot']]
const r2 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/** After a run the toolbar says what it produced, in the ribbon's own words, not just that it finished. */
function doneSummary(live: ReturnType<typeof usePipelineRun>): string {
  const raw = live.stages.extract?.rows_out
  const clean = live.stages['classify-tier']?.rows_out
  const fit = Number(live.stages['ml-ridge']?.detail.r2_test)
  const fallbacks = live.mode === 'live' ? live.sources.filter((s) => s.mode === 'snapshot').length : 0
  return [
    `Gotowe w ${formatDuration(live.durationMs ?? 0)}`,
    raw != null && clean != null && `surowe ${formatNumber(raw)} → czyste ${formatNumber(clean)}`,
    Number.isFinite(fit) && `R² ${r2.format(fit)}`,
    fallbacks > 0 && `${plural(fallbacks, 'źródło', 'źródła', 'źródeł')} ze snapshotu`,
    'dane odświeżone',
  ].filter(Boolean).join(' · ')
}

type Props = { lastFinishedAt: string; lastMode: RunMode; lastDurationMs: number }

export function RunToolbar({ lastFinishedAt, lastMode, lastDurationMs }: Props) {
  const [mode, setMode] = useState<RunMode>('live')
  const live = usePipelineRun()
  const busy = live.status === 'running'
  const done = Object.keys(live.stages).length

  const status =
    live.status === 'running'
      ? `Etap ${live.running ? STAGE_META[live.running].label : 'start'} · ${done} z ${STAGE_ORDER.length} gotowych`
      : live.status === 'done'
        ? doneSummary(live)
        : live.status === 'error'
          ? `Ostatni udany przebieg ${formatDateTime(lastFinishedAt)}`
          : `Ostatni przebieg ${formatDateTime(lastFinishedAt)} · ${lastMode === 'live' ? 'live' : 'snapshot'} · ${formatDuration(lastDurationMs)}`

  return (
    <div className="border-b border-seam bg-toolbar">
      <div className="flex min-h-[54px] flex-wrap items-center gap-3 px-5 py-2.5">
        <div role="radiogroup" aria-label="Tryb przebiegu" className="flex h-9 border border-seam bg-paper p-[3px]">
          {MODES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              disabled={busy}
              onClick={() => setMode(value)}
              className={`px-3 t-control transition-colors duration-150 disabled:cursor-not-allowed ${mode === value ? 'bg-carbon text-paper' : 'text-ink-2 hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <RunPipelineButton mode={mode} />
        <p className="min-w-0 flex-1 basis-64 t-meta" aria-live="polite">{status}</p>
      </div>
      {live.status === 'error' && live.error && (
        <div className="border-t border-seam px-5 py-3" role="alert">
          <p className="t-body font-semibold text-error">{live.error.title}</p>
          {/* The database commits in one transaction at the end, so a failed run never leaves half-written data. */}
          <p className="mt-0.5 t-body">{live.error.action}{live.error.unchanged && ' Dane w dashboardzie zostały bez zmian.'}</p>
          {live.error.detail && (
            <details className="mt-1">
              <summary className="cursor-pointer t-meta underline underline-offset-[3px] marker:content-none">Szczegóły błędu</summary>
              <p className="mt-1 max-w-[80ch] break-words t-meta">{live.error.detail}</p>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
