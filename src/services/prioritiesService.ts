import { parseError } from '../api/http'
import { apiFetch } from '../api/session'
import type { PriorityEntry } from './boardsService'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function prioritiesPath(serverId: string, boardId: string) {
  return `/api/servers/${serverId}/boards/${boardId}/priorities`
}

/** Adds a level at the bottom of the board's list. */
export async function createPriority(
  serverId: string,
  boardId: string,
  input: { name: string; color?: string },
): Promise<PriorityEntry> {
  const response = await apiFetch(prioritiesPath(serverId, boardId), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PriorityEntry>
}

export async function updatePriority(
  serverId: string,
  boardId: string,
  priorityId: number,
  input: { name: string; color: string },
): Promise<PriorityEntry> {
  const response = await apiFetch(`${prioritiesPath(serverId, boardId)}/${priorityId}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PriorityEntry>
}

/** Moves a level to `index` (0-based, most urgent first). Returns the whole list in its new order. */
export async function movePriority(
  serverId: string,
  boardId: string,
  priorityId: number,
  index: number,
): Promise<PriorityEntry[]> {
  const response = await apiFetch(`${prioritiesPath(serverId, boardId)}/${priorityId}/move`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ index }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PriorityEntry[]>
}

/** Deletes the level; tasks that had it are left without a priority. */
export async function deletePriority(serverId: string, boardId: string, priorityId: number): Promise<void> {
  const response = await apiFetch(`${prioritiesPath(serverId, boardId)}/${priorityId}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await parseError(response))
}
