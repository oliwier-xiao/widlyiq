import { CATEGORY_LABELS, CONTRACT_LABELS } from '@/shared/lib/filters'
import { formatRegion, offersLabel, plural } from '@/shared/lib/formatters'
import { FilterBar } from '@/shared/ui/FilterBar'
import { Panel, SeamGrid } from '@/shared/ui/Panel'
import type { ViewProps } from '@/shared/ui/types'

import { CooccurrenceHeatmap, PairPanel } from './CooccurrenceHeatmap'
import { PairSelectionProvider } from './PairSelection'
import { MIN_SKILL_SAMPLE, getSkillGraph } from './queries'
import { SkillScatter } from './SkillScatter'

/** Marks named once in a legend instead of a sentence that describes them. */
function ScatterLegend({ regionLabel }: { regionLabel: string | null }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink" aria-hidden />premia dodatnia</li>
      <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-[1.5px] border-ink" aria-hidden />premia ujemna</li>
      <li>większa kropka, większa premia</li>
      {regionLabel && <li className="flex items-center gap-1.5"><span className="size-3 rounded-full border border-signal" aria-hidden />popyt: {regionLabel}</li>}
    </ul>
  )
}

export function SkillGraphView({ filters, regions, run }: ViewProps) {
  const data = getSkillGraph(filters)
  const regionLabel = filters.region === 'polska' ? null : formatRegion(filters.region)
  const plotted = data.skills.filter((s) => s.demand > 0 && s.median != null)
  const hidden = data.skills.length - plotted.length
  const provenance = run.synthetic ? 'dane syntetyczne' : run.mode === 'live' ? 'dane live' : 'snapshot'
  const scope = [
    filters.category !== 'all' && CATEGORY_LABELS[filters.category],
    filters.contract !== 'all' && CONTRACT_LABELS[filters.contract],
  ].filter(Boolean).join(' · ')
  // Small filtered samples get a lower support bar for the lift ranking, or the list would always be empty.
  const minPairCount = data.offers >= 600 ? 10 : 5

  return (
    <>
      <FilterBar view="skills" filters={filters} regions={regions} fields={['category', 'contract', 'region']} />
      <PairSelectionProvider names={data.skills.map((s) => s.skill)}>
        {/* DOM order is heatmap, pair, scatter so phones read the pair right under the grid; lg places them by grid lines. */}
        <SeamGrid className="border-b border-seam lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Panel
            className="lg:col-start-1 lg:row-span-2 lg:row-start-1"
            title="Które technologie występują razem"
            subtitle={`${data.skills.length} najczęstszych technologii, pogrupowanych w klastry tych, które często idą w parze.`}
            footer={`${offersLabel(data.offers)}${scope ? ` (${scope})` : ''} · ${provenance}`}
          >
            <CooccurrenceHeatmap skills={data.skills} pairs={data.pairs} minPairCount={minPairCount} />
          </Panel>
          <Panel className="lg:col-start-2 lg:row-start-2" title="Para technologii">
            <PairPanel skills={data.skills} pairs={data.pairs} minPairCount={minPairCount} />
          </Panel>
          <Panel
            className="lg:col-start-2 lg:row-start-1"
            title="Popyt a płaca"
            subtitle="Ile ofert wymaga technologii i ile w nich płacą."
            footer={
              <div className="flex flex-col gap-1.5">
                <ScatterLegend regionLabel={regionLabel} />
                <span>Mediana bez ofert z imputacją.{hidden > 0 ? ` Pominięto ${plural(hidden, 'technologię', 'technologie', 'technologii')} z mniej niż ${MIN_SKILL_SAMPLE} ofertami z widełkami.` : ''}</span>
              </div>
            }
          >
            <div className="hidden md:block"><SkillScatter skills={plotted} regionLabel={regionLabel} /></div>
            <div className="md:hidden"><SkillScatter skills={plotted} regionLabel={regionLabel} compact /></div>
          </Panel>
        </SeamGrid>
      </PairSelectionProvider>
    </>
  )
}
