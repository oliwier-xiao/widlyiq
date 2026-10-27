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
        {/* Side by side the matrix gets half a 1024 px projector and its labels drop to 10 px, so until 1340 px it takes
            a full row at its natural 760 px and the pair and the scatter share the row below. The breakpoint is in rem
            (83.75rem = 1340 px) because Tailwind orders px breakpoints before rem ones, and lg: would win over it. */}
        <SeamGrid className="border-b border-seam lg:grid-cols-2 min-[83.75rem]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Panel
            className="lg:col-span-2 min-[83.75rem]:col-span-1 min-[83.75rem]:col-start-1 min-[83.75rem]:row-span-2 min-[83.75rem]:row-start-1"
            title="Które technologie występują razem"
            subtitle={`${data.skills.length} najczęstszych technologii, pogrupowanych w klastry tych, które często idą w parze.`}
            // Region filters only the demand rings; the matrix is the same national one, and the footer says so.
            footer={`${offersLabel(data.offers)}${scope ? ` (${scope})` : ''} · ${provenance}${regionLabel ? ' · macierz dla całej Polski' : ''}`}
          >
            <CooccurrenceHeatmap skills={data.skills} pairs={data.pairs} minPairCount={minPairCount} />
          </Panel>
          <Panel className="lg:col-start-1 lg:row-start-2 min-[83.75rem]:col-start-2" title="Para technologii">
            <PairPanel skills={data.skills} pairs={data.pairs} minPairCount={minPairCount} />
          </Panel>
          <Panel
            className="lg:col-start-2 lg:row-start-2 min-[83.75rem]:row-start-1"
            title="Popyt a płaca"
            subtitle="Ile ofert wymaga technologii i ile w nich płacą."
            footer={
              <div className="flex flex-col gap-1.5">
                <ScatterLegend regionLabel={regionLabel} />
                <span>Mediana bez ofert z imputacją{regionLabel ? `, liczona dla całej Polski. Wybór regionu zmienia tylko pierścienie popytu` : ''}.{hidden > 0 ? ` Pominięto ${plural(hidden, 'technologię', 'technologie', 'technologii')} z mniej niż ${MIN_SKILL_SAMPLE} ofertami z widełkami.` : ''}</span>
              </div>
            }
          >
            {/* The panel's width picks the geometry: it is a full row on a tablet but half a row on a projector. */}
            <div className="@container">
              <div className="@min-[488px]:hidden"><SkillScatter skills={plotted} regionLabel={regionLabel} size="compact" /></div>
              <div className="hidden @min-[488px]:block @min-[618px]:hidden"><SkillScatter skills={plotted} regionLabel={regionLabel} size="medium" /></div>
              <div className="hidden @min-[618px]:block"><SkillScatter skills={plotted} regionLabel={regionLabel} size="full" /></div>
            </div>
          </Panel>
        </SeamGrid>
      </PairSelectionProvider>
    </>
  )
}
