import { useQuery } from '@tanstack/react-query'
import { useSession } from '../../api/session'
import { fetchMe } from '../../services/meService'

/**
 * The signed-in user, freshly loaded. Keyed by user, so signing in as someone else never shows the
 * previous user.
 */
export function useMe() {
  const session = useSession()
  const userId = session.status === 'signedIn' ? String(session.user.userId) : ''
  return useQuery({
    queryKey: ['me', userId],
    queryFn: () => fetchMe(),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
