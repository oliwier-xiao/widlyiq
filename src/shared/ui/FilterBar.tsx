'use client'

import { CaretDownIcon } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTransition, type ReactNode } from 'react'

import {
  CATEGORIES, CATEGORY_LABELS, CONTRACT_LABELS, CONTRACTS, DEFAULT_FILTERS, PORTAL_LABELS, PORTALS, SENIORITIES,
  SENIORITY_LABELS, toSearch, type Filters, type View,
} from '@/shared/lib/filters'
import { formatRegion } from '@/shared/lib/formatters'

type Field = 'seniority' | 'category' | 'contract' | 'region' | 'portal'

type Props = {
  view: View
  filters: Filters
  regions: string[]
  fields: Field[]
  trailing?: ReactNode
}

export function FilterBar({ view, filters, regions, fields, trailing }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const set = (patch: Partial<Filters>) =>
    startTransition(() => router.push(toSearch(view, filters, patch), { scroll: false }))
  const isDefault = fields.every((f) => filters[f] === DEFAULT_FILTERS[f])

  return (
    <div className="relative border-b border-seam bg-toolbar">
      <div className="flex flex-wrap items-center gap-2 px-5 py-2.5">
        {fields.includes('seniority') && (
          <div role="radiogroup" aria-label="Poziom" className="flex h-9 border border-seam bg-paper p-[3px]">
            {SENIORITIES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={filters.seniority === s}
                onClick={() => set({ seniority: s })}
                className={`px-3 t-control transition-colors duration-150 ${filters.seniority === s ? 'bg-carbon text-paper' : 'text-ink-2 hover:text-ink'}`}
              >
                {SENIORITY_LABELS[s]}
              </button>
            ))}
          </div>
        )}
        {fields.includes('category') && (
          <Select label="Kategoria" value={filters.category} onChange={(v) => set({ category: v })}
            options={['all', ...CATEGORIES].map((c) => [c, CATEGORY_LABELS[c]])} />
        )}
        {fields.includes('contract') && (
          <Select label="Umowa" value={filters.contract} onChange={(v) => set({ contract: v })}
            options={['all', ...CONTRACTS].map((c) => [c, CONTRACT_LABELS[c]])} />
        )}
        {fields.includes('region') && (
          <Select label="Region" value={filters.region} onChange={(v) => set({ region: v })} accent={filters.region === 'podkarpackie'}
            options={[['polska', 'Cała Polska'], ...regions.map((r) => [r, formatRegion(r)] as [string, string])]} />
        )}
        {fields.includes('portal') && (
          <Select label="Portal" value={filters.portal} onChange={(v) => set({ portal: v })}
            options={['all', ...PORTALS].map((p) => [p, PORTAL_LABELS[p]])} />
        )}
        {!isDefault && (
          <button type="button" onClick={() => set(Object.fromEntries(fields.map((f) => [f, DEFAULT_FILTERS[f]])))}
            className="px-2 t-control font-medium text-ink underline underline-offset-[3px]">
            Przywróć domyślne
          </button>
        )}
        {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
      </div>
      {pending && (
        <span className="absolute inset-x-0 bottom-[-1px] h-[2px] overflow-hidden" aria-hidden>
          <span className="filter-progress block h-full" />
        </span>
      )}
    </div>
  )
}

type SelectProps = { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; accent?: boolean }

export function Select({ label, value, options, onChange, accent }: SelectProps) {
  return (
    // The select itself draws no outline (it would ring only the value), so keyboard focus rings the whole control.
    <label className="relative flex h-9 items-center gap-2 border border-seam bg-paper pl-3 pr-8 focus-within:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal-ink">
      <span className="t-meta whitespace-nowrap">{label}</span>
      {accent && <span className="size-2 shrink-0 bg-signal" aria-hidden />}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 cursor-pointer appearance-none bg-transparent t-control text-ink outline-none"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <CaretDownIcon size={14} weight="bold" className="pointer-events-none absolute right-2.5 text-ink-2" aria-hidden />
    </label>
  )
}
