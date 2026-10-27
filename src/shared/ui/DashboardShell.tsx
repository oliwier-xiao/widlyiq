import type { ReactNode } from 'react'

import type { RunInfo } from '@/shared/db/run'
import { VIEW_LABELS, type View } from '@/shared/lib/filters'
import type { StageSnapshot } from '@/shared/lib/stages'

import { AppBar } from './AppBar'
import { PipelineRibbon } from './PipelineRibbon'
import { PipelineRunProvider } from './PipelineRun'

type Props = { view: View; run: RunInfo | null; children: ReactNode }

export function DashboardShell({ view, run, children }: Props) {
  const provenance = run
    ? { mode: run.mode, synthetic: run.synthetic, fallbacks: run.sources.filter((s) => s.mode === 'snapshot').length }
    : null
  return (
    <PipelineRunProvider>
      <AppBar view={view} provenance={provenance} />
      {run && (
        <PipelineRibbon
          run={{
            stages: run.stages as unknown as StageSnapshot[],
            finishedAt: run.finishedAt,
          }}
          onEtl={view === 'etl'}
        />
      )}
      <main className="min-w-0">
        {/* The active tab names the view visually; screen readers get the same name as the page heading. */}
        {run && <h1 className="sr-only">{VIEW_LABELS[view]}</h1>}
        {children}
      </main>
    </PipelineRunProvider>
  )
}
