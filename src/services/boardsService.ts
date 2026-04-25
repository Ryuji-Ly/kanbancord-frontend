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
  userId: string,
  archived?: boolean,
): Promise<BoardEntry[]> {
  const params = new URLSearchParams({ userId })
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
  userId: string,
  input: {
    name: string
    description: string
    createdBy?: string
  },
): Promise<BoardEntry> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards?${params.toString()}`),
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
        createdBy: input.createdBy,
      }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardEntry>
}

export async function updateBoard(
  token: string,
  serverId: string,
  userId: string,
  boardId: string,
  input: {
    name: string
    description: string
    createdBy?: string | null
  },
): Promise<BoardEntry> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}?${params.toString()}`),
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
        createdBy: input.createdBy ?? undefined,
      }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardEntry>
}
