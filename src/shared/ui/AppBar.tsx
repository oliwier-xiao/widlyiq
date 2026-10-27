import Link from 'next/link'

import type { View } from '@/shared/lib/filters'

import { ViewTabs } from './ViewTabs'

type Provenance = { mode: 'live' | 'snapshot'; synthetic: boolean; fallbacks: number } | null

export function AppBar({ view, provenance }: { view: View; provenance: Provenance }) {
  return (
    <header className="sticky top-0 z-40 bg-carbon text-paper">
      <div className="flex flex-wrap items-center gap-x-5 px-5 lg:h-12 lg:flex-nowrap">
        <Link href="/" className="flex h-12 shrink-0 items-center t-wordmark text-paper">
          WidlyIQ
        </Link>
        {/* Below lg the tabs get their own scrolling row, so all four views stay visible and the bar never overflows. */}
        <div className="order-3 -mx-5 w-[calc(100%+2.5rem)] border-t border-carbon-2 px-3 py-1.5 lg:order-none lg:mx-0 lg:w-auto lg:border-0 lg:p-0">
          <ViewTabs view={view} />
        </div>
        <div className="ml-auto flex h-12 shrink-0 items-center gap-3">
          {provenance && (
            // Always visible: a synthetic figure must never appear without its label, phones included.
            <span className="inline-flex items-center gap-2 border border-carbon-2 px-2 py-1 t-micro font-medium text-dot-soft md:px-2.5">
              <span className={`size-2 ${provenance.mode === 'live' && provenance.fallbacks === 0 ? 'bg-live' : 'border-[1.5px] border-dot-soft'}`} aria-hidden />
              <span className="hidden md:inline">
                {provenance.mode === 'live'
                  ? provenance.fallbacks > 0 ? `Live · ${provenance.fallbacks} ze snapshotu` : 'Live'
                  : 'Snapshot'}
                {provenance.synthetic && ' · dane syntetyczne'}
              </span>
              <span className="md:hidden">{provenance.synthetic ? 'syntetyczne' : provenance.mode}</span>
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
