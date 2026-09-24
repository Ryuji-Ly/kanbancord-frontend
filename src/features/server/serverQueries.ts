import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getStoredToken } from '../../services/authService'
import { fetchBoards } from '../../services/boardsService'
import {
  fetchMyAccess,
  fetchPermissionCatalog,
  fetchServerPermissions,
  fetchServerRoles,
} from '../../services/permissionsService'
import { connectRealtimeChannel, serverTopic } from '../../services/realtimeService'
import { fetchServerMembers } from '../../services/serverMembersService'

/** Everything cached for one server shares the prefix, so one invalidation refreshes all of it. */
export const serverKeys = {
  all: (serverId: string) => ['server', serverId] as const,
  boards: (serverId: string) => ['server', serverId, 'boards'] as const,
  access: (serverId: string) => ['server', serverId, 'access'] as const,
  permissions: (serverId: string) => ['server', serverId, 'permissions'] as const,
  roles: (serverId: string) => ['server', serverId, 'roles'] as const,
  members: (serverId: string) => ['server', serverId, 'members'] as const,
  catalog: (serverId: string) => ['server', serverId, 'catalog'] as const,
}

export function requireToken(): string {
  const token = getStoredToken()
  if (!token) throw new Error('You are not signed in.')
  return token
}

/** The server's boards the caller can view. */
export function useServerBoards(serverId: string) {
  return useQuery({
    queryKey: serverKeys.boards(serverId),
    queryFn: () => fetchBoards(requireToken(), serverId),
    enabled: Boolean(serverId),
  })
}

/** What the caller may do in the server and on each of its boards. */
export function useServerAccess(serverId: string) {
  return useQuery({
    queryKey: serverKeys.access(serverId),
    queryFn: () => fetchMyAccess(requireToken(), serverId),
    enabled: Boolean(serverId),
  })
}

/** The server-scope permission rules. */
export function useServerPermissions(serverId: string) {
  return useQuery({
    queryKey: serverKeys.permissions(serverId),
    queryFn: () => fetchServerPermissions(requireToken(), serverId),
    enabled: Boolean(serverId),
  })
}

export function useServerRoles(serverId: string, enabled = true) {
  return useQuery({
    queryKey: serverKeys.roles(serverId),
    queryFn: () => fetchServerRoles(requireToken(), serverId),
    enabled: enabled && Boolean(serverId),
    staleTime: 5 * 60_000,
  })
}

export function useServerMembers(serverId: string, enabled = true) {
  return useQuery({
    queryKey: serverKeys.members(serverId),
    queryFn: () => fetchServerMembers(requireToken(), serverId),
    enabled: enabled && Boolean(serverId),
    staleTime: 5 * 60_000,
  })
}

/** The permission catalog changes only with a deployment. */
export function useServerCatalog(serverId: string, enabled = true) {
  return useQuery({
    queryKey: serverKeys.catalog(serverId),
    queryFn: () => fetchPermissionCatalog(requireToken(), serverId),
    enabled: enabled && Boolean(serverId),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** How long to wait for more events before refetching, so a burst of changes causes one refresh. */
const REFRESH_DEBOUNCE_MS = 150

/** Any change announced on the server's topic marks everything cached for the server as stale. */
export function useServerRealtime(serverId: string, active: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const token = getStoredToken()
    if (!token || !active || !serverId) return

    let timer: number | null = null
    const disconnect = connectRealtimeChannel({
      token,
      destination: serverTopic(serverId),
      onEvent: () => {
        if (timer !== null) window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          timer = null
          void queryClient.invalidateQueries({ queryKey: serverKeys.all(serverId) })
        }, REFRESH_DEBOUNCE_MS)
      },
      onError: (value) => {
        console.error('Dashboard realtime error:', value)
      },
    })

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      disconnect()
    }
  }, [serverId, active, queryClient])
}
