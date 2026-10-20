'use client'

import { CodeIcon, XIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { highlightLine, type Token } from '@/shared/lib/highlight'
import type { Anchor } from '@/shared/lib/stages'

type Snippet = { anchor: Anchor; file: string; anchorLine: number; startLine: number; lines: string[]; totalLines: number }
type DrawerState = { anchor: Anchor | null; snippet: Snippet | null; error: string | null }

const Ctx = createContext<{ open: (anchor: Anchor) => void } | null>(null)

const TOKEN_CLASS: Record<Token['kind'], string> = {
  plain: 'text-ink',
  keyword: 'text-stage-extract font-semibold',
  string: 'text-stage-tier',
  number: 'text-stage-impute',
  comment: 'text-ink-2',
  anchor: 'text-signal-ink font-semibold',
  def: 'text-stage-schema font-semibold',
  builtin: 'text-stage-nbp',
}

export function CodeDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DrawerState>({ anchor: null, snippet: null, error: null })
  const cache = useRef(new Map<Anchor, Snippet>())

  const open = useCallback(async (anchor: Anchor) => {
    const cached = cache.current.get(anchor)
    setState({ anchor, snippet: cached ?? null, error: null })
    if (cached) return
    try {
      const res = await fetch(`/api/code?anchor=${anchor}`)
      const data = (await res.json()) as Snippet & { error?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      cache.current.set(anchor, data)
      setState((s) => (s.anchor === anchor ? { anchor, snippet: data, error: null } : s))
    } catch (err) {
      setState((s) => (s.anchor === anchor ? { ...s, error: err instanceof Error ? err.message : String(err) } : s))
    }
  }, [])

  const close = useCallback(() => setState({ anchor: null, snippet: null, error: null }), [])
  const value = useMemo(() => ({ open }), [open])

  return (
    <Ctx.Provider value={value}>
      {children}
      <Drawer state={state} onClose={close} />
    </Ctx.Provider>
  )
}

export function useCodeDrawer() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCodeDrawer must be used inside CodeDrawerProvider')
  return ctx
}

export function CodeButton({ anchor, label = 'Kod' }: { anchor: Anchor; label?: string }) {
  const { open } = useCodeDrawer()
  return (
    <button
      type="button"
      onClick={() => open(anchor)}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 border border-seam bg-paper px-2.5 font-mono t-micro font-normal text-ink transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-toolbar active:scale-[0.97]"
      aria-label={`Pokaż kod Pythona dla [${anchor}]`}
    >
      <CodeIcon size={14} weight="bold" aria-hidden />
      {label} <span className="text-ink-2">[{anchor}]</span>
    </button>
  )
}

function Drawer({ state, onClose }: { state: DrawerState; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  // Full transform strings run on the compositor; motion's x shorthand animates on the main thread.
  const hidden = reduce ? { opacity: 0 } : { transform: 'translateX(100%)' }
  const shown = reduce ? { opacity: 1 } : { transform: 'translateX(0%)' }

  useEffect(() => {
    if (!state.anchor) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [state.anchor, onClose])

  useEffect(() => {
    if (!state.snippet) return
    panel.current?.querySelector('[data-anchor-line]')?.scrollIntoView({ block: 'center' })
  }, [state.snippet])

  return (
    <AnimatePresence>
      {state.anchor && (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.div
            className="absolute inset-0 bg-carbon/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={`Kod źródłowy [${state.anchor}]`}
            className="absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col bg-paper outline-none"
            initial={hidden}
            animate={shown}
            exit={{ ...hidden, transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          >
            <header className="flex items-center justify-between gap-4 bg-carbon px-5 py-3 text-paper">
              <div className="min-w-0">
                <p className="t-code truncate text-paper">{state.snippet?.file ?? 'Ładowanie…'}</p>
                <p className="text-[13px] text-dot-soft">
                  Kotwica <span className="t-code text-signal">[{state.anchor}]</span>
                  {state.snippet && ` · linie ${state.snippet.startLine} do ${state.snippet.startLine + state.snippet.lines.length - 1} z ${state.snippet.totalLines}`}
                </p>
              </div>
              <button type="button" onClick={onClose} className="grid size-9 place-items-center text-paper hover:bg-carbon-2" aria-label="Zamknij kod">
                <XIcon size={18} weight="bold" aria-hidden />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto py-3">
              {state.error && <p className="px-5 text-[15px] text-error">Nie udało się wczytać kodu: {state.error}</p>}
              {!state.snippet && !state.error && <CodeSkeleton />}
              {state.snippet && (
                <pre className="t-code">
                  {state.snippet.lines.map((line, i) => {
                    const n = state.snippet!.startLine + i
                    const isAnchor = n === state.snippet!.anchorLine
                    return (
                      <div key={n} data-anchor-line={isAnchor || undefined} className={`flex pr-5 ${isAnchor ? 'bg-signal-wash' : ''}`}>
                        <span className={`w-14 shrink-0 select-none pr-4 text-right ${isAnchor ? 'text-signal-ink' : 'text-ink-3'}`}>{n}</span>
                        <code className="whitespace-pre">
                          {highlightLine(line).map((t, j) => <span key={j} className={TOKEN_CLASS[t.kind]}>{t.text}</span>)}
                        </code>
                      </div>
                    )
                  })}
                </pre>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function CodeSkeleton() {
  return (
    <div className="space-y-2 px-5" aria-hidden>
      {[72, 54, 88, 40, 66, 80, 48].map((w, i) => <div key={i} className="h-3.5 bg-toolbar" style={{ width: `${w}%` }} />)}
    </div>
  )
}
