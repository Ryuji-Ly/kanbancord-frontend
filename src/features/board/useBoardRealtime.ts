import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { boardTopic, connectRealtimeChannel, type RealtimeRevocation } from '../../services/realtimeService'
import { boardKeys } from './boardQueries'

/** How long to wait for more events before refetching, so a burst of changes causes one refresh. */
const REFRESH_DEBOUNCE_MS = 150

/**
 * Keeps the board's cached data current: any change announced on the board's topic marks everything
 * cached for the board as stale, and whatever is on screen refetches.
 *
 * Only connect once the board has loaded; a board the user cannot view would otherwise be
 * subscribed (and refused) again on every reconnect.
 *
 * When the server ends the subscription because the user lost access or the board was deleted, the
 * cached board is dropped so nothing the user may no longer see stays on screen.
 */
export function useBoardRealtime(
  serverId: string,
  boardId: string,
  active: boolean,
  onRevoked: (reason: RealtimeRevocation['reason']) => void,
) {
  const queryClient = useQueryClient()
  const onRevokedRef = useRef(onRevoked)
  useEffect(() => {
    onRevokedRef.current = onRevoked
  })

  useEffect(() => {
    if (!active || !serverId || !boardId) return

    let timer: number | null = null
    const disconnect = connectRealtimeChannel({
      destination: boardTopic(serverId, boardId),
      onEvent: () => {
        if (timer !== null) window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          timer = null
          void queryClient.invalidateQueries({ queryKey: boardKeys.all(serverId, boardId) })
        }, REFRESH_DEBOUNCE_MS)
      },
      onRevoked: (revocation) => {
        onRevokedRef.current(revocation.reason)
        void queryClient.resetQueries({ queryKey: boardKeys.all(serverId, boardId) })
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
