import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

type SpringPage<T> = {
  content: T[]
}

export type TaskCommentEditor = {
  userId: string
  username: string
  globalName: string | null
  avatarUrl: string | null
}

export type TaskCommentEntry = {
  commentId: number
  taskId: number
  userId: string
  authorUsername: string
  authorGlobalName: string | null
  authorAvatarUrl: string | null
  content: string
  replyToId: number | null
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
  editedByUsers: TaskCommentEditor[]
}

export async function fetchTaskComments(
  serverId: string,
  boardId: string,
  taskId: number,
): Promise<TaskCommentEntry[]> {
  const params = new URLSearchParams({
    activeOnly: 'true',
    size: '200',
    sort: 'createdAt,asc',
  })
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/comments?${params.toString()}`)
  if (!response.ok) throw new Error(await parseError(response))
  const data = (await response.json()) as SpringPage<TaskCommentEntry>
  return Array.isArray(data.content) ? data.content : []
}

export async function createTaskComment(
  serverId: string,
  boardId: string,
  taskId: number,
  content: string,
): Promise<TaskCommentEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      content,
    }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskCommentEntry>
}

export async function updateTaskComment(
  serverId: string,
  boardId: string,
  taskId: number,
  commentId: number,
  content: string,
): Promise<TaskCommentEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      content,
    }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskCommentEntry>
}

export async function deleteTaskComment(
  serverId: string,
  boardId: string,
  taskId: number,
  commentId: number,
): Promise<void> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}`,
    { method: 'DELETE' },
  )
  if (!response.ok) throw new Error(await parseError(response))
}
