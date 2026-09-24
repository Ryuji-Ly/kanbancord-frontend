import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  boardTopic,
  serverTopic,
  subscribeRealtime,
  type RealtimeEvent,
  type RealtimeRevocation,
} from '../../services/realtimeService'
import { serverKeys } from '../server/serverQueries'
import { boardKeys } from './boardQueries'

/** How long to wait for more events before refetching, so a burst of changes causes one refresh. */
const REFRESH_DEBOUNCE_MS = 150

/** Server-wide changes that can change what the user may do on the board, or who is listed on it. */
const ACCESS_ENTITIES = new Set(['PERMISSION', 'ROLE', 'MEMBER', 'SERVER'])

/**
 * Keeps the board's cached data current: any change announced on the board's topic marks everything
 * cached for the board as stale, and whatever is on screen refetches. The server topic is watched
 * too, because server-wide rules, roles and memberships decide what the user may do on the board.
 *
 * Only connect once the board has loaded; a board the user cannot view would otherwise be
 * subscribed (and refused) again on every reconnect.
 *
 * When the server ends a subscription because the user lost access or the board was deleted, the
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
    const refreshBoard = (alsoMembers: boolean) => {
      if (alsoMembers) void queryClient.invalidateQueries({ queryKey: serverKeys.members(serverId) })
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        void queryClient.invalidateQueries({ queryKey: boardKeys.all(serverId, boardId) })
      }, REFRESH_DEBOUNCE_MS)
    }
    const revoked = (revocation: RealtimeRevocation) => {
      onRevokedRef.current(revocation.reason)
      void queryClient.resetQueries({ queryKey: boardKeys.all(serverId, boardId) })
    }

    const unsubscribeBoard = subscribeRealtime<RealtimeEvent>(boardTopic(serverId, boardId), {
      onEvent: () => refreshBoard(false),
      onRevoked: revoked,
    })
    // Board events also reach the server topic; those for this board already came on its own topic.
    const unsubscribeServer = subscribeRealtime<RealtimeEvent>(serverTopic(serverId), {
      onEvent: (event) => {
        if (ACCESS_ENTITIES.has(event.entityType)) refreshBoard(event.entityType !== 'PERMISSION')
      },
      // Without the server the board is gone too.
      onRevoked: (revocation) => revoked({ ...revocation, reason: 'ACCESS_LOST' }),
    })

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      unsubscribeBoard()
      unsubscribeServer()
    }
  }, [serverId, boardId, active, queryClient])
}
