import { useCallback, useEffect, useState } from 'react'
import { signOut, useSession } from '../../api/session'
import {
  clearCallbackQuery,
  clearOAuthSessionState,
  exchangeDiscordCode,
  getExpectedOAuthState,
  isOAuthInProgress,
  startDiscordLogin,
} from '../../services/authService'
import { useMe } from '../session/sessionQueries'
import { saveSelectedServerId } from './dashboardModel'

export type Banner = { text: string; type: 'success' | 'error' }

type OAuthCallback = { code: string } | { error: string } | null

let callbackMemo: { search: string; result: OAuthCallback } | null = null
/** Authorization codes already sent to the API; a code can be exchanged only once. */
const exchangedCodes = new Set<string>()

/**
 * The result of returning from Discord's authorization page, read once per URL. Reading it consumes
 * the stored OAuth state, so it is memoised: React may run initialisers and effects twice in development.
 */
function readOAuthCallback(): OAuthCallback {
  const search = window.location.search
  if (callbackMemo?.search === search) return callbackMemo.result

  let result: OAuthCallback = null
  if (isOAuthInProgress()) {
    const params = new URLSearchParams(search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    const expectedState = getExpectedOAuthState()
    clearOAuthSessionState()

    if (error) {
      clearCallbackQuery()
      result = { error: `Discord authorization failed: ${error}` }
    } else if (code && (!state || state !== expectedState)) {
      clearCallbackQuery()
      result = { error: 'Invalid OAuth state. Please try again.' }
    } else if (code) {
      result = { code }
    }
  }

  callbackMemo = { search, result }
  return result
}

/**
 * Sign-in state for the dashboard: finishing a Discord login when returning from Discord, the
 * signed-in user, logging out, and a short-lived status banner.
 */
export function useDashboardSession() {
  const session = useSession()
  const [callback] = useState(readOAuthCallback)
  const [exchanging, setExchanging] = useState(() => Boolean(callback && 'code' in callback))
  const [banner, setBanner] = useState<Banner | null>(() =>
    callback && 'error' in callback ? { text: callback.error, type: 'error' } : null,
  )

  const meQuery = useMe()
  const isAuthenticated = session.status === 'signedIn'
  const sessionExpired = session.status === 'signedOut' && session.reason === 'expired'

  useEffect(() => {
    if (!callback || !('code' in callback) || exchangedCodes.has(callback.code)) return
    exchangedCodes.add(callback.code)

    exchangeDiscordCode(callback.code)
      .then(() => {
        setBanner({ text: 'Logged in successfully.', type: 'success' })
        clearCallbackQuery()
      })
      .catch((error: unknown) => {
        setBanner({ text: error instanceof Error ? error.message : 'OAuth login failed', type: 'error' })
      })
      .finally(() => setExchanging(false))
  }, [callback])

  // Success messages disappear after 3 seconds, errors after 5.
  useEffect(() => {
    if (!banner) return
    const timer = window.setTimeout(() => setBanner(null), banner.type === 'success' ? 3000 : 5000)
    return () => window.clearTimeout(timer)
  }, [banner])

  const showBanner = useCallback((text: string, type: Banner['type'] = 'error') => setBanner({ text, type }), [])

  function login() {
    setBanner(null)
    startDiscordLogin((text) => {
      if (text) setBanner({ text, type: 'error' })
    })
  }

  function logout() {
    clearCallbackQuery()
    saveSelectedServerId('')
    void signOut().then(() => setBanner({ text: 'Logged out successfully.', type: 'success' }))
  }

  return {
    // Signed in: the freshly loaded user, or the one the session was issued for until it loads.
    me: isAuthenticated ? (meQuery.data ?? session.user) : null,
    isAuthenticated,
    exchanging: exchanging || session.status === 'loading',
    banner: sessionExpired && !banner ? { text: 'Session expired. Please login again.', type: 'error' as const } : banner,
    showBanner,
    login,
    logout,
  }
}
