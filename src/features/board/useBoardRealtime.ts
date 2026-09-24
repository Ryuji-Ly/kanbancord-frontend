import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getStoredToken } from '../../services/authService'
import { boardTopic, connectRealtimeChannel } from '../../services/realtimeService'
import { boardKeys } from './boardQueries'

/** How long to wait for more events before refetching, so a burst of changes causes one refresh. */
const REFRESH_DEBOUNCE_MS = 150

/**
 * Keeps the board's cached data current: any change announced on the board's topic marks everything
 * cached for the board as stale, and whatever is on screen refetches.
 *
 * Only connect once the board has loaded; a board the user cannot view would otherwise be
 * subscribed (and refused) again on every reconnect.
 */
export function useBoardRealtime(serverId: string, boardId: string, active: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const token = getStoredToken()
    if (!token || !active || !serverId || !boardId) return

    let timer: number | null = null
    const disconnect = connectRealtimeChannel({
      token,
      destination: boardTopic(serverId, boardId),
      onEvent: () => {
        if (timer !== null) window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          timer = null
          void queryClient.invalidateQueries({ queryKey: boardKeys.all(serverId, boardId) })
        }, REFRESH_DEBOUNCE_MS)
      },
      onError: (value) => {
        console.error('Board realtime error:', value)
      },
    })

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      disconnect()
    }
  }, [serverId, boardId, active, queryClient])
}
