import { QueryClient } from '@tanstack/react-query'
import { SignedOutError } from './session'

/** Client errors (the API's `{"status":4xx}` body, or `Request failed (4xx)`) will not change on retry. */
function isClientError(error: unknown): boolean {
  return /"status":\s*4\d\d|\(4\d\d\)/.test(String(error))
}

/** How long data nothing on screen uses is kept, so going back to a page shows it at once. */
const KEEP_UNUSED_MS = 60 * 60_000

/**
 * Server data cache shared by all pages. Realtime events mark board data stale, so there is no
 * refetch on window focus; failed requests are retried once unless the server refused them.
 * Data left on another page is kept for an hour: coming back shows it straight away while it is
 * refreshed behind the scenes.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: KEEP_UNUSED_MS,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        failureCount < 1 && !isClientError(error) && !(error instanceof SignedOutError),
    },
  },
})
