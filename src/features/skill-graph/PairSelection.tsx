'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Cell = [number, number]

type Selection = {
  hover: Cell | null
  pinned: Cell | null
  active: Cell | null
  activeSkills: string[]
  setHover: (c: Cell | null) => void
  setPinned: (c: Cell | null) => void
  togglePin: (c: Cell) => void
}

const Ctx = createContext<Selection | null>(null)

/** Shared by the heatmap, the pair readout and the scatter, which sit in separate panels of one grid. */
export function PairSelectionProvider({ names, children }: { names: string[]; children: ReactNode }) {
  const [hover, setHover] = useState<Cell | null>(null)
  const [pinned, setPinned] = useState<Cell | null>(null)

  useEffect(() => {
    if (!pinned) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pinned])

  const value = useMemo<Selection>(() => {
    const active = pinned ?? hover
    return {
      hover, pinned, active,
      activeSkills: active ? [...new Set([names[active[0]], names[active[1]]])] : [],
      setHover, setPinned,
      togglePin: (c) => setPinned((p) => (p && p[0] === c[0] && p[1] === c[1] ? null : c)),
    }
  }, [hover, pinned, names])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePairSelection(): Selection {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePairSelection must be used inside PairSelectionProvider')
  return ctx
}
