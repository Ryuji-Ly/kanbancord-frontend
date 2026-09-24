import { apiUrl, parseError } from '../api/http'

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export type BoardEntry = {
  boardId: number
  serverId: string
  name: string
  description: string | null
  isArchived: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

type SpringPage<T> = {
  content: T[]
}

export async function fetchBoards(
  token: string,
  serverId: string,
  archived?: boolean,
): Promise<BoardEntry[]> {
  const params = new URLSearchParams()
  if (archived !== undefined) {
    params.set('archived', String(archived))
  }

  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))

  const data = (await response.json()) as SpringPage<BoardEntry>
  return Array.isArray(data.content) ? data.content : []
}

export async function createBoard(
  token: string,
  serverId: string,
  input: {
    name: string
    description: string
    columnNames?: string[]
  },
): Promise<BoardEntry> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards`),
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverId,
        name: input.name,
        description: input.description,
        columnNames: input.columnNames,
      }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardEntry>
}

export async function updateBoard(
  token: string,
  serverId: string,
  boardId: string,
  input: {
    name: string
    description: string
  },
): Promise<BoardEntry> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}`),
    {
      method: 'PUT',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverId,
        name: input.name,
        description: input.description,
      }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardEntry>
}

export async function fetchBoardById(
  token: string,
  serverId: string,
  boardId: string,
): Promise<BoardEntry> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardEntry>
}

export async function archiveBoard(
  token: string,
  serverId: string,
  boardId: string,
  archived: boolean,
): Promise<BoardEntry> {
  const params = new URLSearchParams({ archived: String(archived) })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/archive?${params.toString()}`),
    {
      method: 'PATCH',
      headers: authHeaders(token),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardEntry>
}

export async function deleteBoard(
  token: string,
  serverId: string,
  boardId: string,
): Promise<void> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}`),
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
}
