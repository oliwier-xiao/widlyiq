import { CATEGORY_LABELS, CONTRACT_LABELS } from '@/shared/lib/filters'
import { formatNumber, formatRegion } from '@/shared/lib/formatters'
import { CodeButton } from '@/shared/ui/CodeDrawer'
import { FilterBar } from '@/shared/ui/FilterBar'
import { Panel, SeamGrid } from '@/shared/ui/Panel'
import type { ViewProps } from '@/shared/ui/types'

import { CooccurrenceHeatmap, PairPanel } from './CooccurrenceHeatmap'
import { PairSelectionProvider } from './PairSelection'
import { MIN_SKILL_SAMPLE, getSkillGraph } from './queries'
import { SkillScatter } from './SkillScatter'

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
            title="Współwystępowanie X.T @ X"
            subtitle={`${data.skills.length} najczęstszych technologii, ułożonych grupowaniem hierarchicznym po odległości 1 − Jaccard.`}
            actions={<CodeButton anchor="cooccur-matrix" />}
            footer={data.source === 'python'
              ? `Macierz z Pythona: scipy.sparse, X.T @ X na ${formatNumber(data.offers)} ofertach · ${provenance}`
              : `Liczone w SQLite z offer_skills, ta sama macierz X.T @ X · ${formatNumber(data.offers)} ofert (${scope}) · ${provenance}`}
          >
            <CooccurrenceHeatmap skills={data.skills} pairs={data.pairs} minPairCount={minPairCount} />
          </Panel>
          <Panel className="lg:col-start-2 lg:row-start-2" title="Para technologii">
            <PairPanel skills={data.skills} pairs={data.pairs} minPairCount={minPairCount} />
          </Panel>
          <Panel
            className="lg:col-start-2 lg:row-start-1"
            title="Popyt a płaca"
            subtitle={`Kropka to technologia, wielkość to siła premii Ridge: pełna dodatnia, pusta ujemna.${regionLabel ? ` Pomarańczowy pierścień: popyt w regionie ${regionLabel}.` : ''}`}
            actions={<CodeButton anchor="onehot-encode" />}
            footer={`Mediana bez ofert z imputacją. Premia Ridge pochodzi z modelu na wszystkich ofertach.${hidden > 0 ? ` Pominięto ${hidden} technologii z mniej niż ${MIN_SKILL_SAMPLE} ofertami z widełkami.` : ''}`}
          >
            <div className="hidden md:block"><SkillScatter skills={plotted} regionLabel={regionLabel} /></div>
            <div className="md:hidden"><SkillScatter skills={plotted} regionLabel={regionLabel} compact /></div>
          </Panel>
        </SeamGrid>
      </PairSelectionProvider>
    </>
  )
}
