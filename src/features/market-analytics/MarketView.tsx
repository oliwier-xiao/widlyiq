import { CATEGORY_LABELS, CONTRACT_UNITS } from '@/shared/lib/filters'
import { formatNumber, formatRegion } from '@/shared/lib/formatters'
import { CodeButton } from '@/shared/ui/CodeDrawer'
import { FilterBar } from '@/shared/ui/FilterBar'
import { Panel, SeamGrid } from '@/shared/ui/Panel'
import type { ViewProps } from '@/shared/ui/types'

import { AnswerReadout } from './AnswerReadout'
import { layoutField } from './field'
import { OfferField } from './OfferField'
import { PortalTable } from './PortalTable'
import { getMarketData } from './queries'
import { RegionRanking } from './RegionRanking'

export function MarketView({ filters, regions, run }: ViewProps) {
  const data = getMarketData(filters)
  const layout = layoutField(data.field, data.rejected, filters)
  const scopeLabel = filters.category === 'all' ? 'wszystkie kategorie' : CATEGORY_LABELS[filters.category]
  const regionLabel = filters.region === 'polska' ? 'cała Polska' : formatRegion(filters.region)

  return (
    <>
      <FilterBar view="market" filters={filters} regions={regions} fields={['seniority', 'category', 'contract', 'region', 'portal']} />
      <SeamGrid className="border-b border-seam lg:grid-cols-[minmax(0,1.6fr)_minmax(400px,1fr)]">
        {/* On a phone the answer comes first; on a desktop the field leads on the left. */}
        <div className="order-2 flex min-w-0 flex-col gap-px lg:order-1">
          <Panel
            title="Pole ofert"
            subtitle={`Każda kropka to jedna oferta (${scopeLabel}, zł ${CONTRACT_UNITS[filters.contract]}). Pomarańczowe: ${regionLabel}. Kliknij poziom, żeby go wybrać.`}
            actions={<CodeButton anchor="normalize-nbp" />}
            footer={
              <span className="tnum">
                Pokazano {formatNumber(layout.shown)} z {formatNumber(layout.total)} ofert z widełkami · puste kółka: odrzucone przez IQR ·
                NBP {run.metrics.nbp_table} · GUS BDL {run.metrics.gus_year}{run.synthetic ? ' · dane syntetyczne' : ''}
              </span>
            }
          >
            <OfferField layout={layout} filters={filters} />
          </Panel>
          <PortalTable portals={data.portals} className="flex-1" />
        </div>
        <div className="order-1 flex min-w-0 flex-col gap-px lg:order-2">
          <AnswerReadout answer={data.answer} filters={filters} />
          <RegionRanking regions={data.regions} polska={data.polska} filters={filters} gusYear={data.answer.gusYear} className="flex-1" />
        </div>
      </SeamGrid>
    </>
  )
}
