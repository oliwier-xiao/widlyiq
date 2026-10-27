import { STAGE_META, type PipelineEvent, type StageId } from './stages'

export type RunErrorEvent = Extract<PipelineEvent, { event: 'error' }>

/** Failures the browser sees before or around the stream, which never reach Python. */
export type ClientFailure =
  | { kind: 'busy' }
  | { kind: 'network' }
  | { kind: 'http'; status: number }
  | { kind: 'cut' }

/** unchanged is false only when the outcome is unknown: a cut stream may hide a run that finished on the server. */
export type RunError = { title: string; action: string; detail: string | null; unchanged: boolean }

const SNAPSHOT_HINT = 'Uruchom „Tylko snapshot”: nie czeka na portale.'

/**
 * Every failure gets a sentence that names what broke and one that says what to do next. The raw message stays
 * available as detail, for the person who has to fix it, but never stands in for the explanation.
 */
export function describeRunError(e: RunErrorEvent | ClientFailure, mode: 'live' | 'snapshot', running: StageId | null): RunError {
  // A missing library is the most common first-run failure and has one fix, whichever way Python reported it.
  if ('message' in e && e.message.includes('ModuleNotFoundError')) {
    return { title: 'Pythonowi brakuje bibliotek ETL.', action: 'Zainstaluj zależności ETL i spróbuj ponownie.', detail: e.message, unchanged: true }
  }
  switch (e.kind) {
    case 'busy':
      return { title: 'Inny przebieg pipeline jeszcze trwa.', action: 'Poczekaj, aż się skończy, i odśwież stronę.', detail: null, unchanged: true }
    case 'network':
      return { title: 'Serwer dashboardu nie odpowiada.', action: 'Sprawdź, czy aplikacja nadal działa, i spróbuj ponownie.', detail: null, unchanged: true }
    case 'http':
      return { title: `Serwer odrzucił uruchomienie (błąd ${e.status}).`, action: 'Spróbuj ponownie za chwilę.', detail: null, unchanged: true }
    case 'cut':
      return {
        title: 'Połączenie z pipeline urwało się przed końcem.',
        action: 'Odśwież stronę: jeśli przebieg zdążył się skończyć, zobaczysz nowe dane.',
        detail: null,
        unchanged: false,
      }
    case 'spawn':
      return { title: 'Nie udało się uruchomić Pythona.', action: 'Zainstaluj zależności ETL i spróbuj ponownie.', detail: e.message, unchanged: true }
    case 'timeout':
      return { title: 'Przebieg trwał ponad 5 minut i został przerwany.', action: mode === 'live' ? SNAPSHOT_HINT : 'Spróbuj ponownie.', detail: null, unchanged: true }
    case 'crash':
      return { title: 'Proces ETL zakończył się błędem.', action: mode === 'live' ? `Spróbuj ponownie albo ${lower(SNAPSHOT_HINT)}` : 'Spróbuj ponownie.', detail: e.message, unchanged: true }
    default: {
      // The stage that was running when Python failed is the one to name; after_stage is only the last one that finished.
      const stage = running ?? e.after_stage ?? null
      return {
        title: stage ? `Pipeline przerwał się na etapie „${STAGE_META[stage].label}”.` : 'Pipeline przerwał się przed pierwszym etapem.',
        action: mode === 'live' ? `Spróbuj ponownie albo ${lower(SNAPSHOT_HINT)}` : 'Spróbuj ponownie.',
        detail: e.message,
        unchanged: true,
      }
    }
  }
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
