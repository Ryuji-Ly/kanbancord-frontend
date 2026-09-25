import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

export type TaskAssignmentEntry = {
  id: number
  taskId: number
  userId: string
  assignedBy: string
  assignedAt: string
}

export async function fetchBoardTaskAssignments(
  serverId: string,
  boardId: string,
): Promise<TaskAssignmentEntry[]> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/task-assignments`)

  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskAssignmentEntry[]>
}

export async function createTaskAssignment(
  serverId: string,
  boardId: string,
  taskId: number,
  targetUserId: string,
): Promise<TaskAssignmentEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      userId: targetUserId,
    }),
  })

  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskAssignmentEntry>
}

export async function deleteTaskAssignment(
  serverId: string,
  boardId: string,
  taskId: number,
  assignmentId: number,
): Promise<void> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/assignments/${assignmentId}`,
    { method: 'DELETE' },
  )

  if (!response.ok) throw new Error(await parseError(response))
}

/** A Discord role assigned to a task: anyone with the role can pick it up. */
export type TaskRoleAssignmentEntry = {
  id: number
  taskId: number
  roleId: string
  assignedBy: string | null
  assignedAt: string
}

export async function assignTaskRole(
  serverId: string,
  boardId: string,
  taskId: number,
  roleId: string,
): Promise<TaskRoleAssignmentEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/role-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Kept as a string: role ids are Discord snowflakes, too large for a JavaScript number.
    body: JSON.stringify({ roleId }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskRoleAssignmentEntry>
}

export async function unassignTaskRole(
  serverId: string,
  boardId: string,
  taskId: number,
  assignmentId: number,
): Promise<void> {
  const response = await apiFetch(
    `/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/role-assignments/${assignmentId}`,
    { method: 'DELETE' },
  )
  if (!response.ok) throw new Error(await parseError(response))
}
