import { signInWithDiscordCode } from '../api/session'
import {
  DISCORD_CLIENT_ID,
  DISCORD_REDIRECT_URI,
  DISCORD_SCOPES,
  LEGACY_TOKEN_STORAGE_KEYS,
  OAUTH_IN_PROGRESS_KEY,
  OAUTH_STATE_KEY,
} from '../config/env'
import type { MeResponse } from '../types/auth'

/** Tokens earlier versions kept in localStorage; the session no longer uses them, so remove any left behind. */
export function removeLegacyTokens(): void {
  try {
    LEGACY_TOKEN_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Storage may be unavailable, in which case there is nothing to remove.
  }
}

/** Where to go once signed in, when signing in started on a page other than the dashboard. */
const RETURN_KEY = 'kc-oauth-return'

/** The page to go back to after signing in, if one was set; reading it forgets it. */
export function takeReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    // Only this site's own pages.
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null
  } catch {
    return null
  }
}

/**
 * Sends the user to Discord to sign in. Discord always sends them back to the dashboard; with
 * `returnTo`, they then go on to that page (such as the roadmap they signed in from).
 */
export function startDiscordLogin(setMessage: (value: string) => void, returnTo?: string): void {
  if (!DISCORD_CLIENT_ID) {
    setMessage('Missing VITE_DISCORD_CLIENT_ID in frontend environment.')
    return
  }

  const state = crypto.randomUUID()
  sessionStorage.setItem(OAUTH_STATE_KEY, state)
  sessionStorage.setItem(OAUTH_IN_PROGRESS_KEY, 'true')
  if (returnTo) sessionStorage.setItem(RETURN_KEY, returnTo)

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: DISCORD_REDIRECT_URI,
    scope: DISCORD_SCOPES,
    state,
    prompt: 'consent',
  })

  window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`
}

export function isOAuthInProgress(): boolean {
  return sessionStorage.getItem(OAUTH_IN_PROGRESS_KEY) === 'true'
}

export function clearOAuthSessionState(): void {
  sessionStorage.removeItem(OAUTH_IN_PROGRESS_KEY)
  sessionStorage.removeItem(OAUTH_STATE_KEY)
}

export function getExpectedOAuthState(): string | null {
  return sessionStorage.getItem(OAUTH_STATE_KEY)
}

export function clearCallbackQuery(): void {
  window.history.replaceState({}, document.title, window.location.pathname)
}

export function exchangeDiscordCode(code: string): Promise<MeResponse> {
  return signInWithDiscordCode(code, DISCORD_REDIRECT_URI)
}
