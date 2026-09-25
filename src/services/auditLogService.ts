import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

/** One recorded change. `changes` is `{created: {...}}`, `{deleted: {...}}` or `{field: {from, to}}` plus `_subject`. */
export type AuditEntry = {
  logId: number
  serverId: string
  boardId: number | null
  boardName: string | null
  userId: string | null
  actorUsername: string | null
  actorDisplayName: string | null
  actorAvatarUrl: string | null
  action: string
  entityType: string
  entityId: number | null
  source: string
  changes: Record<string, unknown> | null
  createdAt: string
}

export type AuditPage = {
  entries: AuditEntry[]
  /** Pass as `before` for the next, older page; null when there is none. */
  nextBefore: number | null
}

export type AuditFilter = {
  boardId?: string
  actorUserId?: string
  entityTypes?: string[]
}

export async function fetchAuditLog(serverId: string, filter: AuditFilter, before?: number | null): Promise<AuditPage> {
  const params = new URLSearchParams({ limit: '50' })
  if (filter.boardId) params.set('boardId', filter.boardId)
  if (filter.actorUserId) params.set('actorUserId', filter.actorUserId)
  for (const type of filter.entityTypes ?? []) params.append('entityType', type)
  if (before) params.set('before', String(before))

  const response = await apiFetch(`/api/servers/${serverId}/audit-logs?${params.toString()}`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<AuditPage>
}

/** Someone with recorded changes in the server's log. */
export type AuditActor = {
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export async function fetchAuditActors(serverId: string): Promise<AuditActor[]> {
  const response = await apiFetch(`/api/servers/${serverId}/audit-logs/actors`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<AuditActor[]>
}
