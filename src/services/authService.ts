import { apiUrl, parseError } from '../api/http'
import {
  DISCORD_CLIENT_ID,
  DISCORD_REDIRECT_URI,
  DISCORD_SCOPES,
  DISCORD_TOKEN_STORAGE_KEY,
  OAUTH_IN_PROGRESS_KEY,
  OAUTH_STATE_KEY,
  TOKEN_STORAGE_KEY,
} from '../config/env'
import type { AuthResponse } from '../types/auth'

export function getStoredToken(): string {
  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export function getStoredDiscordToken(): string {
  return localStorage.getItem(DISCORD_TOKEN_STORAGE_KEY) ?? ''
}

export function saveDiscordToken(token: string): void {
  localStorage.setItem(DISCORD_TOKEN_STORAGE_KEY, token)
}

export function clearDiscordToken(): void {
  localStorage.removeItem(DISCORD_TOKEN_STORAGE_KEY)
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

export async function exchangeDiscordCode(code: string): Promise<AuthResponse> {
  const response = await fetch(apiUrl('/api/auth/discord/exchange'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirectUri: DISCORD_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json() as Promise<AuthResponse>
}
