import { parseError } from '../api/http'
import { apiFetch } from '../api/session'
import type { LabelEntry, TaskLabelEntry } from './boardsService'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function labelsPath(serverId: string, boardId: string) {
  return `/api/servers/${serverId}/boards/${boardId}/labels`
}

export async function createLabel(
  serverId: string,
  boardId: string,
  input: { name: string; color: string },
): Promise<LabelEntry> {
  const response = await apiFetch(labelsPath(serverId, boardId), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ boardId: Number(boardId), name: input.name, color: input.color }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<LabelEntry>
}

export async function updateLabel(
  serverId: string,
  boardId: string,
  labelId: number,
  input: { name: string; color: string },
): Promise<LabelEntry> {
  const response = await apiFetch(`${labelsPath(serverId, boardId)}/${labelId}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ boardId: Number(boardId), name: input.name, color: input.color }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<LabelEntry>
}

/** Deletes the label from the board, and so from every task it is on. */
export async function deleteLabel(serverId: string, boardId: string, labelId: number): Promise<void> {
  const response = await apiFetch(`${labelsPath(serverId, boardId)}/${labelId}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await parseError(response))
}

export async function addTaskLabel(
  serverId: string,
  boardId: string,
  taskId: number,
  labelId: number,
): Promise<TaskLabelEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/labels`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ taskId, labelId }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<TaskLabelEntry>
}

export async function removeTaskLabel(
  serverId: string,
  boardId: string,
  taskId: number,
  taskLabelId: number,
): Promise<void> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/tasks/${taskId}/labels/${taskLabelId}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(await parseError(response))
}
