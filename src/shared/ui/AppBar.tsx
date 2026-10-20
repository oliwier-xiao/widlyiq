import Link from 'next/link'

import type { Filters, View } from '@/shared/lib/filters'

import { RunPipelineButton } from './RunPipelineButton'
import { ViewTabs } from './ViewTabs'

type Provenance = { mode: 'live' | 'snapshot'; synthetic: boolean; fallbacks: number } | null

export function AppBar({ view, filters, provenance }: { view: View; filters: Filters; provenance: Provenance }) {
  return (
    <header className="sticky top-0 z-40 bg-carbon text-paper">
      <div className="flex flex-wrap items-center gap-x-5 px-4 md:h-12 md:flex-nowrap lg:px-6">
        <Link href="/" className="flex h-12 shrink-0 items-center text-[19px] font-extrabold tracking-[-0.01em] text-paper [font-stretch:125%]">
          WidlyIQ
        </Link>
        {/* Phones get the tabs on their own scrolling row so all four views stay visible. */}
        <div className="order-3 -mx-4 w-[calc(100%+2rem)] border-t border-carbon-2 px-2 py-1.5 md:order-none md:mx-0 md:w-auto md:border-0 md:p-0">
          <ViewTabs view={view} filters={filters} />
        </div>
        <div className="ml-auto flex h-12 shrink-0 items-center gap-3">
          {provenance && (
            <span className="hidden items-center gap-2 border border-carbon-2 px-2.5 py-1 text-[13px] text-dot-soft md:inline-flex">
              <span className={`size-2 ${provenance.mode === 'live' && provenance.fallbacks === 0 ? 'bg-[#3ccf74]' : 'bg-signal'}`} aria-hidden />
              {provenance.mode === 'live'
                ? provenance.fallbacks > 0 ? `Live · ${provenance.fallbacks} ze snapshotu` : 'Live'
                : 'Snapshot'}
              {provenance.synthetic && ' · dane syntetyczne'}
            </span>
          )}
          <RunPipelineButton />
        </div>
      </div>
    </header>
  )
}
