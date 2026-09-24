import { useQueryClient } from '@tanstack/react-query'

export type Rollback<T> = { previous: T | undefined }

/**
 * Applies a change to cached data before the server confirms it, restores the previous data if the
 * request fails, and refetches afterwards so the cache ends up as the server has it.
 */
export function useOptimisticCache<T>(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient()
  return {
    async apply(update: (current: T) => T): Promise<Rollback<T>> {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<T>(queryKey)
      if (previous !== undefined) queryClient.setQueryData<T>(queryKey, update(previous))
      return { previous }
    },
    rollback(context: Rollback<T> | undefined) {
      if (context?.previous !== undefined) queryClient.setQueryData<T>(queryKey, context.previous)
    },
    set(update: (current: T) => T) {
      queryClient.setQueryData<T>(queryKey, (current) => (current === undefined ? current : update(current)))
    },
    refresh() {
      return queryClient.invalidateQueries({ queryKey })
    },
  }
}
