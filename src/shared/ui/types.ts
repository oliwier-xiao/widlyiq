import type { RunInfo } from '@/shared/db/run'
import type { Filters } from '@/shared/lib/filters'

export type ViewProps = { filters: Filters; regions: string[]; run: RunInfo }
