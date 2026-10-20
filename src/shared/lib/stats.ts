/** Linear interpolation between order statistics, the same rule pandas and NumPy use by default. */
export function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export type Percentiles = { p10: number; p25: number; p50: number; p75: number; p90: number }

export const MIN_SAMPLE = 10

export function percentiles(values: readonly number[]): Percentiles | null {
  // Below this size P10 and P90 are each one or two offers, which reads as precision the data does not have.
  if (values.length < MIN_SAMPLE) return null
  const sorted = [...values].sort((a, b) => a - b)
  return {
    p10: quantile(sorted, 0.1)!,
    p25: quantile(sorted, 0.25)!,
    p50: quantile(sorted, 0.5)!,
    p75: quantile(sorted, 0.75)!,
    p90: quantile(sorted, 0.9)!,
  }
}

export function median(values: readonly number[]): number | null {
  return quantile([...values].sort((a, b) => a - b), 0.5)
}
