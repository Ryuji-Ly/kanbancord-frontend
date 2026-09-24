import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

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

export async function fetchServerMembers(
  serverId: string,
): Promise<ServerMemberEntry[]> {
  const response = await apiFetch(`/api/servers/${serverId}/members`)

  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerMemberEntry[]>
}
