import { useQuery } from '@tanstack/react-query'
import { fetchMe } from '../../services/meService'

/** The signed-in user. Keyed by token, so signing in as someone else never shows the previous user. */
export function useMe(token: string) {
  return useQuery({
    queryKey: ['me', token],
    queryFn: () => fetchMe(token),
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
