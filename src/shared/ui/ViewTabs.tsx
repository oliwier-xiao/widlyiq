'use client'

import { motion } from 'motion/react'
import Link from 'next/link'

import { VIEWS, VIEW_LABELS, toSearch, type Filters, type View } from '@/shared/lib/filters'

export function ViewTabs({ view, filters }: { view: View; filters: Filters }) {
  return (
    <nav aria-label="Widoki" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {VIEWS.map((v) => {
        const active = v === view
        return (
          <Link
            key={v}
            href={toSearch(v, filters)}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            className={`relative shrink-0 px-3 py-1.5 text-[15px] font-semibold transition-colors duration-150 ${active ? 'text-ink' : 'text-dot-soft hover:text-paper'}`}
          >
            {active && (
              // Switching views happens dozens of times a session, so the plate slides fast and without bounce.
              <motion.span layoutId="active-view" className="absolute inset-0 bg-paper" transition={{ type: 'spring', duration: 0.22, bounce: 0 }} />
            )}
            <span className="relative">{VIEW_LABELS[v]}</span>
          </Link>
        )
      })}
    </nav>
  )
}
