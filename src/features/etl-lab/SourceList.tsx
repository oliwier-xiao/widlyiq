'use client'

import type { SourceLog } from '@/shared/db/run'
import { formatDuration, formatNumber } from '@/shared/lib/formatters'
import type { Anchor } from '@/shared/lib/stages'
import { CodeButton } from '@/shared/ui/CodeDrawer'
import { usePipelineRun } from '@/shared/ui/PipelineRun'

const SOURCES: { id: string; label: string; format: string; anchor: Anchor; unit: string }[] = [
  { id: 'nofluffjobs', label: 'No Fluff Jobs', format: 'JSON', anchor: 'extract', unit: 'ofert' },
  { id: 'justjoinit', label: 'Just Join IT', format: 'JSON', anchor: 'extract', unit: 'ofert' },
  { id: 'solidjobs', label: 'SOLID.Jobs', format: 'JSON', anchor: 'extract', unit: 'ofert' },
  { id: 'nbp', label: 'NBP tabela A', format: 'XML', anchor: 'xml-nbp', unit: 'kursów' },
  { id: 'gus', label: 'GUS BDL', format: 'XLSX', anchor: 'xlsx-gus', unit: 'wierszy' },
]
const PORTALS = new Set(['nofluffjobs', 'justjoinit', 'solidjobs'])

type Row = { mode: 'live' | 'snapshot'; reason: string | null; records: number | null; duration_ms: number; synthetic: boolean }

function isFallback(row: Row): boolean {
  return row.mode === 'snapshot' && !!row.reason && row.reason !== 'tryb snapshot'
}

function reasonText(row: Row): string {
  if (row.mode === 'live') return 'pobrane na żywo'
  if (!row.reason || row.reason === 'tryb snapshot') return 'tryb snapshot, bez sieci'
  return `${row.reason}, użyto snapshotu`
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {src.label} <span className="t-meta">{src.format}</span>
                </p>
                <p className="t-meta mt-0.5">
                  {row ? reasonText(row) : streaming ? 'oczekuje' : 'brak wpisu w logu'}
                </p>
              </div>
              {row && (
                // Shape carries state with colour as backup: filled square live, hollow snapshot. Amber only for a failed live try.
                <span className={`inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold ${row.mode === 'live' ? 'text-ok' : isFallback(row) ? 'text-warn' : 'text-ink-2'}`}>
                  <span className={`size-2.5 ${row.mode === 'live' ? 'bg-ok' : `border-[1.5px] ${isFallback(row) ? 'border-warn' : 'border-ink-2'}`}`} aria-hidden />
                  {row.mode === 'live' ? 'live' : 'snapshot'}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 t-table">
              <span className="tnum">
                {row?.records != null ? `${formatNumber(row.records)} ${src.unit}` : ''}
                {row && <span className="text-ink-2"> · {formatDuration(row.duration_ms)}</span>}
                {row?.synthetic && <span className="ml-2 font-semibold text-signal-ink">dane syntetyczne</span>}
              </span>
              <CodeButton anchor={src.anchor} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
