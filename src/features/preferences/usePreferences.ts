import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from '../../api/session'
import { patchPreferences } from '../../services/meService'
import type { MeResponse } from '../../types/auth'
import { useMe } from '../session/sessionQueries'
import { applyPreferences, cachePreferences, type Preferences } from './preferencesModel'

/** The signed-in user's preferences, or none when signed out or not loaded yet. */
export function usePreferences(): Preferences | undefined {
  const me = useMe()
  return (me.data?.preferences ?? undefined) as Preferences | undefined
}

/**
 * Saves part of the preferences (for example only the theme). The page changes at once; if saving
 * fails it goes back to what it was.
 */
export function useSavePreferences() {
  const queryClient = useQueryClient()
  const session = useSession()
  const key = ['me', session.status === 'signedIn' ? String(session.user.userId) : '']

  return useMutation({
    mutationFn: (changes: Partial<Preferences>) => patchPreferences(changes),
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<MeResponse>(key)
      if (previous) {
        const preferences = { ...(previous.preferences ?? {}), ...changes }
        queryClient.setQueryData<MeResponse>(key, { ...previous, preferences })
      }
      return { previous }
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData<MeResponse>(key, (current) => (current ? { ...current, preferences } : current))
    },
  })
}

/**
 * Keeps the page in the signed-in user's theme and accessibility settings, including changes made
 * in another tab or on another device, and remembers them for the next visit. Signing out returns
 * to the default look.
 */
export function useApplyPreferences() {
  const session = useSession()
  const preferences = usePreferences()
  const signedOut = session.status === 'signedOut'

  useEffect(() => {
    if (signedOut) {
      applyPreferences(undefined)
      cachePreferences(undefined)
    } else if (preferences) {
      applyPreferences(preferences)
      cachePreferences(preferences)
    }
  }, [preferences, signedOut])
}
