import { formatNumber } from '@/shared/lib/formatters'

/** Polish counts: 1 oferta, 2 do 4 oferty (but 12 do 14 ofert), everything else ofert. */
export function offersLabel(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  const word = n === 1 ? 'oferta' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'oferty' : 'ofert'
  return `${formatNumber(n)} ${word}`
}

export function inOffers(n: number): string {
  return n === 1 ? 'w 1 ofercie' : `w ${formatNumber(n)} ofertach`
}
