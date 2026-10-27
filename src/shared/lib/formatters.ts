// pl-PL skips grouping for 4-digit numbers by default ("8196"); tables need "8 196" so columns align.
const integer = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0, useGrouping: 'always' })
const twoDecimals = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const oneDecimal = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dateTime = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const dateOnly = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
const MINUS = '−'

export function formatNumber(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? 'brak danych' : integer.format(Math.round(value))
}

export function formatPLN(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? 'brak danych' : `${integer.format(Math.round(value))} zł`
}

export function formatThousands(value: number): string {
  return `${oneDecimal.format(value / 1000)} tys.`
}

export function formatMultiple(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? 'brak danych' : `${twoDecimals.format(value)}×`
}

export function formatSignedPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'brak danych'
  const body = oneDecimal.format(Math.abs(value))
  return `${value > 0 ? '+' : value < 0 ? MINUS : ''}${body}%`
}

export function formatSignedPLN(value: number): string {
  const body = integer.format(Math.abs(Math.round(value)))
  return `${value > 0 ? '+' : value < 0 ? MINUS : ''}${body} zł`
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : 'brak danych'
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateOnly.format(new Date(iso)) : 'brak danych'
}

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${oneDecimal.format(ms / 1000)} s`
}

export function formatRegion(region: string): string {
  if (region === 'zdalnie') return 'Zdalnie'
  if (region === 'polska') return 'Polska'
  return region.charAt(0).toUpperCase() + region.slice(1)
}

/** "w województwie podkarpackim": the locative a sentence needs after a region filter. */
export function inRegion(region: string): string {
  if (region === 'polska') return 'w całej Polsce'
  if (region === 'zdalnie') return 'w ofertach zdalnych'
  return `w województwie ${region.replace(/ie$/, 'im')}`
}

/** Polish counts take three forms: 1 oferta, 2 do 4 oferty (but 12 do 14 ofert), everything else ofert. */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  const word = n === 1 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many
  return `${formatNumber(n)} ${word}`
}

export const offersLabel = (n: number) => plural(n, 'oferta', 'oferty', 'ofert')

export function inOffers(n: number): string {
  return n === 1 ? 'w 1 ofercie' : `w ${formatNumber(n)} ofertach`
}
