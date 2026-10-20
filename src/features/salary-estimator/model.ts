// Client-safe: the Ridge model is a linear sum, so the browser evaluates it from the stored weights.

export type Weight = {
  feature: string
  label: string
  group: 'skill' | 'seniority' | 'category' | 'contract' | 'remote' | 'numeric' | 'intercept'
  weight: number
  mean: number | null
  scale: number | null
  support: number | null
}

export type Profile = {
  seniority: 'junior' | 'mid' | 'senior' | 'lead'
  category: string
  contract: string
  region: string
  skills: string[]
}

export type Contribution = { key: string; label: string; value: number; kind: 'profile' | 'skill' }

export type Estimate = {
  base: number
  total: number
  contributions: Contribution[]
  skillsSum: number
  nSkillsTerm: number
  premium: number
  gusWage: number
  multiple: number
}

const SENIORITY_RANK = { junior: 0, mid: 1, senior: 2, lead: 3 } as const

export function indexWeights(weights: Weight[]): Map<string, Weight> {
  return new Map(weights.map((w) => [w.feature, w]))
}

function oneHot(index: Map<string, Weight>, feature: string): number {
  return index.get(feature)?.weight ?? 0
}

/** Scaled numeric features enter as weight * z, with z rebuilt from the training mean and std that StandardScaler stored. */
function numericTerm(index: Map<string, Weight>, name: string, x: number): number {
  const w = index.get(`${name}__z`)
  if (!w || !w.scale) return 0
  return w.weight * ((x - (w.mean ?? 0)) / w.scale)
}

export function estimate(
  index: Map<string, Weight>,
  gusWages: Record<string, number>,
  profile: Profile,
  labels: { seniority: string; category: string; contract: string; region: string },
): Estimate {
  const base = index.get('__intercept__')?.weight ?? 0
  const gusWage = gusWages[profile.region] ?? gusWages.polska ?? 0
  const vocabulary = profile.skills.filter((s) => index.has(`skill__${s}`))

  const contributions: Contribution[] = [
    {
      key: 'seniority', kind: 'profile', label: `Poziom: ${labels.seniority}`,
      value: oneHot(index, `seniority__${profile.seniority}`) + numericTerm(index, 'seniority_rank', SENIORITY_RANK[profile.seniority]),
    },
    { key: 'category', kind: 'profile', label: `Kategoria: ${labels.category}`, value: oneHot(index, `category__${profile.category}`) },
    { key: 'contract', kind: 'profile', label: `Umowa: ${labels.contract}`, value: oneHot(index, `contract__${profile.contract}`) },
    { key: 'region', kind: 'profile', label: `Region: ${labels.region}`, value: numericTerm(index, 'gus_wage', gusWage) },
  ]
  if (profile.region === 'zdalnie') {
    contributions.push({ key: 'remote', kind: 'profile', label: 'Praca zdalna', value: oneHot(index, 'remote') })
  }
  const nSkillsTerm = numericTerm(index, 'n_skills', vocabulary.length)
  contributions.push({ key: 'n_skills', kind: 'profile', label: `Liczba skilli w stacku: ${vocabulary.length}`, value: nSkillsTerm })

  const skills = vocabulary
    .map((s) => ({ key: `skill:${s}`, kind: 'skill' as const, label: s, value: oneHot(index, `skill__${s}`) }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const skillsSum = skills.reduce((acc, c) => acc + c.value, 0)

  const total = base + [...contributions, ...skills].reduce((acc, c) => acc + c.value, 0)
  return {
    base,
    total,
    contributions: [...contributions, ...skills],
    skillsSum,
    nSkillsTerm,
    premium: skillsSum + nSkillsTerm,
    gusWage,
    multiple: gusWage > 0 ? total / gusWage : 0,
  }
}
