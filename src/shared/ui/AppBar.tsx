import Link from 'next/link'

import type { Filters, View } from '@/shared/lib/filters'

import { RunPipelineButton } from './RunPipelineButton'
import { ViewTabs } from './ViewTabs'

type Provenance = { mode: 'live' | 'snapshot'; synthetic: boolean; fallbacks: number } | null

export function AppBar({ view, filters, provenance }: { view: View; filters: Filters; provenance: Provenance }) {
  return (
    <header className="sticky top-0 z-40 bg-carbon text-paper">
      <div className="flex h-12 items-center gap-5 px-4 lg:px-6">
        <Link href="/" className="shrink-0 text-[19px] font-extrabold tracking-[-0.01em] text-paper [font-stretch:125%]">
          WidlyIQ
        </Link>
        <ViewTabs view={view} filters={filters} />
        <div className="ml-auto flex shrink-0 items-center gap-3">
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
