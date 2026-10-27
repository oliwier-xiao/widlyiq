import Link from 'next/link'

import { toSearch, type Filters } from '@/shared/lib/filters'
import { formatMultiple, formatNumber, formatRegion } from '@/shared/lib/formatters'
import { MIN_SAMPLE } from '@/shared/lib/stats'
import { Panel } from '@/shared/ui/Panel'

import type { RegionRow } from './queries'

const TOP = 5
// The name column gives way before the bar does, so the bar keeps a readable length in a 400 px column.
const COLUMNS = 'grid grid-cols-[minmax(0,1.6fr)_minmax(3rem,1fr)_4rem_5.75rem] gap-3'

export function RegionRanking({ regions, polska, filters, gusYear, className }: { regions: RegionRow[]; polska: RegionRow; filters: Filters; gusYear: number; className?: string }) {
  const max = Math.max(...regions.map((r) => r.multiple ?? 0), polska.multiple ?? 0, 1)
  const top = regions.slice(0, TOP)
  const selected = regions.find((r) => r.region === filters.region)
  const visible = selected && !top.includes(selected) ? [...top, selected] : top
  const rest = regions.filter((r) => !visible.includes(r))
  // Sixteen rows of "za mało ofert" say less than one sentence does.
  const allEmpty = regions.every((r) => r.multiple === null)

  return (
    <Panel
      className={className}
      title="Krotność GUS według województw"
      subtitle={`Ile razy mediana IT przekracza przeciętną płacę w regionie (GUS ${gusYear})`}
      footer={filters.contract === 'uop' ? undefined : 'B2B netto wobec brutto z GUS: krotność orientacyjna'}
    >
      {allEmpty ? (
        <p className="border-t border-seam px-5 py-3 t-body">
          {polska.multiple
            ? `Żadne województwo nie ma ${MIN_SAMPLE} ofert tego profilu z widełkami. Cała Polska: ${formatMultiple(polska.multiple)} płacy GUS, mediana ${formatNumber(polska.median)} zł.`
            : `Ten profil ma za mało ofert z widełkami, żeby porównać województwa. Poszerz filtr.`}
        </p>
      ) : (
        <>
          <div className={`${COLUMNS} border-b border-seam px-5 pb-1.5 t-meta`} aria-hidden>
            <span>Województwo</span><span /><span className="text-right">Krotność</span><span className="text-right">Mediana IT</span>
          </div>
          <ol className="px-5">
            {visible.map((r) => <Row key={r.region} row={r} max={max} filters={filters} />)}
            <Row row={polska} max={max} filters={filters} reference />
          </ol>
        </>
      )}
      {!allEmpty && rest.length > 0 && (
        <details className="group px-5">
          <summary className="cursor-pointer py-2 t-control text-ink underline underline-offset-[3px] marker:content-none">
            <span className="group-open:hidden">Pokaż pozostałe {rest.length}</span>
            <span className="hidden group-open:inline">Zwiń</span>
          </summary>
          <ol>{rest.map((r) => <Row key={r.region} row={r} max={max} filters={filters} />)}</ol>
        </details>
      )}
    </Panel>
  )
}

function Row({ row, max, filters, reference }: { row: RegionRow; max: number; filters: Filters; reference?: boolean }) {
  const active = row.region === filters.region
  const width = row.multiple ? `${(row.multiple / max) * 100}%` : '0%'
  return (
    <li>
      <Link
        href={toSearch('market', filters, { region: row.region })}
        scroll={false}
        className={`${COLUMNS} items-center border-b border-seam py-[7px] t-table transition-colors duration-150 ${active ? '-mx-5 bg-carbon px-5 text-paper' : 'hover:bg-toolbar'}`}
      >
        <span className={`truncate ${active ? 'font-bold' : reference ? 'font-semibold' : ''}`} title={formatRegion(row.region)}>{formatRegion(row.region)}</span>
        <span className="relative h-2" aria-hidden>
          <span className={`absolute inset-y-0 left-0 ${active ? 'bg-signal' : reference ? 'border-t-2 border-dashed border-ink-2' : 'bg-dot-soft'}`} style={{ width }} />
        </span>
        <span className="text-right font-semibold">{row.multiple ? formatMultiple(row.multiple) : ''}</span>
        <span className={`text-right ${active ? 'text-dot-soft' : 'text-ink-2'}`}>
          {row.median ? `${formatNumber(row.median)} zł` : row.n === 0 ? 'brak ofert' : 'za mało ofert'}
        </span>
      </Link>
    </li>
  )
}
