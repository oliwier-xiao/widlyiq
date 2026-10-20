'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { CATEGORY_LABELS, CONTRACT_LABELS, PORTAL_LABELS, SENIORITY_LABELS, type Seniority } from '@/shared/lib/filters'
import { formatMultiple, formatPLN, formatRegion } from '@/shared/lib/formatters'
import { STAGE_META } from '@/shared/lib/stages'
import { CodeButton } from '@/shared/ui/CodeDrawer'
import { useStageFocus } from '@/shared/ui/PipelineRun'

import { SAMPLE_KINDS, SAMPLE_LABELS, type RawSide, type Sample, type SampleKind } from './types'

const rawNumber = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2, useGrouping: 'always' })

export function DiffInspector({ samples }: { samples: Sample[] }) {
  const [kind, setKind] = useState<SampleKind>('all')
  const visible = useMemo(() => (kind === 'all' ? samples : samples.filter((s) => s.kinds.includes(kind))), [kind, samples])
  const [selectedId, setSelectedId] = useState<string | null>(samples[0]?.id ?? null)
  const selected = visible.find((s) => s.id === selectedId) ?? visible[0] ?? null

  const counts = useMemo(() => {
    const out = { all: samples.length } as Record<SampleKind, number>
    for (const k of SAMPLE_KINDS.slice(1)) out[k] = samples.filter((s) => s.kinds.includes(k)).length
    return out
  }, [samples])

  return (
    <div className="border-t border-seam">
      <div className="flex flex-wrap gap-1.5 px-5 py-3" role="group" aria-label="Rodzaj transformacji">
        {SAMPLE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            disabled={counts[k] === 0}
            onClick={() => setKind(k)}
            className={`h-8 border px-3 text-[14px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${kind === k ? 'border-carbon bg-carbon text-paper' : 'border-seam bg-paper text-ink hover:bg-toolbar'}`}
          >
            {SAMPLE_LABELS[k]} <span className={`tnum ${kind === k ? 'text-dot-soft' : 'text-ink-2'}`}>{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-px border-t border-seam bg-seam lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <ul className="max-h-[560px] overflow-y-auto bg-paper" aria-label="Rekordy">
          {visible.map((s) => {
            const active = s.id === selected?.id
            return (
              <li key={s.id} className="border-b border-seam">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(s.id)}
                  className={`block w-full px-5 py-2.5 text-left transition-colors duration-150 ${active ? 'bg-carbon text-paper' : 'hover:bg-toolbar'}`}
                >
                  <span className="block truncate text-[15px] font-semibold">{s.title}</span>
                  <span className={`block truncate text-[13px] ${active ? 'text-dot-soft' : 'text-ink-2'}`}>
                    {PORTAL_LABELS[s.source] ?? s.source} · {s.rejection ? 'odrzucony' : s.kinds.map((k) => SAMPLE_LABELS[k]).join(', ')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="min-w-0 bg-paper">{selected ? <Detail sample={selected} /> : <p className="t-meta p-5">Brak rekordów tego typu w ostatnim przebiegu.</p>}</div>
      </div>
    </div>
  )
}

function Detail({ sample }: { sample: Sample }) {
  const { focus, setFocus } = useStageFocus()
  const { raw, clean, rejection, notes } = sample
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="t-headline">{sample.title}</h3>
        <span className="t-code text-[12px] text-ink-2">{sample.id}</span>
      </div>

      {rejection && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 bg-toolbar px-4 py-3">
          <span className="size-2.5 shrink-0" style={{ background: STAGE_META[rejection.stage].color }} aria-hidden />
          <p className="min-w-0 flex-1 text-[15px]">
            <strong className="font-semibold">Odrzucony: {STAGE_META[rejection.stage].label}.</strong>{' '}
            {rejection.stage === 'dedupe'
              ? <>Zachowana kopia: {rejection.keptTitle ?? 'brak w czystym zbiorze'} <span className="t-code text-[12px] text-ink-2">{rejection.keptId}</span></>
              : rejection.reason}
            {rejection.stage === 'filter-iqr' && rejection.lower_fence != null && (
              <span className="mt-1 block t-table text-ink-2">
                {formatPLN(rejection.salary_pln_month)} poza płotkami {formatPLN(rejection.lower_fence)} do {formatPLN(rejection.upper_fence)} w grupie {rejection.group_key} · z = {rawNumber.format(rejection.z_score ?? 0)}
              </span>
            )}
          </p>
          <CodeButton anchor={STAGE_META[rejection.stage].anchor} />
        </div>
      )}

      <div className="mt-4 grid gap-px bg-seam md:grid-cols-2">
        <Side title="Raw" note="tak, jak przyszło z portalu" className="md:pr-4">
          {raw ? <RawFields raw={raw} /> : <Empty text="Brak surowego rekordu." />}
        </Side>
        <Side title="Clean" note={clean ? 'po wszystkich etapach' : 'rekord nie przeszedł dalej'} className="pt-4 md:pl-4 md:pt-0">
          {clean ? (
            <>
              <Field label="Kategoria" value={CATEGORY_LABELS[clean.category] ?? clean.category} />
              <Field label="Poziom" value={SENIORITY_LABELS[clean.seniority as Seniority] ?? clean.seniority} changed={!sameText(raw?.seniority_raw, clean.seniority)} />
              <Field label="Umowa" value={clean.contract ? CONTRACT_LABELS[clean.contract] ?? clean.contract : 'brak danych'} />
              <Field label="Region" value={clean.region ? formatRegion(clean.region) : 'brak danych'} />
              <Field
                label="Płaca"
                value={<>{formatPLN(clean.salary_pln_month)} / mies.{clean.is_imputed ? <span className="text-ink-2"> · imputowana ({clean.imputation_group})</span> : null}</>}
                changed
              />
              <Field label="Skille" value={clean.skills.join(', ') || 'brak'} changed={!sameSet(raw?.skills_raw ?? [], clean.skills)} />
              <Field label="Tier" value={`${clean.tier} · ${formatMultiple(clean.gus_multiple)} GUS`} />
            </>
          ) : rejection?.salary_pln_month != null ? (
            <Field label="Płaca" value={`${formatPLN(rejection.salary_pln_month)} / mies.`} />
          ) : (
            <Empty text="Brak wartości po czyszczeniu." />
          )}
        </Side>
      </div>

      {notes.length > 0 && (
        <div className="mt-4">
          <h4 className="t-meta">Transformacje w kolejności etapów</h4>
          <ol className="mt-2 border-t border-seam">
            {notes.map((n, i) => (
              <li
                key={i}
                onPointerEnter={() => setFocus(n.stage)}
                onPointerLeave={() => setFocus(null)}
                className={`flex items-center gap-3 border-b border-seam py-2 transition-colors duration-150 ${focus === n.stage ? 'bg-toolbar' : ''}`}
              >
                <span className="size-2.5 shrink-0" style={{ background: STAGE_META[n.stage].color }} aria-hidden />
                <span className="w-24 shrink-0 text-[14px] font-semibold">{STAGE_META[n.stage].label}</span>
                <span className="min-w-0 flex-1 text-[15px]">{n.text}</span>
                <CodeButton anchor={STAGE_META[n.stage].anchor} />
              </li>
            ))}
          </ol>
        </div>
      )}

      {raw && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-[14px] font-semibold underline underline-offset-[3px]">Surowy JSON z portalu</summary>
          <pre className="t-code mt-2 max-h-72 overflow-auto bg-toolbar p-4 text-[12px]">{prettyJson(raw.raw_json)}</pre>
        </details>
      )}
    </div>
  )
}

function Side({ title, note, className = '', children }: { title: string; note: string; className?: string; children: ReactNode }) {
  return (
    <div className={`bg-paper ${className}`}>
      <p className="flex items-baseline gap-2 pb-2">
        <span className="t-panel">{title}</span>
        <span className="t-meta">{note}</span>
      </p>
      <dl className="border-t border-seam">{children}</dl>
    </div>
  )
}

function Field({ label, value, changed = false }: { label: string; value: ReactNode; changed?: boolean }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-seam py-1.5 pr-3">
      <dt className="t-meta pt-px">{label}</dt>
      <dd className={`t-table break-words ${changed ? 'bg-signal-wash px-1.5' : ''}`}>{value}</dd>
    </div>
  )
}

function RawFields({ raw }: { raw: RawSide }) {
  const range = raw.salary_from == null && raw.salary_to == null
    ? 'brak widełek'
    : `${raw.salary_from == null ? '?' : rawNumber.format(raw.salary_from)} do ${raw.salary_to == null ? '?' : rawNumber.format(raw.salary_to)} ${raw.currency ?? ''} / ${raw.period_raw ?? 'brak okresu'}`
  return (
    <>
      <Field label="Tytuł" value={raw.title || 'brak tytułu'} />
      <Field label="Poziom" value={raw.seniority_raw ?? 'brak'} />
      <Field label="Umowa" value={raw.contract_raw ?? 'brak'} />
      <Field label="Widełki" value={range} />
      <Field label="Miasto" value={raw.city ?? 'brak (zdalnie lub nie podano)'} />
      <Field label="Skille" value={raw.skills_raw.join(', ') || 'brak'} />
    </>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="t-meta py-2">{text}</p>
}

function sameText(a: string | null | undefined, b: string): boolean {
  return (a ?? '').trim().toLowerCase() === b.toLowerCase()
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

