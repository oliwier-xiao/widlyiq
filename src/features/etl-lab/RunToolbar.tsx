'use client'

import { useState } from 'react'

import { formatDateTime, formatDuration } from '@/shared/lib/formatters'
import { STAGE_META, STAGE_ORDER } from '@/shared/lib/stages'
import { usePipelineRun, type RunMode } from '@/shared/ui/PipelineRun'
import { RunPipelineButton } from '@/shared/ui/RunPipelineButton'

const MODES: [RunMode, string][] = [['live', 'Live z fallbackiem'], ['snapshot', 'Tylko snapshot']]

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
        ? `Gotowe w ${formatDuration(live.durationMs ?? 0)}, dane odświeżone`
        : live.status === 'error'
          ? `Przebieg przerwany: ${live.error}`
          : `Ostatni przebieg ${formatDateTime(lastFinishedAt)} · ${lastMode === 'live' ? 'live' : 'snapshot'} · ${formatDuration(lastDurationMs)}`

  return (
    <div className="border-b border-seam bg-toolbar">
      <div className="flex min-h-[54px] flex-wrap items-center gap-3 px-4 py-2.5 lg:px-6">
        <div role="radiogroup" aria-label="Tryb przebiegu" className="flex h-9 border border-seam bg-paper p-[3px]">
          {MODES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              disabled={busy}
              onClick={() => setMode(value)}
              className={`px-3 text-[15px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed ${mode === value ? 'bg-carbon text-paper' : 'text-ink-2 hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <RunPipelineButton mode={mode} />
        <p
          className={`min-w-0 flex-1 basis-64 ${live.status === 'error' ? 'text-[13px] font-medium text-error' : 't-meta'}`}
          aria-live="polite"
        >
          {status}
        </p>
      </div>
    </div>
  )
}
