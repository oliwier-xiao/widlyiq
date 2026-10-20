import type { ReactNode } from 'react'

import type { RunInfo } from '@/shared/db/run'
import { toSearch, type Filters, type View } from '@/shared/lib/filters'
import type { StageSnapshot } from '@/shared/lib/stages'

import { AppBar } from './AppBar'
import { CodeDrawerProvider } from './CodeDrawer'
import { PipelineRibbon } from './PipelineRibbon'
import { PipelineRunProvider } from './PipelineRun'

type Props = { view: View; filters: Filters; run: RunInfo | null; children: ReactNode }

export function DashboardShell({ view, filters, run, children }: Props) {
  const provenance = run
    ? { mode: run.mode, synthetic: run.synthetic, fallbacks: run.sources.filter((s) => s.mode === 'snapshot').length }
    : null
  return (
    <PipelineRunProvider>
      <CodeDrawerProvider>
        <AppBar view={view} filters={filters} provenance={provenance} />
        {run && (
          <PipelineRibbon
            run={{
              stages: run.stages as unknown as StageSnapshot[],
              finishedAt: run.finishedAt,
              durationMs: run.durationMs,
              mode: run.mode,
              etlHref: toSearch('etl', filters),
            }}
          />
        )}
        <main className="min-w-0">{children}</main>
      </CodeDrawerProvider>
    </PipelineRunProvider>
  )
}
