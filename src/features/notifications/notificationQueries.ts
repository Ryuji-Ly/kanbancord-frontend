import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFeed,
  deleteFeed,
  fetchMyNotifications,
  fetchServerNotifications,
  setAuditChannel,
  updateFeed,
  updateMyNotifications,
  type FeedChanges,
  type MyNotificationChanges,
  type MyNotifications,
  type ServerNotifications,
} from '../../services/notificationsService'

export const notificationKeys = {
  server: (serverId: string) => ['server', serverId, 'notifications'] as const,
  mine: ['me', 'notifications'] as const,
}

export function useServerNotifications(serverId: string) {
  return useQuery({
    queryKey: notificationKeys.server(serverId),
    queryFn: () => fetchServerNotifications(serverId),
    enabled: Boolean(serverId),
  })
}

/**
 * Changes to a server's notification settings. Each shows at once and is saved straight away; a
 * failure puts the settings back and the caller shows why.
 */
export function useServerNotificationMutations(serverId: string) {
  const queryClient = useQueryClient()
  const key = notificationKeys.server(serverId)

  function optimistic(apply: (current: ServerNotifications) => ServerNotifications) {
    return async () => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ServerNotifications>(key)
      if (previous) queryClient.setQueryData(key, apply(previous))
      return { previous }
    }
  }
  const rollback = (_error: unknown, _variables: unknown, context: { previous?: ServerNotifications } | undefined) => {
    if (context?.previous) queryClient.setQueryData(key, context.previous)
  }
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  return {
    setAuditChannel: useMutation({
      mutationFn: (channelId: string | null) => setAuditChannel(serverId, channelId),
      onMutate: (channelId) => optimistic((current) => ({ ...current, auditChannelId: channelId }))(),
      onError: rollback,
      onSettled: refresh,
    }),
    createFeed: useMutation({
      mutationFn: (feed: FeedChanges) => createFeed(serverId, feed),
      onSettled: refresh,
    }),
    updateFeed: useMutation({
      mutationFn: ({ feedId, changes }: { feedId: number; changes: FeedChanges }) => updateFeed(serverId, feedId, changes),
      onMutate: ({ feedId, changes }) =>
        optimistic((current) => ({
          ...current,
          feeds: current.feeds.map((feed) =>
            feed.feedId === feedId
              ? {
                  ...feed,
                  ...changes,
                  events: { ...feed.events, ...changes.events },
                  mentions: { ...feed.mentions, ...changes.mentions },
                }
              : feed,
          ),
        }))(),
      onError: rollback,
      onSettled: refresh,
    }),
    deleteFeed: useMutation({
      mutationFn: (feedId: number) => deleteFeed(serverId, feedId),
      onMutate: (feedId) => optimistic((current) => ({ ...current, feeds: current.feeds.filter((feed) => feed.feedId !== feedId) }))(),
      onError: rollback,
      onSettled: refresh,
    }),
  }
}

export function useMyNotifications(enabled = true) {
  return useQuery({ queryKey: notificationKeys.mine, queryFn: fetchMyNotifications, enabled })
}

export function useSaveMyNotifications() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: MyNotificationChanges) => updateMyNotifications(changes),
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.mine })
      const previous = queryClient.getQueryData<MyNotifications>(notificationKeys.mine)
      if (previous) {
        queryClient.setQueryData<MyNotifications>(notificationKeys.mine, {
          ...previous,
          ...changes,
          events: { ...previous.events, ...changes.events },
          servers: { ...previous.servers, ...changes.servers },
        })
      }
      return { previous }
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(notificationKeys.mine, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.mine }),
  })
}
