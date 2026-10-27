import { CATEGORY_LABELS, CONTRACT_UNITS, SENIORITY_LABELS, type Filters } from '@/shared/lib/filters'
import { formatNumber, formatRegion, inRegion, offersLabel } from '@/shared/lib/formatters'
import { MIN_SAMPLE } from '@/shared/lib/stats'
import { FilterBar } from '@/shared/ui/FilterBar'
import { Panel, SeamGrid } from '@/shared/ui/Panel'
import type { ViewProps } from '@/shared/ui/types'

import { AnswerReadout } from './AnswerReadout'
import { DESKTOP, layoutField, MEDIUM, MOBILE } from './field'
import { OfferField } from './OfferField'
import { PortalTable } from './PortalTable'
import { getMarketData, type Answer } from './queries'
import { RegionRanking } from './RegionRanking'

/** The readout gives the median; this sentence gives what a single number cannot: where most offers actually fall. */
function Headline({ answer, filters }: { answer: Answer; filters: Filters }) {
  const who = `${SENIORITY_LABELS[filters.seniority]}${filters.category === 'all' ? '' : ` ${CATEGORY_LABELS[filters.category]}`}`
  const unit = filters.contract === 'b2b' ? 'zł netto' : filters.contract === 'uop' ? 'zł brutto' : 'zł'
  // Exact, not rounded to hundreds: the same percentile appears in the field labels and must read the same there.
  const n = (v: number) => <strong className="font-extrabold tnum">{formatNumber(v)}</strong>
  return (
    <p className="t-headline max-w-[72ch] text-ink">
      {answer.pct ? (
        <>Połowa ofert dla {who} {inRegion(filters.region)} mieści się między {n(answer.pct.p25)} a {n(answer.pct.p75)} {unit}, a co dziesiąta przekracza {n(answer.pct.p90)} {unit}.</>
      ) : (
        answer.n === 0
          ? <>Dla {who} {inRegion(filters.region)} nie ma ofert z widełkami. Poszerz filtr.</>
          : <>Dla {who} {inRegion(filters.region)} znaleźliśmy {offersLabel(answer.n)} z widełkami, mniej niż {MIN_SAMPLE}, więc rozkładu nie opisujemy. Poszerz filtr.</>
      )}
    </p>
  )
}

/** The legend replaces a sentence of explanation: three marks, each named once. */
function FieldLegend({ regionLabel }: { regionLabel: string | null }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-dot" aria-hidden />Polska</li>
      {regionLabel && <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-signal" aria-hidden />{regionLabel}</li>}
      <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-[1.5px] border-stage-iqr" aria-hidden />odrzucone przez IQR</li>
    </ul>
  )
}

export function MarketView({ filters, regions, run }: ViewProps) {
  const data = getMarketData(filters)
  const desktop = layoutField(data.field, data.rejected, filters, DESKTOP)
  const medium = layoutField(data.field, data.rejected, filters, MEDIUM)
  const mobile = layoutField(data.field, data.rejected, filters, MOBILE)
  const regionLabel = filters.region === 'polska' ? null : formatRegion(filters.region)

  return (
    <>
      <FilterBar view="market" filters={filters} regions={regions} fields={['seniority', 'category', 'contract', 'region', 'portal']} />
      <div className="border-b border-seam px-5 py-4">
        <Headline answer={data.answer} filters={filters} />
      </div>
      <SeamGrid className="border-b border-seam lg:grid-cols-[minmax(0,1.6fr)_minmax(400px,1fr)]">
        {/* On a phone the answer comes first; on a desktop the field leads on the left. */}
        <Panel
          className="order-2 lg:order-1"
          stretch={false}
          title="Pole ofert"
          subtitle={`Jedna kropka to jedna oferta, zł ${CONTRACT_UNITS[filters.contract]} Kliknij poziom, żeby go wybrać.`}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <FieldLegend regionLabel={regionLabel} />
              <span className="tnum">
                {desktop.shown < desktop.total && `Pokazano ${formatNumber(desktop.shown)} z ${formatNumber(desktop.total)} ofert · `}
                NBP {run.metrics.nbp_table} · GUS {run.metrics.gus_year}{run.synthetic ? ' · dane syntetyczne' : ''}
              </span>
            </div>
          }
        >
          <div className="hidden md:block lg:max-[1359px]:hidden"><OfferField layout={desktop} filters={filters} /></div>
          <div className="hidden lg:max-[1359px]:block"><OfferField layout={medium} filters={filters} /></div>
          <div className="md:hidden"><OfferField layout={mobile} filters={filters} /></div>
        </Panel>
        <div className="order-1 flex min-w-0 flex-col gap-px lg:order-2">
          <AnswerReadout answer={data.answer} filters={filters} />
          <RegionRanking regions={data.regions} polska={data.polska} filters={filters} gusYear={data.answer.gusYear} />
          <PortalTable portals={data.portals} filters={filters} className="flex-1" />
        </div>
      </SeamGrid>
    </>
  )
}
