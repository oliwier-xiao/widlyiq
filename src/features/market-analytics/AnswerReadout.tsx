import Link from 'next/link'

import { CATEGORY_LABELS, CONTRACT_LABELS, CONTRACT_UNITS, SENIORITY_LABELS, toSearch, type Filters } from '@/shared/lib/filters'
import { formatMultiple, formatNumber, formatPLN, formatRegion, formatSignedPct } from '@/shared/lib/formatters'
import { MIN_SAMPLE } from '@/shared/lib/stats'
import { CodeButton } from '@/shared/ui/CodeDrawer'

import type { Answer } from './queries'

// Secondary text on orange is a dark tint of the same hue: grey on a saturated field reads as dirt and fails contrast.
const SUB = 'text-[#4a1d07]'

export function AnswerReadout({ answer, filters }: { answer: Answer; filters: Filters }) {
  const region = filters.region === 'polska' ? 'Cała Polska' : formatRegion(filters.region)
  const profile = [
    SENIORITY_LABELS[filters.seniority],
    filters.category === 'all' ? null : CATEGORY_LABELS[filters.category],
    region,
    filters.contract === 'all' ? null : CONTRACT_LABELS[filters.contract],
  ].filter(Boolean).join(' · ')
  const p50 = answer.pct?.p50 ?? null
  const vsPolska = p50 && answer.nationalP50 && filters.region !== 'polska' ? (p50 / answer.nationalP50 - 1) * 100 : null

  return (
    <section className="flex flex-col bg-signal px-6 pb-5 pt-5 text-ink" aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="t-panel">{profile}</h2>
        <span className={`text-[14px] font-semibold tnum ${SUB}`}>n = {formatNumber(answer.n)}</span>
      </div>

      {answer.pct && p50 ? (
        <>
          <p className="mt-5 flex items-end gap-3">
            <span className="t-readout">{formatNumber(p50)}</span>
            <span className="pb-2 t-figure-sm font-semibold">zł {CONTRACT_UNITS[filters.contract]}</span>
          </p>
          <p className={`mt-2 text-[15px] ${SUB}`}>
            Mediana z {formatNumber(answer.n)} ofert z widełkami
            {answer.imputed > 0 && `, bez ${formatNumber(answer.imputed)} uzupełnionych medianą`}.
          </p>
          <dl className="mt-5 grid grid-cols-2 border-t border-[#c2430f]">
            <div className="border-r border-[#c2430f] py-3 pr-4">
              <dt className={`text-[13px] font-medium ${SUB}`}>Krotność płacy GUS</dt>
              <dd className="mt-0.5 t-figure">{formatMultiple(p50 / answer.gus)}</dd>
              <dd className={`mt-1 text-[13px] tnum ${SUB}`}>{formatPLN(answer.gus)} brutto, GUS {answer.gusYear}</dd>
            </div>
            <div className="py-3 pl-4">
              <dt className={`text-[13px] font-medium ${SUB}`}>Względem całej Polski</dt>
              <dd className="mt-0.5 t-figure">
                {vsPolska === null ? 'to jest Polska' : formatSignedPct(vsPolska)}
              </dd>
              <dd className={`mt-1 text-[13px] tnum ${SUB}`}>{answer.nationalP50 ? `mediana ${formatPLN(answer.nationalP50)}` : 'za mało ofert'}</dd>
            </div>
          </dl>
        </>
      ) : (
        <div className="mt-5">
          <p className="t-figure leading-tight">Za mało ofert na pewną medianę</p>
          <p className={`mt-2 text-[15px] ${SUB}`}>
            Ten profil ma {formatNumber(answer.n)} ofert z widełkami, a próg to {MIN_SAMPLE}. Poszerz filtr:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {filters.category !== 'all' && <Widen href={toSearch('market', filters, { category: 'all' })}>Wszystkie kategorie</Widen>}
            {filters.region !== 'polska' && <Widen href={toSearch('market', filters, { region: 'polska' })}>Cała Polska</Widen>}
            {filters.contract !== 'all' && <Widen href={toSearch('market', filters, { contract: 'all' })}>Każda umowa</Widen>}
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className={`text-[13px] ${SUB}`}>Płotki IQR liczone w grupie kategoria × poziom × umowa</span>
        <CodeButton anchor="filter-iqr" />
      </div>
    </section>
  )
}

function Widen({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} scroll={false} className="bg-carbon px-3 py-1.5 text-[14px] font-semibold text-paper hover:bg-carbon-2">
      {children}
    </Link>
  )
}
