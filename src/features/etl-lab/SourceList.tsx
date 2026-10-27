'use client'

import type { SourceLog } from '@/shared/db/run'
import { formatDuration, plural } from '@/shared/lib/formatters'
import { usePipelineRun } from '@/shared/ui/PipelineRun'

type Unit = [one: string, few: string, many: string]
const OFFERS: Unit = ['oferta', 'oferty', 'ofert']

const SOURCES: { id: string; label: string; format: string; unit: Unit }[] = [
  { id: 'nofluffjobs', label: 'No Fluff Jobs', format: 'JSON', unit: OFFERS },
  { id: 'justjoinit', label: 'Just Join IT', format: 'JSON', unit: OFFERS },
  { id: 'solidjobs', label: 'SOLID.Jobs', format: 'JSON', unit: OFFERS },
  { id: 'nbp', label: 'NBP tabela A', format: 'XML', unit: ['kurs', 'kursy', 'kursów'] },
  { id: 'gus', label: 'GUS BDL', format: 'XLSX', unit: ['wiersz', 'wiersze', 'wierszy'] },
]
const PORTALS = new Set(['nofluffjobs', 'justjoinit', 'solidjobs'])

type Row = { mode: 'live' | 'snapshot'; reason: string | null; records: number | null; duration_ms: number; synthetic: boolean }

function isFallback(row: Row): boolean {
  return row.mode === 'snapshot' && !!row.reason && row.reason !== 'tryb snapshot'
}

/** Only a failed live attempt needs words; the badge already says live or snapshot. */
function reasonText(row: Row): string | null {
  return isFallback(row) ? `${row.reason}, użyto snapshotu` : null
}

export function SourceList({ sources }: { sources: SourceLog[] }) {
  const live = usePipelineRun()
  const streaming = live.status === 'running' || live.status === 'error'
  const stored = new Map(sources.map((s) => [s.source, s]))
  const events = new Map(live.sources.map((s) => [s.source, s]))

  return (
    <ul className="border-t border-seam" aria-label="Źródła danych">
      {SOURCES.map((src) => {
        const event = events.get(src.id)
        const base = stored.get(src.id)
        // Live events carry no synthetic flag; only portal snapshots are synthetic, NBP and GUS snapshots are real copies.
        const row: Row | null = streaming
          ? event ? { ...event, synthetic: event.mode === 'snapshot' && PORTALS.has(src.id) } : null
          : base ? { mode: base.mode, reason: base.fallback_reason, records: base.records, duration_ms: base.duration_ms, synthetic: base.synthetic } : null
        return (
          <li key={src.id} className="border-b border-seam px-5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {src.label} <span className="t-meta">{src.format}</span>
                </p>
                {(!row || reasonText(row)) && (
                  <p className={`t-meta mt-0.5 ${row ? 'text-warn' : ''}`}>
                    {row ? reasonText(row) : streaming ? 'oczekuje' : 'brak wpisu w logu'}
                  </p>
                )}
              </div>
              {row && (
                // Shape carries state with colour as backup: filled square live, hollow snapshot. Amber only for a failed live try.
                <span className={`inline-flex shrink-0 items-center gap-1.5 t-control ${row.mode === 'live' ? 'text-ok' : isFallback(row) ? 'text-warn' : 'text-ink-2'}`}>
                  <span className={`size-2.5 ${row.mode === 'live' ? 'bg-ok' : `border-[1.5px] ${isFallback(row) ? 'border-warn' : 'border-ink-2'}`}`} aria-hidden />
                  {row.mode === 'live' ? 'live' : 'snapshot'}
                </span>
              )}
            </div>
            {row && (
              <p className="mt-1 t-table">
                {row.records != null ? plural(row.records, ...src.unit) : ''}
                <span className="text-ink-2"> · {formatDuration(row.duration_ms)}</span>
                {row.synthetic && <span className="ml-2 font-semibold text-signal-ink">dane syntetyczne</span>}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
