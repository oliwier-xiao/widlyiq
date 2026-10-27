'use client'

import { ErrorState } from '@/shared/ui/ErrorState'

// Without this boundary a failed SQLite read shows Next's English error screen instead of a way back.
export default function ViewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState onRetry={reset} />
}
