import { PORTAL_LABELS, type Filters } from '@/shared/lib/filters'
import { formatNumber, formatSignedPct } from '@/shared/lib/formatters'
import { MIN_SAMPLE } from '@/shared/lib/stats'
import { Panel } from '@/shared/ui/Panel'

import type { PortalRow } from './queries'

const SPAN = 10

export function PortalTable({ portals, filters, className }: { portals: PortalRow[]; filters: Filters; className?: string }) {
  const notes = [
    portals.some((p) => p.biasPct === null) && `Bias liczymy od ${MIN_SAMPLE} ofert z widełkami.`,
    filters.portal !== 'all' && 'Filtr portalu nie dotyczy tego panelu: tabela zawsze porównuje wszystkie portale.',
  ].filter(Boolean)
  return (
    <Panel
      className={className}
      title="Bias portali"
      subtitle="O ile oferty z portalu odbiegają od wyceny modelu dla wybranego profilu"
      footer={notes.length ? notes.join(' ') : undefined}
    >
      <table className="w-full t-table">
        <thead className="t-meta">
          <tr className="border-b border-seam">
            <th scope="col" className="py-1.5 pl-5 text-left font-medium">Portal</th>
            <th scope="col" className="py-1.5 text-left font-medium">Źródło</th>
            <th scope="col" className="py-1.5 text-right font-medium">Bias</th>
            <th scope="col" className="py-1.5 pl-3 pr-5 text-right font-medium">Oferty</th>
          </tr>
        </thead>
        <tbody>
          {portals.map((p) => {
            const bias = p.biasPct ?? 0
            const active = filters.portal === p.source
            const width = `${Math.min(Math.abs(bias), SPAN) / SPAN * 50}%`
            return (
              <tr key={p.source} className="border-b border-seam last:border-0">
                <th scope="row" className={`py-2 pl-5 text-left ${active ? 'font-extrabold' : 'font-semibold'}`}>{PORTAL_LABELS[p.source] ?? p.source}</th>
                <td className="py-2">
                  {p.mode === 'live' ? (
                    <span className="inline-flex items-center gap-1.5"><span className="size-2 bg-ok" aria-hidden />live</span>
                  ) : (
                    // Same mark as ETL Lab: grey hollow for a snapshot by choice, amber only when a live attempt failed.
                    <span className={`inline-flex items-center gap-1.5 ${p.reason && p.reason !== 'tryb snapshot' ? 'text-warn' : 'text-ink-2'}`}>
                      <span className={`size-2 border-[1.5px] ${p.reason && p.reason !== 'tryb snapshot' ? 'border-warn' : 'border-ink-2'}`} aria-hidden />
                      snapshot{p.reason && p.reason !== 'tryb snapshot' ? ` (${p.reason})` : ''}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {p.biasPct === null ? (
                    <span className="text-ink-2">za mało ofert</span>
                  ) : (
                    <span className="flex items-center justify-end gap-2">
                      <span className="relative h-2 w-16" aria-hidden>
                        <span className="absolute inset-y-[-2px] left-1/2 w-px bg-ink-2" />
                        <span className={`absolute inset-y-0 ${bias >= 0 ? 'left-1/2 bg-ink' : 'right-1/2 bg-dot'}`} style={{ width }} />
                      </span>
                      <span className="w-14 text-right font-semibold">{formatSignedPct(p.biasPct)}</span>
                    </span>
                  )}
                </td>
                <td className="py-2 pl-3 pr-5 text-right text-ink-2">{formatNumber(p.n)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>
  )
}
