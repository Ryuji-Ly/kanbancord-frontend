import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '../../api/session'
import { subscribeRealtime, USER_QUEUE, type UserRealtimeEvent } from '../../services/realtimeService'

/**
 * Keeps what belongs to the signed-in user current in every tab and on every device: profile and
 * preferences, notifications, and the list of sessions.
 */
export function useUserRealtime() {
  const session = useSession()
  const queryClient = useQueryClient()
  const userId = session.status === 'signedIn' ? String(session.user.userId) : ''

  useEffect(() => {
    if (!userId) return
    return subscribeRealtime<UserRealtimeEvent>(USER_QUEUE, {
      onEvent: (event) => {
        switch (event.eventType) {
          case 'PROFILE_UPDATED':
            void queryClient.invalidateQueries({ queryKey: ['me', userId] })
            break
          case 'NOTIFICATIONS_CHANGED':
            void queryClient.invalidateQueries({ queryKey: ['notifications'] })
            break
          case 'SESSIONS_CHANGED':
            void queryClient.invalidateQueries({ queryKey: ['sessions'] })
            break
        }
      },
    })
  }, [userId, queryClient])
}
