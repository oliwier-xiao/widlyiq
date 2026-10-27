'use client'

import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  CATEGORIES, CATEGORY_LABELS, CONTRACT_LABELS, CONTRACT_UNITS, SENIORITIES, SENIORITY_LABELS, type Seniority,
} from '@/shared/lib/filters'
import { formatMultiple, formatNumber, formatPLN, formatRegion, formatSignedPLN } from '@/shared/lib/formatters'
import { Select } from '@/shared/ui/FilterBar'
import { Panel } from '@/shared/ui/Panel'

import { estimate, indexWeights, type Contribution, type Profile, type Weight } from './model'

type Props = {
  weights: Weight[]
  gusWages: Record<string, number>
  gusYear: number
  defaultStacks: Record<string, string[]>
  categorySkills: Record<string, string[]>
  regions: string[]
  initial: Omit<Profile, 'skills'>
  mae: number
}

export function EstimatorWorkbench({ weights, gusWages, gusYear, defaultStacks, categorySkills, regions, initial, mae }: Props) {
  const index = useMemo(() => indexWeights(weights), [weights])
  const vocabulary = useMemo(
    () => weights.filter((w) => w.group === 'skill').sort((a, b) => b.weight - a.weight),
    [weights],
  )
  const [profile, setProfile] = useState<Profile>({ ...initial, skills: defaultStacks[initial.category] ?? [] })
  // Until the user picks a skill, changing category swaps in that category's typical stack.
  const [touched, setTouched] = useState(false)
  const [query, setQuery] = useState('')
  const [hint, setHint] = useState<Weight | null>(null)

  const labels = {
    seniority: SENIORITY_LABELS[profile.seniority],
    category: CATEGORY_LABELS[profile.category],
    contract: CONTRACT_LABELS[profile.contract],
    region: formatRegion(profile.region),
  }
  const result = estimate(index, gusWages, profile, labels)
  const defaults = defaultStacks[profile.category] ?? []
  const isDefaultStack = defaults.length === profile.skills.length && defaults.every((s) => profile.skills.includes(s))
  const suggestions = vocabulary
    .filter((w) => w.weight > 0 && !profile.skills.includes(w.label) && (categorySkills[profile.category] ?? []).includes(w.label))
    .slice(0, 4)
  const shown = vocabulary.filter((w) => w.label.toLowerCase().includes(query.trim().toLowerCase()))
  const regionOptions: [string, string][] = [
    ['polska', 'Cała Polska'],
    ...regions.filter((r) => r !== 'polska').map((r) => [r, formatRegion(r)] as [string, string]),
  ]

  const toggle = (skill: string) => {
    setTouched(true)
    setProfile((p) => ({ ...p, skills: p.skills.includes(skill) ? p.skills.filter((s) => s !== skill) : [...p.skills, skill] }))
  }
  const setCategory = (category: string) =>
    setProfile((p) => ({ ...p, category, skills: touched ? p.skills : defaultStacks[category] ?? [] }))

  return (
    <>
      <Panel
        title="Twój profil"
        subtitle="Każda zmiana od razu przelicza szacunek."
        className="lg:row-span-2"
        bodyClassName="px-5 pb-5"
      >
        <div className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="Poziom" className="flex h-10 w-fit border border-seam bg-paper p-[3px]">
            {SENIORITIES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={profile.seniority === s}
                onClick={() => setProfile((p) => ({ ...p, seniority: s as Seniority }))}
                className={`px-3.5 t-control transition-colors duration-150 ${profile.seniority === s ? 'bg-carbon text-paper' : 'text-ink-2 hover:text-ink'}`}
              >
                {SENIORITY_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Select label="Kategoria" value={profile.category} onChange={setCategory}
              options={CATEGORIES.map((c) => [c, CATEGORY_LABELS[c]])} />
            <Select label="Umowa" value={profile.contract} onChange={(contract) => setProfile((p) => ({ ...p, contract }))}
              options={[['b2b', CONTRACT_LABELS.b2b], ['uop', CONTRACT_LABELS.uop]]} />
            <Select label="Region" value={profile.region} accent={profile.region === 'podkarpackie'}
              onChange={(region) => setProfile((p) => ({ ...p, region }))} options={regionOptions} />
          </div>
        </div>

        <div className="mt-6 flex items-baseline justify-between gap-3">
          <h3 className="t-subhead">
            Technologie <span className="t-meta tnum">· wybrane {result.contributions.filter((c) => c.kind === 'skill').length} z {vocabulary.length}</span>
          </h3>
          <div className="flex gap-3 t-control font-medium">
            {!isDefaultStack && defaults.length > 0 && (
              <button type="button" className="font-medium underline underline-offset-[3px]"
                onClick={() => setProfile((p) => ({ ...p, skills: defaults }))}>
                Przykładowy stack
              </button>
            )}
            {profile.skills.length > 0 && (
              <button type="button" className="font-medium underline underline-offset-[3px]"
                onClick={() => { setTouched(true); setProfile((p) => ({ ...p, skills: [] })) }}>
                Wyczyść
              </button>
            )}
          </div>
        </div>
        <label className="mt-2 flex h-10 items-center gap-2 border border-seam bg-paper px-3 focus-within:border-ink">
          <MagnifyingGlassIcon size={16} weight="bold" className="text-ink-2" aria-hidden />
          <span className="sr-only">Szukaj technologii</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj technologii, np. Kubernetes"
            className="min-w-0 flex-1 bg-transparent t-body outline-none placeholder:text-ink-2"
          />
        </label>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-describedby="skill-hint">
          {shown.map((w) => {
            const on = profile.skills.includes(w.label)
            return (
              <li key={w.feature}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(w.label)}
                  onPointerEnter={() => setHint(w)}
                  onPointerLeave={() => setHint(null)}
                  onFocus={() => setHint(w)}
                  onBlur={() => setHint(null)}
                  className={`flex h-8 items-center gap-2 border px-2.5 t-control transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97] ${on ? 'border-carbon bg-carbon text-paper' : 'border-seam bg-paper text-ink hover:border-ink'}`}
                >
                  {w.label}
                  <span className={`t-micro font-medium ${on ? 'text-dot-soft' : 'text-ink-2'}`}>{formatSignedPLN(w.weight)}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {shown.length === 0 && (
          <p className="mt-3 t-body text-ink-2">
            Brak „{query}” w słowniku modelu. Model zna {vocabulary.length} najczęstszych technologii z ofert.
          </p>
        )}
        <p id="skill-hint" className="t-meta mt-3 min-h-[2.8em]" aria-live="polite">
          {hint
            ? `${hint.label}: ${formatSignedPLN(hint.weight)} / mies., oszacowane na ${formatNumber(hint.support)} ofertach.`
            : 'Najedź na technologię, żeby zobaczyć, na ilu ofertach ją oszacowano.'}
        </p>

        {suggestions.length > 0 && (
          <div className="mt-6 border-t border-seam pt-4">
            <h3 className="t-subhead">Co podniesie szacunek</h3>
            <p className="t-meta mt-0.5">Częste w kategorii {labels.category}, a brakuje ich w Twoim stacku.</p>
            <ul className="mt-3 grid gap-px bg-seam sm:max-lg:grid-cols-2 xl:grid-cols-2">
              {suggestions.map((w) => (
                <li key={w.feature} className="bg-paper">
                  <button
                    type="button"
                    onClick={() => toggle(w.label)}
                    className="flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-toolbar active:scale-[0.98]"
                  >
                    <span className="t-control">Dodaj {w.label}</span>
                    <span className="t-table whitespace-nowrap font-semibold">{formatSignedPLN(w.weight)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Readout profile={profile} labels={labels} result={result} mae={mae} gusYear={gusYear} />
      <Breakdown base={result.base} total={result.total} contributions={result.contributions} />
    </>
  )
}

function AnimatedNumber({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const spring = useSpring(value, { visualDuration: 0.4, bounce: 0 })
  const text = useTransform(spring, (v) => formatNumber(v))
  const first = useRef(true)
  useEffect(() => {
    // Animate only in response to input; the first paint shows the final value with no count-up.
    if (first.current) {
      first.current = false
      return
    }
    if (reduce) spring.jump(value)
    else spring.set(value)
  }, [value, reduce, spring])
  return <motion.span>{text}</motion.span>
}

type ReadoutProps = {
  profile: Profile
  labels: Record<'seniority' | 'category' | 'contract' | 'region', string>
  result: ReturnType<typeof estimate>
  mae: number
  gusYear: number
}

function Readout({ profile, labels, result, mae, gusYear }: ReadoutProps) {
  return (
    <section className="bg-signal px-5 pb-5 pt-4 text-ink" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="t-panel">Szacunek dla Twojego profilu</h2>
        <p className="t-table font-semibold">
          {labels.seniority} · {labels.category} · {labels.contract} · {labels.region}
        </p>
      </div>
      <p className="mt-5 flex flex-wrap items-baseline gap-x-3">
        <span className="t-readout">
          <AnimatedNumber value={result.total} />
        </span>
        <span className="t-figure-sm font-semibold">zł {CONTRACT_UNITS[profile.contract] ?? '/ mies.'}</span>
      </p>
      <dl className="mt-5 grid grid-cols-1 border-t border-signal-rule sm:max-lg:grid-cols-3 xl:grid-cols-3">
        <Fact term="Typowy zakres" detail={`± ${formatPLN(mae)}, średni błąd modelu`}>
          {formatNumber(result.total - mae)} do {formatNumber(result.total + mae)} zł
        </Fact>
        <Fact term="Premia techniczna" detail={`technologie ${formatSignedPLN(result.skillsSum)}, ich liczba ${formatSignedPLN(result.nSkillsTerm)}`}>
          {formatSignedPLN(result.premium)}
        </Fact>
        <Fact term="Krotność GUS" detail={`${formatPLN(result.gusWage)} brutto, GUS ${gusYear}`}>
          {formatMultiple(result.multiple)}
        </Fact>
      </dl>
      {profile.contract === 'b2b' && (
        <p className="mt-3 t-micro font-medium text-signal-sub-ink">B2B netto wobec przeciętnej brutto GUS: krotność orientacyjna.</p>
      )}
    </section>
  )
}

const THREE_UP = [
  'sm:max-lg:not-first:border-t-0 sm:max-lg:border-l sm:max-lg:px-4 sm:max-lg:first:border-l-0 sm:max-lg:first:pl-0 sm:max-lg:last:pr-0',
  'xl:not-first:border-t-0 xl:border-l xl:px-4 xl:first:border-l-0 xl:first:pl-0 xl:last:pr-0',
].join(' ')

function Fact({ term, detail, children }: { term: string; detail: string; children: ReactNode }) {
  return (
    // One column between lg and xl: the readout is half the page there and three figures side by side wrapped mid-number.
    // Rules and secondary text take the orange's own dark tints, as in the market readout.
    <div className={`border-signal-rule py-3 not-first:border-t ${THREE_UP}`}>
      <dt className="t-micro text-signal-sub-ink">{term}</dt>
      <dd className="mt-1 t-figure-sm">{children}</dd>
      <dd className="mt-1 t-micro font-medium text-signal-sub-ink">{detail}</dd>
    </div>
  )
}

function Breakdown({ base, total, contributions }: { base: number; total: number; contributions: Contribution[] }) {
  const max = Math.max(1, ...contributions.map((c) => Math.abs(c.value)))
  const profileRows = contributions.filter((c) => c.kind === 'profile')
  const skillRows = contributions.filter((c) => c.kind === 'skill')
  return (
    <Panel
      title="Skąd ta kwota"
      subtitle="Model startuje od przeciętnej oferty i dodaje wpływ każdej cechy. Minus znaczy mniej niż przeciętnie, nie obniżkę."
      footer="Technologia typowa dla kategorii (np. React we frontendzie) bywa bliska zera, bo jej wartość jest już w wadze kategorii."
      bodyClassName="px-5"
    >
      <div className="t-table flex items-baseline justify-between border-b border-seam pb-2">
        <span className="font-semibold">Przeciętna oferta w danych</span>
        <span className="tnum font-semibold">{formatPLN(base)}</span>
      </div>
      <BarList rows={profileRows} max={max} />
      {skillRows.length > 0 && (
        <>
          <p className="t-meta mt-4">Technologie, od największego wpływu</p>
          <BarList rows={skillRows} max={max} />
        </>
      )}
      <div className="t-table mt-3 flex items-baseline justify-between border-t border-ink pt-2">
        <span className="font-bold">Szacunek</span>
        <span className="tnum font-bold">{formatPLN(total)}</span>
      </div>
    </Panel>
  )
}

function BarList({ rows, max }: { rows: Contribution[]; max: number }) {
  return (
    <ul className="mt-1">
      {rows.map((c) => {
        const ratio = Math.abs(c.value) / max
        const positive = c.value >= 0
        return (
          <li key={c.key} className="t-table grid grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_5.5rem] items-center gap-3 py-[5px] sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_6.5rem]">
            <span className="truncate" title={c.label}>{c.label}</span>
            <span className="relative h-3" aria-hidden>
              <span className="absolute inset-y-[-3px] left-1/2 w-px bg-ink-3" />
              <span
                className={`absolute inset-y-0 w-1/2 transition-transform duration-200 ease-[var(--ease-out)] ${positive ? 'left-1/2 origin-left bg-carbon' : 'right-1/2 origin-right bg-dot'}`}
                style={{ transform: `scaleX(${ratio})` }}
              />
            </span>
            <span className={`tnum text-right font-semibold ${positive ? 'text-ink' : 'text-ink-2'}`}>{formatSignedPLN(c.value)}</span>
          </li>
        )
      })}
    </ul>
  )
}
