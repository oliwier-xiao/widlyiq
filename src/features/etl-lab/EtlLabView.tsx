import Image from 'next/image'

import type { StageSnapshot } from '@/shared/lib/stages'
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
          subtitle="12 etapów od pobrania do zapisu w bazie. Kolorowy wycinek paska to rekordy odrzucone na etapie."
        >
          <StageList stages={stages} raw={run.counts.raw} />
        </Panel>
        <Panel
          title="Źródła danych"
          subtitle="Gdy źródło nie odpowiada, pipeline bierze zapisany snapshot."
        >
          <SourceList sources={run.sources} />
        </Panel>
        <Panel
          className="lg:col-span-2"
          title="Raw vs Clean"
          subtitle="Rekord przed czyszczeniem i po nim. Podświetlone pola zmienił pipeline."
        >
          <DiffInspector samples={samples} />
        </Panel>
        <Panel
          className="lg:col-span-2"
          title="Diagnostyka IQR"
          subtitle="Wykres z Matplotlib, odświeżany przy każdym przebiegu."
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
