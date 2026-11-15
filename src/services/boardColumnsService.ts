import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

export type BoardColumnEntry = {
  columnId: number
  boardId: number
  name: string
  position: number | null
  color: string | null
  wipLimit: number | null
  /** Marked as done. Whether its tasks count as done also depends on the other columns: see doneColumnIds. */
  countsAsDone?: boolean
  createdAt: string
  updatedAt: string
}

export async function fetchBoardColumns(
  serverId: string,
  boardId: string,
): Promise<BoardColumnEntry[]> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/columns`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardColumnEntry[]>
}

export async function createColumn(
  serverId: string,
  boardId: string,
  name: string,
): Promise<BoardColumnEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, boardId: Number(boardId) }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardColumnEntry>
}

export async function updateColumn(
  serverId: string,
  boardId: string,
  columnId: number,
  name: string,
  options?: {
    position?: number | null
    color?: string | null
    wipLimit?: number | null
    countsAsDone?: boolean
  },
): Promise<BoardColumnEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/columns/${columnId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      boardId: Number(boardId),
      position: options?.position ?? undefined,
      color: options?.color ?? undefined,
      wipLimit: options?.wipLimit ?? undefined,
      countsAsDone: options?.countsAsDone,
    }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardColumnEntry>
}

/** Puts a column at `index` (0-based) on its board; the server renumbers the others. */
export async function moveColumn(
  serverId: string,
  boardId: string,
  columnId: number,
  index: number,
): Promise<BoardColumnEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/columns/${columnId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardColumnEntry>
}

export async function deleteColumn(
  serverId: string,
  boardId: string,
  columnId: number,
): Promise<void> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/columns/${columnId}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(await parseError(response))
}
