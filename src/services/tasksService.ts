import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

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
  serverId: string,
  boardId: string,
  options?: {
    archived?: boolean
    columnId?: number
  },
): Promise<TaskEntry[]> {
  const params = new URLSearchParams({ size: '500' })
  if (options?.archived !== undefined) {
    params.set('archived', String(options.archived))
  }
  if (options?.columnId !== undefined) {
    params.set('columnId', String(options.columnId))
  }

  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks?${params.toString()}`)
  if (!response.ok) throw new Error(await parseError(response))

  const data = (await response.json()) as SpringPage<TaskEntry>
  return Array.isArray(data.content) ? data.content : []
}

export async function createTask(
  serverId: string,
  boardId: string,
  input: {
    title: string
    description?: string | null
    columnId: number
    position?: number | null
    priority?: string | null
    dueDate?: string | null
  },
): Promise<TaskEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      description: input.description ?? undefined,
      boardId: Number(boardId),
      columnId: input.columnId,
      position: input.position ?? undefined,
      priority: input.priority ?? undefined,
      dueDate: input.dueDate ?? undefined,
    }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskEntry>
}

export async function updateTask(
  serverId: string,
  boardId: string,
  taskId: number,
  input: {
    title: string
    description?: string | null
    columnId: number
    position?: number | null
    priority?: string | null
    dueDate?: string | null
  },
): Promise<TaskEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      description: input.description ?? undefined,
      boardId: Number(boardId),
      columnId: input.columnId,
      position: input.position ?? undefined,
      priority: input.priority ?? undefined,
      dueDate: input.dueDate ?? undefined,
    }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskEntry>
}
/** Puts a task at `index` (0-based) of a column; the server renumbers the affected columns. */
export async function moveTask(
  serverId: string,
  boardId: string,
  taskId: number,
  columnId: number,
  index: number,
): Promise<TaskEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columnId, index }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskEntry>
}

export async function deleteTask(
  serverId: string,
  boardId: string,
  taskId: number,
): Promise<void> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}`,
    { method: 'DELETE' },
  )
  if (!response.ok) throw new Error(await parseError(response))
}
