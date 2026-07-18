import { apiUrl, parseError } from '../api/http'

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export type ServerMemberEntry = {
  id: number
  serverId: string
  userId: string
  nickname: string | null
  displayName: string
  username: string
  avatarUrl: string | null
  joinedAt: string
}

export type ServerUserEntry = {
  userId: string
  username: string
  globalName: string | null
  avatarUrl: string | null
}

export async function fetchServerMembers(
  token: string,
  serverId: string,
  userId: string,
): Promise<ServerMemberEntry[]> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/members?${params.toString()}`),
    { headers: authHeaders(token) },
  )

  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerMemberEntry[]>
}

export async function fetchServerUserById(
  token: string,
  serverId: string,
  targetUserId: string,
  userId: string,
): Promise<ServerUserEntry> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/users/${targetUserId}?${params.toString()}`),
    { headers: authHeaders(token) },
  )

  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerUserEntry>
}
