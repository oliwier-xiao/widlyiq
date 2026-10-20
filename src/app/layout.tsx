import type { Metadata } from 'next'
import { Archivo, Red_Hat_Mono } from 'next/font/google'
import type { ReactNode } from 'react'

import './globals.css'

// One family with a width axis carries every role: wide titles, condensed tables, the huge condensed readout.
const archivo = Archivo({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' })
const redHatMono = Red_Hat_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-redhat-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'WidlyIQ · płace IT w Polsce',
  description: 'ETL i feature store ofert pracy IT: percentyle płac, krotność GUS, współwystępowanie technologii i estymator Ridge.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={`${archivo.variable} ${redHatMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
