import { apiUrl, parseError } from '../api/http'

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export type TaskAssignmentEntry = {
  id: number
  taskId: number
  userId: string
  assignedBy: string
  assignedAt: string
}

export async function fetchTaskAssignments(
  token: string,
  serverId: string,
  boardId: string,
  taskId: number,
  userId: string,
): Promise<TaskAssignmentEntry[]> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/assignments?${params.toString()}`),
    { headers: authHeaders(token) },
  )

  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskAssignmentEntry[]>
}

export async function fetchBoardTaskAssignments(
  token: string,
  serverId: string,
  boardId: string,
  userId: string,
): Promise<TaskAssignmentEntry[]> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/task-assignments?${params.toString()}`),
    { headers: authHeaders(token) },
  )

  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskAssignmentEntry[]>
}

export async function createTaskAssignment(
  token: string,
  serverId: string,
  boardId: string,
  taskId: number,
  userId: string,
  targetUserId: string,
): Promise<TaskAssignmentEntry> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/assignments?${params.toString()}`),
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        userId: targetUserId,
        assignedBy: userId,
      }),
    },
  )

  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskAssignmentEntry>
}

export async function deleteTaskAssignment(
  token: string,
  serverId: string,
  boardId: string,
  taskId: number,
  assignmentId: number,
  userId: string,
): Promise<void> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/assignments/${assignmentId}?${params.toString()}`),
    { method: 'DELETE', headers: authHeaders(token) },
  )

  if (!response.ok) throw new Error(await parseError(response))
}
