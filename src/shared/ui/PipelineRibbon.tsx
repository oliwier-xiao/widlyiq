'use client'

import Link from 'next/link'

import { formatDateTime, formatDuration } from '@/shared/lib/formatters'
import { RIBBON_STAGES, STAGE_META, ribbonLabel, type StageId, type StageSnapshot } from '@/shared/lib/stages'

import { useCodeDrawer } from './CodeDrawer'
import { usePipelineRun } from './PipelineRun'

export type RibbonRun = {
  stages: StageSnapshot[]
  finishedAt: string
  durationMs: number
  mode: 'live' | 'snapshot'
  etlHref: string
}

const LOSS_STAGES = new Set<StageId>(['verify-schema', 'dedupe', 'filter-iqr'])

export function PipelineRibbon({ run }: { run: RibbonRun }) {
  const live = usePipelineRun()
  const { open } = useCodeDrawer()
  const stored = Object.fromEntries(run.stages.map((s) => [s.stage, s])) as Partial<Record<StageId, StageSnapshot>>
  const showingLive = live.status === 'running' || live.status === 'error'
  const source = showingLive ? live.stages : stored

  return (
    <div className="flex h-11 items-stretch border-b border-seam bg-toolbar">
      <ol className="flex min-w-0 flex-1 gap-[2px] overflow-x-auto pr-[2px]" aria-label="Przepływ rekordów przez pipeline">
        {RIBBON_STAGES.map((id) => {
          const snap = source[id]
          const meta = STAGE_META[id]
          const running = live.running === id
          return (
            <li key={id} className="relative min-w-[132px] flex-1 pb-[6px]">
              <button
                type="button"
                onClick={() => open(meta.anchor)}
                title={`${meta.label}: ${meta.what}${snap ? ` · ${formatDuration(snap.duration_ms)}` : ''}`}
                className="group relative flex h-full w-full items-center overflow-hidden px-3 text-left"
                // While a run streams, the cell stays grey and the fill span reveals its colour left to right.
                style={{ background: snap && live.status === 'idle' ? meta.color : running ? 'transparent' : '#e7e9e4' }}
              >
                {running && <span className="ribbon-running absolute inset-0" aria-hidden />}
                {snap && live.status !== 'idle' && (
                  <span key={`${snap.rows_out}-${snap.duration_ms}`} className="ribbon-fill absolute inset-0" style={{ background: meta.color }} aria-hidden />
                )}
                <span className={`relative t-table truncate font-semibold ${snap ? 'text-paper' : 'text-ink-2'}`}>
                  {snap ? ribbonLabel(snap) : running ? `${meta.label}…` : meta.label}
                </span>
              </button>
              {snap && LOSS_STAGES.has(id) && snap.removed > 0 && (
                <span className="absolute bottom-0 right-3 h-[6px] w-3" style={{ background: meta.color }} aria-hidden />
              )}
            </li>
          )
        })}
      </ol>
      <div className="hidden shrink-0 items-center gap-4 px-4 t-meta lg:flex">
        <span className="tnum">
          {live.status === 'running'
            ? `Pipeline działa (${live.mode === 'live' ? 'live z fallbackiem' : 'snapshot'})`
            : live.status === 'error'
              ? <span className="text-error">Przebieg przerwany: {live.error}</span>
              : `Ostatni run ${formatDateTime(run.finishedAt)} · ${formatDuration(run.durationMs)} · ${run.mode === 'live' ? 'live' : 'snapshot'}`}
        </span>
        <Link href={run.etlHref} className="font-semibold text-ink underline">Pokaż w ETL Lab</Link>
      </div>
    </div>
  )
}
