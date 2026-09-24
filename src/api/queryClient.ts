import { QueryClient } from '@tanstack/react-query'
import { SignedOutError } from './session'

/** Client errors (the API's `{"status":4xx}` body, or `Request failed (4xx)`) will not change on retry. */
function isClientError(error: unknown): boolean {
  return /"status":\s*4\d\d|\(4\d\d\)/.test(String(error))
}

/**
 * Server data cache shared by all pages. Realtime events mark board data stale, so there is no
 * refetch on window focus; failed requests are retried once unless the server refused them.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        failureCount < 1 && !isClientError(error) && !(error instanceof SignedOutError),
    },
  },
})
