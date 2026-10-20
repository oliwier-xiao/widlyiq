'use client'

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
            // Switching views happens dozens of times a session and triggers a server render, so the plate moves instantly.
            className={`shrink-0 px-3 py-1.5 text-[15px] font-semibold transition-colors duration-150 ${active ? 'bg-paper text-ink' : 'text-dot-soft hover:text-paper'}`}
          >
            {VIEW_LABELS[v]}
          </Link>
        )
      })}
    </nav>
  )
}
