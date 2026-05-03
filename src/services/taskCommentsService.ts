import { apiUrl, parseError } from '../api/http'

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

type SpringPage<T> = {
  content: T[]
}

export type TaskCommentEditor = {
  userId: number
  username: string
  globalName: string | null
  avatarUrl: string | null
}

export type TaskCommentEntry = {
  commentId: number
  taskId: number
  userId: number
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
  token: string,
  serverId: string,
  boardId: string,
  taskId: number,
  userId: string,
): Promise<TaskCommentEntry[]> {
  const params = new URLSearchParams({
    userId,
    activeOnly: 'true',
    size: '200',
    sort: 'createdAt,asc',
  })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/comments?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  const data = (await response.json()) as SpringPage<TaskCommentEntry>
  return Array.isArray(data.content) ? data.content : []
}

export async function createTaskComment(
  token: string,
  serverId: string,
  boardId: string,
  taskId: number,
  userId: string,
  content: string,
): Promise<TaskCommentEntry> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/comments?${params.toString()}`),
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        content,
      }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskCommentEntry>
}

export async function updateTaskComment(
  token: string,
  serverId: string,
  boardId: string,
  taskId: number,
  commentId: number,
  userId: string,
  content: string,
): Promise<TaskCommentEntry> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}?${params.toString()}`),
    {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        content,
      }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskCommentEntry>
}

export async function deleteTaskComment(
  token: string,
  serverId: string,
  boardId: string,
  taskId: number,
  commentId: number,
  userId: string,
): Promise<void> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}?${params.toString()}`),
    { method: 'DELETE', headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
}
