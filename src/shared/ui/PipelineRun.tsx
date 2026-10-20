'use client'

import { MotionConfig } from 'motion/react'
import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

import type { PipelineEvent, StageId, StageSnapshot } from '@/shared/lib/stages'

export type RunMode = 'live' | 'snapshot'
export type SourceEvent = Extract<PipelineEvent, { event: 'source' }>

type RunState = {
  status: 'idle' | 'running' | 'done' | 'error'
  mode: RunMode
  running: StageId | null
  stages: Partial<Record<StageId, StageSnapshot>>
  sources: SourceEvent[]
  error: string | null
  durationMs: number | null
}

type RunContext = RunState & { start: (mode: RunMode) => void }

const Ctx = createContext<RunContext | null>(null)
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
          return { ...s, status: 'error', running: null, error: e.message }
        default:
          return s
      }
    })
    if (e.event === 'summary') router.refresh()
  }, [router])

  const start = useCallback(async (mode: RunMode) => {
    if (busy.current) return
    busy.current = true
    setState({ ...IDLE, status: 'running', mode })
    try {
      const res = await fetch('/api/etl/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
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
          if (line.startsWith('{')) apply(JSON.parse(line) as PipelineEvent)
          nl = buffer.indexOf('\n')
        }
      }
    } catch (err) {
      apply({ event: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      busy.current = false
    }
  }, [apply])

  const value = useMemo(() => ({ ...state, start }), [state, start])
  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </Ctx.Provider>
  )
}

export function usePipelineRun(): RunContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePipelineRun must be used inside PipelineRunProvider')
  return ctx
}
