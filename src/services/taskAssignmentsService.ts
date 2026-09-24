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

export async function fetchBoardTaskAssignments(
  token: string,
  serverId: string,
  boardId: string,
): Promise<TaskAssignmentEntry[]> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/task-assignments`),
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
  targetUserId: string,
): Promise<TaskAssignmentEntry> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/assignments`),
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        userId: targetUserId,
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
): Promise<void> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/assignments/${assignmentId}`),
    { method: 'DELETE', headers: authHeaders(token) },
  )

  if (!response.ok) throw new Error(await parseError(response))
}
