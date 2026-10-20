import Image from 'next/image'

import type { StageSnapshot } from '@/shared/lib/stages'
import { CodeButton } from '@/shared/ui/CodeDrawer'
import { Panel, SeamGrid } from '@/shared/ui/Panel'
import type { ViewProps } from '@/shared/ui/types'

import { DiffInspector } from './DiffInspector'
import { getSamples } from './queries'
import { RunToolbar } from './RunToolbar'
import { SourceList } from './SourceList'
import { StageList } from './StageList'

export function EtlLabView({ run }: ViewProps) {
  const samples = getSamples()
  const stages = run.stages as unknown as StageSnapshot[]
  return (
    <>
      <RunToolbar lastFinishedAt={run.finishedAt} lastMode={run.mode} lastDurationMs={run.durationMs} />
      <SeamGrid className="border-b border-seam lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <Panel
          title="Przebieg pipeline"
          subtitle="12 etapów od pobrania do zapisu w SQLite. Ciemny pasek to rekordy, które przeszły dalej, kolorowy wycinek to to, co etap odrzucił."
        >
          <StageList stages={stages} raw={run.counts.raw} />
        </Panel>
        <Panel
          title="Źródła danych"
          subtitle="Każde źródło próbuje sieci, a przy błędzie lub blokadzie wraca do snapshotu z python_etl/snapshots."
        >
          <SourceList sources={run.sources} />
        </Panel>
        <Panel
          className="lg:col-span-2"
          title="Raw vs Clean"
          subtitle="Wybrany rekord przed i po czyszczeniu. Podświetlone pola zmienił pipeline; każda zmiana prowadzi do swojego kodu."
        >
          <DiffInspector samples={samples} />
        </Panel>
        <Panel
          className="lg:col-span-2"
          title="Diagnostyka IQR"
          subtitle="Wykres z Matplotlib generowany przy każdym przebiegu."
          actions={<CodeButton anchor="plot-mpl" />}
          footer="Oś jest logarytmiczna, bo płace mają rozkład log-normalny: płotki Q1 − 1,5 × IQR i Q3 + 1,5 × IQR liczone na log(płacy) tolerują odchylenie w górę i w dół jednakowo."
        >
          <div className="border-t border-seam px-5 py-4">
            <Image
              src={`/diagnostics/iqr_distribution.svg?v=${run.runId}`}
              alt="Rozkład wynagrodzeń według poziomu na skali logarytmicznej: pudełka IQR, szare oferty, pomarańczowe oferty z Podkarpacia i odrzucone outliery jako puste czerwone okręgi."
              width={1200}
              height={520}
              unoptimized
              className="h-auto w-full max-w-[1200px]"
            />
          </div>
        </Panel>
      </SeamGrid>
    </>
  )
}
