'use client'

import { motion } from 'motion/react'

import { formatDuration, formatNumber } from '@/shared/lib/formatters'
import { STAGE_META, STAGE_ORDER, type StageId, type StageSnapshot } from '@/shared/lib/stages'
import { CodeButton } from '@/shared/ui/CodeDrawer'
import { usePipelineRun, useStageFocus } from '@/shared/ui/PipelineRun'

import { stageDetail } from './stage-detail'

type Props = { stages: StageSnapshot[]; raw: number }

export function StageList({ stages, raw }: Props) {
  const live = usePipelineRun()
  const { focus, setFocus } = useStageFocus()
  const streaming = live.status === 'running' || live.status === 'error'
  const stored = Object.fromEntries(stages.map((s) => [s.stage, s])) as Partial<Record<StageId, StageSnapshot>>
  const source = streaming ? live.stages : stored
  const total = source.extract?.rows_out ?? (streaming ? 0 : raw)

  return (
    <ol className="border-t border-seam" aria-label="Etapy pipeline">
      {STAGE_ORDER.map((id, i) => {
        const snap = source[id]
        const meta = STAGE_META[id]
        const state = snap ? 'done' : live.running === id ? 'running' : streaming ? 'pending' : 'missing'
        const kept = snap && total ? (snap.rows_out / total) * 100 : 0
        const lost = snap && total ? (snap.removed / total) * 100 : 0
        return (
          <li
            key={id}
            onPointerEnter={() => setFocus(id)}
            onPointerLeave={() => setFocus(null)}
            className={`grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b border-seam px-5 py-3 transition-colors duration-150 md:grid-cols-[2rem_minmax(0,15rem)_minmax(0,1fr)_13.5rem] ${focus === id ? 'bg-toolbar' : ''}`}
          >
            <span className="t-table pt-0.5 text-ink-2">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="size-2.5 shrink-0" style={{ background: meta.color }} aria-hidden />
                <span className="font-semibold">{meta.label}</span>
                {state === 'running' && <span className="spinner text-ink-2" aria-label="w toku" />}
              </div>
              <motion.p
                key={state === 'done' ? `${snap!.rows_out}-${snap!.duration_ms}` : state}
                className="t-meta mt-0.5"
                initial={streaming ? { opacity: 0, y: 3 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                {state === 'done' ? stageDetail(id, snap!.detail) : state === 'running' ? 'w toku…' : state === 'pending' ? 'oczekuje' : meta.what}
              </motion.p>
            </div>
            <div className="col-start-2 mt-2 min-w-0 md:col-start-3 md:mt-0">
              <div className="flex items-baseline justify-between gap-3 t-table">
                <span className="tnum">
                  {snap && id === 'extract' ? (
                    <>pobrano <strong className="font-semibold">{formatNumber(snap.rows_out)}</strong></>
                  ) : snap ? (
                    <>
                      {formatNumber(snap.rows_in)} <span className="text-ink-2">→</span> <strong className="font-semibold">{formatNumber(snap.rows_out)}</strong>
                      {snap.removed > 0 && <span className="ml-2 font-semibold" style={{ color: meta.color }}>{'−'}{formatNumber(snap.removed)}</span>}
                    </>
                  ) : (
                    <span className="text-ink-2">{streaming ? '' : 'brak danych'}</span>
                  )}
                </span>
                <span className="tnum text-ink-2">{snap ? formatDuration(snap.duration_ms) : ''}</span>
              </div>
              {/* Funnel bar: the dark part is what survives, the coloured slice is what this stage removed. */}
              <div className="mt-1.5 flex h-2 bg-toolbar" aria-hidden>
                <motion.span
                  className="block h-full bg-ink-2"
                  initial={false}
                  animate={{ width: `${kept}%` }}
                  transition={{ duration: streaming ? 0.2 : 0, ease: [0.23, 1, 0.32, 1] }}
                />
                {lost > 0 && <span className="block h-full" style={{ width: `${Math.max(lost, 0.6)}%`, background: meta.color }} />}
              </div>
            </div>
            <div className="col-start-2 mt-2 md:col-start-4 md:mt-0 md:flex md:justify-end md:pl-3">
              <CodeButton anchor={meta.anchor} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
