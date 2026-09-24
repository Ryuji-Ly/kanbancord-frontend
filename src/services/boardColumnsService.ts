import { apiUrl, parseError } from '../api/http'

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export type BoardColumnEntry = {
  columnId: number
  boardId: number
  name: string
  position: number | null
  color: string | null
  wipLimit: number | null
  createdAt: string
  updatedAt: string
}

export async function fetchBoardColumns(
  token: string,
  serverId: string,
  boardId: string,
): Promise<BoardColumnEntry[]> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/columns`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardColumnEntry[]>
}

export async function createColumn(
  token: string,
  serverId: string,
  boardId: string,
  name: string,
): Promise<BoardColumnEntry> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/columns`),
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, boardId: Number(boardId) }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardColumnEntry>
}

export async function updateColumn(
  token: string,
  serverId: string,
  boardId: string,
  columnId: number,
  name: string,
  options?: {
    position?: number | null
    color?: string | null
    wipLimit?: number | null
  },
): Promise<BoardColumnEntry> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/columns/${columnId}`),
    {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        boardId: Number(boardId),
        position: options?.position ?? undefined,
        color: options?.color ?? undefined,
        wipLimit: options?.wipLimit ?? undefined,
      }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardColumnEntry>
}

/** Puts a column at `index` (0-based) on its board; the server renumbers the others. */
export async function moveColumn(
  token: string,
  serverId: string,
  boardId: string,
  columnId: number,
  index: number,
): Promise<BoardColumnEntry> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/columns/${columnId}/move`),
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardColumnEntry>
}

export async function deleteColumn(
  token: string,
  serverId: string,
  boardId: string,
  columnId: number,
): Promise<void> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/columns/${columnId}`),
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
}
