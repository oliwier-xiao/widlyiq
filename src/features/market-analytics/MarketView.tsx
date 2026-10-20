import { CATEGORY_LABELS, CONTRACT_UNITS, SENIORITY_LABELS, type Filters } from '@/shared/lib/filters'
import { formatNumber, formatRegion } from '@/shared/lib/formatters'
import { MIN_SAMPLE } from '@/shared/lib/stats'
import { CodeButton } from '@/shared/ui/CodeDrawer'
import { FilterBar } from '@/shared/ui/FilterBar'
import { Panel, SeamGrid } from '@/shared/ui/Panel'
import type { ViewProps } from '@/shared/ui/types'

import { AnswerReadout } from './AnswerReadout'
import { DESKTOP, layoutField, MOBILE } from './field'
import { OfferField } from './OfferField'
import { PortalTable } from './PortalTable'
import { getMarketData, type Answer } from './queries'
import { RegionRanking } from './RegionRanking'

function where(region: string): string {
  if (region === 'polska') return 'w całej Polsce'
  if (region === 'zdalnie') return 'w ofertach zdalnych'
  return `w województwie ${region.replace(/ie$/, 'im')}`
}

/** The readout gives the median; this sentence gives what a single number cannot: where most offers actually fall. */
function Headline({ answer, filters }: { answer: Answer; filters: Filters }) {
  const who = `${SENIORITY_LABELS[filters.seniority]}${filters.category === 'all' ? '' : ` ${CATEGORY_LABELS[filters.category]}`}`
  const unit = filters.contract === 'b2b' ? 'zł netto' : filters.contract === 'uop' ? 'zł brutto' : 'zł'
  const n = (v: number) => <strong className="font-extrabold tnum">{formatNumber(Math.round(v / 100) * 100)}</strong>
  return (
    <p className="t-headline max-w-[78ch] text-ink">
      {answer.pct ? (
        <>Połowa ofert dla {who} {where(filters.region)} mieści się między {n(answer.pct.p25)} a {n(answer.pct.p75)} {unit}, a co dziesiąta przekracza {n(answer.pct.p90)} {unit}.</>
      ) : (
        <>Dla {who} {where(filters.region)} jest {formatNumber(answer.n)} ofert z widełkami, mniej niż {MIN_SAMPLE}, więc rozkładu nie opisujemy. Poszerz filtr.</>
      )}
    </p>
  )
}

export function MarketView({ filters, regions, run }: ViewProps) {
  const data = getMarketData(filters)
  const desktop = layoutField(data.field, data.rejected, filters, DESKTOP)
  const mobile = layoutField(data.field, data.rejected, filters, MOBILE)
  const scopeLabel = filters.category === 'all' ? 'wszystkie kategorie' : CATEGORY_LABELS[filters.category]
  const regionLabel = filters.region === 'polska' ? 'cała Polska' : formatRegion(filters.region)

  return (
    <>
      <FilterBar view="market" filters={filters} regions={regions} fields={['seniority', 'category', 'contract', 'region', 'portal']} />
      <div className="border-b border-seam px-4 py-4 lg:px-6">
        <Headline answer={data.answer} filters={filters} />
      </div>
      <SeamGrid className="border-b border-seam lg:grid-cols-[minmax(0,1.6fr)_minmax(400px,1fr)]">
        {/* On a phone the answer comes first; on a desktop the field leads on the left. */}
        <Panel
          className="order-2 lg:order-1"
          stretch={false}
          title="Pole ofert"
          subtitle={`Każda kropka to jedna oferta (${scopeLabel}, zł ${CONTRACT_UNITS[filters.contract]}). Pomarańczowe: ${regionLabel}. Kliknij poziom, żeby go wybrać.`}
          actions={<CodeButton anchor="normalize-nbp" />}
          footer={
            <span className="tnum">
              Pokazano {formatNumber(desktop.shown)} z {formatNumber(desktop.total)} ofert z widełkami · puste kółka: odrzucone przez IQR ·
              NBP {run.metrics.nbp_table} · GUS BDL {run.metrics.gus_year}{run.synthetic ? ' · dane syntetyczne' : ''}
            </span>
          }
        >
          <div className="hidden md:block"><OfferField layout={desktop} filters={filters} /></div>
          <div className="md:hidden"><OfferField layout={mobile} filters={filters} /></div>
        </Panel>
        <div className="order-1 flex min-w-0 flex-col gap-px lg:order-2">
          <AnswerReadout answer={data.answer} filters={filters} />
          <RegionRanking regions={data.regions} polska={data.polska} filters={filters} gusYear={data.answer.gusYear} />
          <PortalTable portals={data.portals} className="flex-1" />
        </div>
      </SeamGrid>
    </>
  )
}
