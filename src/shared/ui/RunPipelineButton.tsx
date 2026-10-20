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
      aria-live="polite"
      className={`inline-flex items-center gap-2 bg-signal font-semibold text-ink transition-[transform,background-color] duration-150 ease-[var(--ease-out)] hover:bg-[#ff6f36] active:scale-[0.97] disabled:cursor-progress disabled:bg-[#ffb08c] ${size === 'large' ? 'h-12 px-6 text-[17px]' : 'h-9 px-4 text-[15px]'}`}
    >
      {busy ? <span className="spinner" aria-hidden /> : <PlayIcon size={size === 'large' ? 18 : 15} weight="fill" aria-hidden />}
      <span className="min-w-[8.5rem] text-left">{label}</span>
    </button>
  )
}
