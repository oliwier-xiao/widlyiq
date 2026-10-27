'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { VIEWS, VIEW_LABELS, type View } from '@/shared/lib/filters'

/**
 * A link to another view that keeps every filter in the current URL. It reads the live URL, not server props,
 * because the estimator rewrites the URL in place and a server-built href would drop the profile just picked.
 */
export function useViewHref() {
  const params = useSearchParams()
  return (view: View, hash = '') => {
    const next = new URLSearchParams({ view })
    for (const [key, value] of params) if (key !== 'view') next.append(key, value)
    return `?${next.toString()}${hash}`
  }
}

export function ViewTabs({ view }: { view: View }) {
  const href = useViewHref()
  return (
    <nav aria-label="Widoki" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {VIEWS.map((v) => {
        const active = v === view
        return (
          <Link
            key={v}
            href={href(v)}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            // Switching views happens dozens of times a session and triggers a server render, so the plate moves instantly.
            className={`shrink-0 px-3 py-1.5 t-control transition-colors duration-150 ${active ? 'bg-paper text-ink' : 'text-dot-soft hover:text-paper'}`}
          >
            {VIEW_LABELS[v]}
          </Link>
        )
      })}
    </nav>
  )
}
