import { useSyncExternalStore } from 'react'
import { apiUrl, parseError } from './http'
import type { AuthResponse, MeResponse } from '../types/auth'

/**
 * The signed-in session.
 *
 * The access token lives only in memory, so scripts that run on the page later cannot find it in
 * storage. It is short-lived and renewed with the refresh cookie, which is httpOnly and sent only to
 * the API's auth endpoints. A new tab or a reload therefore starts by refreshing.
 */
export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; reason: 'expired' | 'loggedOut' | null }
  | { status: 'signedIn'; user: MeResponse; accessToken: string; expiresAt: number }

/** Thrown by API calls once the session has ended; the page shows the signed-out state instead. */
export class SignedOutError extends Error {
  constructor() {
    super('You are not signed in.')
    this.name = 'SignedOutError'
  }
}

/** Renew this long before the access token expires, so requests never carry one that is about to lapse. */
const EXPIRY_MARGIN_MS = 60_000
const REFRESH_LOCK = 'kanbancord-session-refresh'

let state: SessionState = { status: 'loading' }
/** Bumped on every sign-in and sign-out, so a refresh that was already under way cannot undo them. */
let generation = 0
let refreshing: Promise<SessionState> | null = null
const listeners = new Set<() => void>()

// Tabs tell each other when someone signs in or out, so every tab shows the same state.
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('kanbancord-session')
channel?.addEventListener('message', (event: MessageEvent) => {
  if (event.data === 'signed-out') {
    generation++
    setState({ status: 'signedOut', reason: 'loggedOut' })
  } else if (event.data === 'signed-in' && state.status !== 'signedIn') {
    void refreshSession()
  }
})

function setState(next: SessionState) {
  state = next
  listeners.forEach((listener) => listener())
}

function signedIn(auth: AuthResponse): SessionState {
  return {
    status: 'signedIn',
    user: auth.user,
    accessToken: auth.accessToken,
    expiresAt: Date.now() + auth.expiresIn * 1000,
  }
}

async function requestRefresh(): Promise<SessionState> {
  const startedAt = generation
  const response = await fetch(apiUrl('/api/auth/refresh'), { method: 'POST', credentials: 'include' })
  if (generation !== startedAt) return state
  if (response.status === 401) {
    // Only a session that existed can have expired; a visitor who never signed in sees no message.
    setState({ status: 'signedOut', reason: state.status === 'signedIn' ? 'expired' : null })
    return state
  }
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  setState(signedIn((await response.json()) as AuthResponse))
  return state
}

/**
 * Renews the access token with the refresh cookie. Each refresh replaces the cookie, so refreshes
 * run one at a time: within the page through a shared promise, and across tabs through a Web Lock.
 */
export function refreshSession(): Promise<SessionState> {
  if (!refreshing) {
    const run = navigator.locks ? navigator.locks.request(REFRESH_LOCK, requestRefresh) : requestRefresh()
    refreshing = run.finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

/** Finds out whether this browser has a session, once per page load. */
let loaded: Promise<SessionState> | null = null
export function loadSession(): Promise<SessionState> {
  loaded ??= refreshSession().catch((error: unknown) => {
    // The API is unreachable: show the signed-out state rather than loading forever.
    setState({ status: 'signedOut', reason: null })
    throw error
  })
  return loaded
}

async function accessToken(): Promise<string> {
  if (state.status === 'signedIn' && state.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return state.accessToken
  }
  if (state.status === 'signedOut') {
    throw new SignedOutError()
  }
  const renewed = await refreshSession()
  if (renewed.status !== 'signedIn') throw new SignedOutError()
  return renewed.accessToken
}

/** A request to the API as the signed-in user. A rejected token is renewed once and the request retried. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string) => {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(apiUrl(path), { ...init, headers })
  }

  const response = await send(await accessToken())
  if (response.status !== 401) return response

  // The token expired early or its session was revoked; refreshing tells which.
  const renewed = await refreshSession()
  if (renewed.status !== 'signedIn') throw new SignedOutError()
  return send(renewed.accessToken)
}

/** Completes a Discord sign-in with the authorization code Discord redirected back with. */
export async function signInWithDiscordCode(code: string, redirectUri: string): Promise<MeResponse> {
  const response = await fetch(apiUrl('/api/auth/discord/exchange'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  const auth = (await response.json()) as AuthResponse
  generation++
  loaded = Promise.resolve(signedIn(auth))
  setState(signedIn(auth))
  channel?.postMessage('signed-in')
  return auth.user
}

/** Signs out this browser's session on the server, then everywhere in this browser. */
export async function signOut(): Promise<void> {
  try {
    await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
  } finally {
    generation++
    setState({ status: 'signedOut', reason: 'loggedOut' })
    channel?.postMessage('signed-out')
  }
}

/** Calls `listener` with the new state whenever the session changes. Returns a function that stops it. */
export function onSessionChange(listener: (state: SessionState) => void): () => void {
  return subscribe(() => listener(state))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The current session, re-rendering when it changes. Starts loading it on first use. */
export function useSession(): SessionState {
  if (state.status === 'loading') void loadSession().catch(() => undefined)
  return useSyncExternalStore(subscribe, () => state)
}
