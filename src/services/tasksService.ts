import { apiUrl, parseError } from '../api/http'

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

type SpringPage<T> = {
  content: T[]
}

export type TaskEntry = {
  taskId: number
  boardId: number
  columnId: number
  title: string
  description: string | null
  position: number | null
  priority: string | null
  dueDate: string | null
  isArchived: boolean
  metadata: Record<string, unknown> | null
  createdBy: string | number | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export async function fetchBoardTasks(
  token: string,
  serverId: string,
  boardId: string,
  userId: string,
  options?: {
    archived?: boolean
    columnId?: number
  },
): Promise<TaskEntry[]> {
  const params = new URLSearchParams({ userId, size: '500' })
  if (options?.archived !== undefined) {
    params.set('archived', String(options.archived))
  }
  if (options?.columnId !== undefined) {
    params.set('columnId', String(options.columnId))
  }

  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))

  const data = (await response.json()) as SpringPage<TaskEntry>
  return Array.isArray(data.content) ? data.content : []
}

export async function createTask(
  token: string,
  serverId: string,
  boardId: string,
  userId: string,
  input: {
    title: string
    description?: string | null
    columnId: number
    position?: number | null
    priority?: string | null
    dueDate?: string | null
    createdBy?: string | null
  },
): Promise<TaskEntry> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks?${params.toString()}`),
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        description: input.description ?? undefined,
        boardId: Number(boardId),
        columnId: input.columnId,
        position: input.position ?? undefined,
        priority: input.priority ?? undefined,
        dueDate: input.dueDate ?? undefined,
      }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskEntry>
}

export async function updateTask(
  token: string,
  serverId: string,
  boardId: string,
  taskId: number,
  userId: string,
  input: {
    title: string
    description?: string | null
    columnId: number
    position?: number | null
    priority?: string | null
    dueDate?: string | null
  },
): Promise<TaskEntry> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}?${params.toString()}`),
    {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        description: input.description ?? undefined,
        boardId: Number(boardId),
        columnId: input.columnId,
        position: input.position ?? undefined,
        priority: input.priority ?? undefined,
        dueDate: input.dueDate ?? undefined,
      }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskEntry>
}
export async function deleteTask(
  token: string,
  serverId: string,
  boardId: string,
  taskId: number,
  userId: string,
): Promise<void> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}?${params.toString()}`),
    { method: 'DELETE', headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
}
