import { RunPipelineButton } from './RunPipelineButton'

/** First run on a fresh clone: no database yet, so the only useful action is to build one. */
export function EmptyState() {
  return (
    <div className="mx-auto max-w-[640px] px-6 py-24">
      <h1 className="t-headline">Baza danych jeszcze nie istnieje</h1>
      <p className="mt-3 t-body text-ink-2">
        Uruchom pipeline: pobierze oferty z No Fluff Jobs, Just Join IT i SOLID.Jobs, kursy NBP i płace GUS.
        Gdy sieć jest niedostępna, użyje zapisanych snapshotów.
        Pierwszy przebieg trwa kilka sekund w trybie snapshot i około 30 s na żywo.
      </p>
      <div className="mt-8">
        <RunPipelineButton size="large" />
      </div>
      <p className="t-meta mt-4">
        Z terminala: <code className="t-code">npm run etl</code> albo <code className="t-code">npm run etl:snapshot</code>
      </p>
    </div>
  )
}
