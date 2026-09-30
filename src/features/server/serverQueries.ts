import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBoards } from '../../services/boardsService'
import { fetchServerFeatures } from '../../services/featuresService'
import {
  fetchMyAccess,
  fetchPermissionCatalog,
  fetchServerPermissions,
  fetchServerRoles,
} from '../../services/permissionsService'
import { serverTopic, subscribeRealtime, type RealtimeEvent } from '../../services/realtimeService'
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
  features: (serverId: string) => ['server', serverId, 'features'] as const,
  openPermissions: (serverId: string) => ['server', serverId, 'open-permissions'] as const,
}

/** The server's boards the caller can view. */
export function useServerBoards(serverId: string) {
  return useQuery({
    queryKey: serverKeys.boards(serverId),
    queryFn: () => fetchBoards(serverId),
    enabled: Boolean(serverId),
  })
}

/** What the caller may do in the server and on each of its boards. */
export function useServerAccess(serverId: string) {
  return useQuery({
    queryKey: serverKeys.access(serverId),
    queryFn: () => fetchMyAccess(serverId),
    enabled: Boolean(serverId),
  })
}

/** Which optional features the server has on. */
export function useServerFeatures(serverId: string) {
  return useQuery({
    queryKey: serverKeys.features(serverId),
    queryFn: () => fetchServerFeatures(serverId),
    enabled: Boolean(serverId),
  })
}

/** The server-scope permission rules. */
export function useServerPermissions(serverId: string) {
  return useQuery({
    queryKey: serverKeys.permissions(serverId),
    queryFn: () => fetchServerPermissions(serverId),
    enabled: Boolean(serverId),
  })
}

export function useServerRoles(serverId: string, enabled = true) {
  return useQuery({
    queryKey: serverKeys.roles(serverId),
    queryFn: () => fetchServerRoles(serverId),
    enabled: enabled && Boolean(serverId),
    staleTime: 5 * 60_000,
  })
}

export function useServerMembers(serverId: string, enabled = true) {
  return useQuery({
    queryKey: serverKeys.members(serverId),
    queryFn: () => fetchServerMembers(serverId),
    enabled: enabled && Boolean(serverId),
    staleTime: 5 * 60_000,
  })
}

/** The permission catalog changes only with a deployment. */
export function useServerCatalog(serverId: string, enabled = true) {
  return useQuery({
    queryKey: serverKeys.catalog(serverId),
    queryFn: () => fetchPermissionCatalog(serverId),
    enabled: enabled && Boolean(serverId),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** How long to wait for more events before refetching, so a burst of changes causes one refresh. */
const REFRESH_DEBOUNCE_MS = 150

/**
 * Any change announced on the server's topic marks everything cached for the server as stale. A
 * change to the server itself synced from Discord (name, icon, the bot leaving) also refreshes the
 * list of servers.
 */
export function useServerRealtime(serverId: string, active: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!active || !serverId) return

    let timer: number | null = null
    const unsubscribe = subscribeRealtime<RealtimeEvent>(serverTopic(serverId), {
      onEvent: (event) => {
        if (event.entityType === 'SERVER') void queryClient.invalidateQueries({ queryKey: ['me', 'servers'] })
        if (timer !== null) window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          timer = null
          void queryClient.invalidateQueries({ queryKey: serverKeys.all(serverId) })
        }, REFRESH_DEBOUNCE_MS)
      },
      // Lost access to the server: drop what is cached so the workspace shows the refusal instead.
      onRevoked: () => {
        void queryClient.resetQueries({ queryKey: serverKeys.all(serverId) })
      },
    })

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      unsubscribe()
    }
  }, [serverId, active, queryClient])
}
