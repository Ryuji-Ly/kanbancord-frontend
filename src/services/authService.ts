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

export function startDiscordLogin(setMessage: (value: string) => void): void {
  if (!DISCORD_CLIENT_ID) {
    setMessage('Missing VITE_DISCORD_CLIENT_ID in frontend environment.')
    return
  }

  const state = crypto.randomUUID()
  sessionStorage.setItem(OAUTH_STATE_KEY, state)
  sessionStorage.setItem(OAUTH_IN_PROGRESS_KEY, 'true')

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
