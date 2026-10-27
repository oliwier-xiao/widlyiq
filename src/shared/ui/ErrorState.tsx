'use client'

/** A view failed to read the database: say what most likely happened and offer the one action that usually fixes it. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-[640px] px-6 py-24">
      <h1 className="t-headline">Nie udało się wczytać danych</h1>
      <p className="mt-3 t-body text-ink-2">
        Dashboard nie odczytał bazy danych. Najczęściej właśnie trwa zapis nowego przebiegu pipeline albo plik bazy
        jest chwilowo niedostępny. Spróbuj ponownie za kilka sekund.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-8 inline-flex h-10 items-center bg-carbon px-4 t-control text-paper transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-carbon-2 active:scale-[0.97] pointer-coarse:h-11"
      >
        Spróbuj ponownie
      </button>
      <p className="t-meta mt-4">
        Jeśli błąd wraca, zbuduj bazę od nowa z terminala: <code className="t-code">npm run etl:snapshot</code>
      </p>
    </div>
  )
}
