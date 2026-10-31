import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

export type ServerMemberEntry = {
  /** Null for someone found in Discord's member search who is not stored yet. */
  id: number | null
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

/**
 * Members whose name matches `query`. Only people who use KanbanCord (or were picked for something) are in the
 * member list; this also finds everyone else in the server, through Discord. Picking one stores them.
 */
export async function searchServerMembers(serverId: string, query: string): Promise<ServerMemberEntry[]> {
  const response = await apiFetch(`/api/servers/${serverId}/members/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerMemberEntry[]>
}

/** `members` followed by the people in `found` who are not among them. */
export function mergeMembers<T extends { userId: string }>(members: T[], found: T[] | undefined): T[] {
  if (!found?.length) return members
  const known = new Set(members.map((member) => member.userId))
  return [...members, ...found.filter((member) => !known.has(member.userId))]
}
