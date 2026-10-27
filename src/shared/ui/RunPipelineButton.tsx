'use client'

import { PlayIcon } from '@phosphor-icons/react'

import { STAGE_META } from '@/shared/lib/stages'

import { usePipelineRun, type RunMode } from './PipelineRun'

export function RunPipelineButton({ mode = 'live', size = 'bar' }: { mode?: RunMode; size?: 'bar' | 'large' }) {
  const run = usePipelineRun()
  const busy = run.status === 'running'
  // The first second of a run is Python importing pandas and scikit-learn, before any stage event arrives.
  const label = busy ? (run.running ? `${STAGE_META[run.running].label}…` : 'Uruchamianie…') : 'Uruchom pipeline'
  return (
    <button
      type="button"
      onClick={() => run.start(mode)}
      disabled={busy}
      className={`inline-flex items-center gap-2 bg-signal text-ink transition-[transform,background-color] duration-150 ease-[var(--ease-out)] hover:bg-signal-hover active:scale-[0.97] disabled:cursor-progress disabled:bg-signal-disabled ${size === 'large' ? 'h-12 px-6 t-subhead' : 'h-9 px-4 t-control'}`}
    >
      {busy ? <span className="spinner" aria-hidden /> : <PlayIcon size={size === 'large' ? 18 : 15} weight="fill" aria-hidden />}
      <span className="text-left sm:min-w-[8.5rem]">
        {busy ? label : <>Uruchom<span className="hidden sm:inline"> pipeline</span></>}
      </span>
    </button>
  )
}
