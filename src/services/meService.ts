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
