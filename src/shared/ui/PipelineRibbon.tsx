'use client'

import Link from 'next/link'

import { formatDateTime, formatDuration, formatNumber } from '@/shared/lib/formatters'
import { RIBBON_STAGES, STAGE_META, ribbonLabel, ribbonShort, type StageId, type StageSnapshot } from '@/shared/lib/stages'

import { useCodeDrawer } from './CodeDrawer'
import { usePipelineRun, useStageFocus } from './PipelineRun'

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
  const { focus, setFocus } = useStageFocus()
  const { open } = useCodeDrawer()
  const stored = Object.fromEntries(run.stages.map((s) => [s.stage, s])) as Partial<Record<StageId, StageSnapshot>>
  const showingLive = live.status === 'running' || live.status === 'error'
  const source = showingLive ? live.stages : stored
  const raw = source.extract?.rows_out ?? 0

  return (
    <div className="relative flex h-11 items-stretch border-b border-seam bg-toolbar">
      <ol className="flex min-w-0 flex-1 gap-[2px] pr-[2px]" aria-label="Przepływ rekordów przez pipeline">
        {RIBBON_STAGES.map((id, i) => {
          const snap = source[id]
          const meta = STAGE_META[id]
          const running = live.running === id
          const focused = focus === id
          // The notch grows with the share of records the stage dropped, so a heavy dedupe reads heavier than 18 schema errors.
          const notch = snap && raw ? Math.min(44, Math.max(10, (snap.removed / raw) * 400)) : 0
          return (
            <li key={id} className="relative min-w-0 flex-1 pb-[6px] md:min-w-[120px]">
              <button
                type="button"
                onClick={() => open(meta.anchor)}
                onPointerEnter={() => setFocus(id)}
                onPointerLeave={() => setFocus(null)}
                onFocus={() => setFocus(id)}
                onBlur={() => setFocus(null)}
                aria-describedby={focused ? 'ribbon-hint' : undefined}
                className={`relative flex h-full w-full items-center overflow-hidden px-1.5 text-left md:px-3 ${focused ? 'outline-2 -outline-offset-2 outline-paper' : ''}`}
                // While a run streams, the cell stays grey and the fill span reveals its colour left to right.
                style={{ background: snap && live.status === 'idle' ? meta.color : running ? 'transparent' : '#e7e9e4' }}
              >
                {running && <span className="ribbon-running absolute inset-0" aria-hidden />}
                {snap && live.status !== 'idle' && (
                  <span key={`${snap.rows_out}-${snap.duration_ms}`} className="ribbon-fill absolute inset-0" style={{ background: meta.color }} aria-hidden />
                )}
                <span className={`relative truncate text-[12px] font-semibold tnum md:t-table md:font-semibold ${snap ? 'text-paper' : 'text-ink-2'}`}>
                  <span className="md:hidden">{snap ? ribbonShort(snap) : running ? '…' : ''}</span>
                  <span className="hidden md:inline">{snap ? ribbonLabel(snap) : running ? `${meta.label}…` : meta.label}</span>
                </span>
              </button>
              {snap && LOSS_STAGES.has(id) && snap.removed > 0 && (
                <span className="absolute bottom-0 right-2 h-[6px]" style={{ background: meta.color, width: notch }} aria-hidden />
              )}
              {focused && snap && (
                <div id="ribbon-hint" role="tooltip"
                  className={`pointer-events-none absolute top-full z-30 mt-1 w-max max-w-[280px] bg-carbon px-3 py-2 text-paper ${i >= RIBBON_STAGES.length - 2 ? 'right-0' : 'left-0'}`}>
                  <p className="text-[14px] font-semibold">{meta.label} <span className="t-code text-dot-soft">[{meta.anchor}]</span></p>
                  <p className="mt-0.5 text-[13px] text-dot-soft">{meta.what}</p>
                  <p className="mt-1 text-[13px] tnum">
                    {formatNumber(snap.rows_in)} → {formatNumber(snap.rows_out)} · {formatDuration(snap.duration_ms)} · kliknij, żeby zobaczyć kod
                  </p>
                </div>
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
