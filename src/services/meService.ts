import { apiUrl, parseError } from '../api/http'
import type { MeResponse } from '../types/auth'

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  }
}

export async function fetchMe(token: string): Promise<MeResponse> {
  const response = await fetch(apiUrl('/api/me'), {
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json() as Promise<MeResponse>
}

export async function fetchMyServers(token: string): Promise<unknown> {
  const response = await fetch(apiUrl('/api/me/servers'), {
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json() as Promise<unknown>
}
