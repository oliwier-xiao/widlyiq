import { EtlLabView } from '@/features/etl-lab/EtlLabView'
import { MarketView } from '@/features/market-analytics/MarketView'
import { EstimatorView } from '@/features/salary-estimator/EstimatorView'
import { SkillGraphView } from '@/features/skill-graph/SkillGraphView'
import { getLatestRun, getRegions } from '@/shared/db/run'
import { hasDatabase } from '@/shared/db/sqlite'
import { parseParams } from '@/shared/lib/filters'
import { DashboardShell } from '@/shared/ui/DashboardShell'
import { EmptyState } from '@/shared/ui/EmptyState'

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const VIEWS = { market: MarketView, etl: EtlLabView, skills: SkillGraphView, estimator: EstimatorView }

export default async function Page({ searchParams }: PageProps) {
  const ready = hasDatabase()
  const regions = ready ? getRegions() : []
  const { view, filters } = parseParams(await searchParams, regions)
  const run = ready ? getLatestRun() : null
  const Content = VIEWS[view]
  return (
    <DashboardShell view={view} filters={filters} run={run}>
      {run ? <Content filters={filters} regions={regions} run={run} /> : <EmptyState />}
    </DashboardShell>
  )
}
