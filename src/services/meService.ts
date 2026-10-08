import { parseError } from '../api/http'
import { apiFetch } from '../api/session'
import type { MeResponse } from '../types/auth'

export async function fetchMe(): Promise<MeResponse> {
  const response = await apiFetch('/api/me')

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json() as Promise<MeResponse>
}

export async function fetchMyServers(): Promise<unknown> {
  const response = await apiFetch('/api/me/servers')

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json() as Promise<unknown>
}

/** Saves the given top-level preference entries; the others keep their value. Null removes one. */
export async function patchPreferences(changes: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await apiFetch('/api/me/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<Record<string, unknown>>
}

/** Asks the developer for the website in another language (a language tag such as pt-BR). */
export async function requestLanguage(language: string, note: string | null): Promise<void> {
  const response = await apiFetch('/api/me/language-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, note }),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

export type SessionEntry = {
  sessionId: string
  createdAt: string
  lastUsedAt: string
  userAgent: string | null
  current: boolean
}

export async function fetchSessions(): Promise<SessionEntry[]> {
  const response = await apiFetch('/api/me/sessions')
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<SessionEntry[]>
}

export async function revokeSession(sessionId: string): Promise<void> {
  const response = await apiFetch(`/api/me/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await parseError(response))
}

/** Signs out every session of the user except this one. */
export async function revokeOtherSessions(): Promise<void> {
  const response = await apiFetch('/api/me/sessions', { method: 'DELETE' })
  if (!response.ok) throw new Error(await parseError(response))
}
