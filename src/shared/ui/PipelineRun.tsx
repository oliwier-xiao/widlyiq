'use client'

import { MotionConfig } from 'motion/react'
import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

import { describeRunError, type ClientFailure, type RunError } from '@/shared/lib/run-errors'
import type { PipelineEvent, StageId, StageSnapshot } from '@/shared/lib/stages'

export type RunMode = 'live' | 'snapshot'
export type SourceEvent = Extract<PipelineEvent, { event: 'source' }>

type RunState = {
  status: 'idle' | 'running' | 'done' | 'error'
  mode: RunMode
  running: StageId | null
  stages: Partial<Record<StageId, StageSnapshot>>
  sources: SourceEvent[]
  error: RunError | null
  durationMs: number | null
}

type RunContext = RunState & { start: (mode: RunMode) => void }

const Ctx = createContext<RunContext | null>(null)
// Kept apart from the run context: hover changes many times a second and must not re-render run consumers.
const FocusCtx = createContext<{ focus: StageId | null; setFocus: (s: StageId | null) => void }>({ focus: null, setFocus: () => {} })
const IDLE: RunState = { status: 'idle', mode: 'live', running: null, stages: {}, sources: [], error: null, durationMs: null }

export function PipelineRunProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<RunState>(IDLE)
  const busy = useRef(false)

  const apply = useCallback((e: PipelineEvent) => {
    setState((s) => {
      switch (e.event) {
        case 'stage':
          return e.status === 'running'
            ? { ...s, running: e.stage }
            : { ...s, running: null, stages: { ...s.stages, [e.stage]: e } }
        case 'source':
          return { ...s, sources: [...s.sources, e] }
        case 'summary':
          return { ...s, status: 'done', running: null, durationMs: e.duration_ms }
        case 'error':
          return { ...s, status: 'error', running: null, error: describeRunError(e, s.mode, s.running) }
        default:
          return s
      }
    })
    if (e.event === 'summary') router.refresh()
  }, [router])

  const fail = useCallback((failure: ClientFailure) => {
    setState((s) => ({ ...s, status: 'error', running: null, error: describeRunError(failure, s.mode, s.running) }))
  }, [])

  const start = useCallback(async (mode: RunMode) => {
    if (busy.current) return
    busy.current = true
    setState({ ...IDLE, status: 'running', mode })
    let finished = false
    try {
      let res: Response
      try {
        res = await fetch('/api/etl/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode }),
        })
      } catch {
        // fetch rejects only when no response arrived at all: the server is down or the network is gone.
        fail({ kind: 'network' })
        return
      }
      if (res.status === 409) return fail({ kind: 'busy' })
      if (!res.ok || !res.body) return fail({ kind: 'http', status: res.status })
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        let nl = buffer.indexOf('\n')
        while (nl >= 0) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (line.startsWith('{')) {
            const event = JSON.parse(line) as PipelineEvent
            if (event.event === 'summary' || event.event === 'error') finished = true
            apply(event)
          }
          nl = buffer.indexOf('\n')
        }
      }
      // A stream that closes without a summary or an error lost its connection mid-run.
      if (!finished) fail({ kind: 'cut' })
    } catch {
      if (!finished) fail({ kind: 'cut' })
    } finally {
      busy.current = false
    }
  }, [apply, fail])

  const value = useMemo(() => ({ ...state, start }), [state, start])
  const [focus, setFocus] = useState<StageId | null>(null)
  const focusValue = useMemo(() => ({ focus, setFocus }), [focus])
  return (
    <Ctx.Provider value={value}>
      <FocusCtx.Provider value={focusValue}>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </FocusCtx.Provider>
    </Ctx.Provider>
  )
}

/** The stage under the pointer anywhere on the page: the ribbon, the ETL Lab list and the diff notes all light up together. */
export function useStageFocus() {
  return useContext(FocusCtx)
}

export function usePipelineRun(): RunContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePipelineRun must be used inside PipelineRunProvider')
  return ctx
}
