export const VIEWS = ['market', 'etl', 'skills', 'estimator'] as const
export type View = (typeof VIEWS)[number]

export const VIEW_LABELS: Record<View, string> = {
  market: 'Rynek',
  etl: 'ETL Lab',
  skills: 'Skill Graph',
  estimator: 'Estymator',
}

export const SENIORITIES = ['junior', 'mid', 'senior', 'lead'] as const
export type Seniority = (typeof SENIORITIES)[number]
export const SENIORITY_LABELS: Record<Seniority, string> = { junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead' }

export const CATEGORIES = ['backend', 'frontend', 'fullstack', 'data', 'devops', 'mobile', 'testing', 'security', 'ai'] as const
export const CATEGORY_LABELS: Record<string, string> = {
  all: 'Wszystkie', backend: 'Backend', frontend: 'Frontend', fullstack: 'Fullstack', data: 'Data', devops: 'DevOps',
  mobile: 'Mobile', testing: 'Testing / QA', security: 'Security', ai: 'AI / ML', other: 'Inne',
}

export const CONTRACTS = ['b2b', 'uop'] as const
export const CONTRACT_LABELS: Record<string, string> = { all: 'Każda', b2b: 'B2B', uop: 'UoP', other: 'Inna' }
export const CONTRACT_UNITS: Record<string, string> = { b2b: 'netto / mies.', uop: 'brutto / mies.', all: '/ mies.' }

export const PORTALS = ['nofluffjobs', 'justjoinit', 'solidjobs'] as const
export const PORTAL_LABELS: Record<string, string> = {
  all: 'Wszystkie', nofluffjobs: 'No Fluff Jobs', justjoinit: 'Just Join IT', solidjobs: 'SOLID.Jobs',
}

export type Filters = {
  category: string
  seniority: Seniority
  contract: string
  region: string
  portal: string
}

export const DEFAULT_FILTERS: Filters = { category: 'all', seniority: 'mid', contract: 'b2b', region: 'podkarpackie', portal: 'all' }

type RawParams = Record<string, string | string[] | undefined>

function pick(params: RawParams, key: string): string | undefined {
  const value = params[key]
  return Array.isArray(value) ? value[0] : value
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** Untrusted URL input is narrowed to known values here, so SQL builders only ever see whitelisted strings. */
export function parseParams(params: RawParams, regions: readonly string[]): { view: View; filters: Filters } {
  return {
    view: oneOf(pick(params, 'view'), VIEWS, 'market'),
    filters: {
      category: oneOf(pick(params, 'category'), ['all', ...CATEGORIES], DEFAULT_FILTERS.category),
      seniority: oneOf(pick(params, 'seniority'), SENIORITIES, DEFAULT_FILTERS.seniority),
      contract: oneOf(pick(params, 'contract'), ['all', ...CONTRACTS], DEFAULT_FILTERS.contract),
      region: oneOf(pick(params, 'region'), ['polska', ...regions], DEFAULT_FILTERS.region),
      portal: oneOf(pick(params, 'portal'), ['all', ...PORTALS], DEFAULT_FILTERS.portal),
    },
  }
}

export function toSearch(view: View, filters: Filters, patch: Partial<Filters> = {}): string {
  const merged = { ...filters, ...patch }
  const qs = new URLSearchParams({ view })
  for (const [key, value] of Object.entries(merged)) {
    if (value !== DEFAULT_FILTERS[key as keyof Filters]) qs.set(key, value)
  }
  return `?${qs.toString()}`
}
