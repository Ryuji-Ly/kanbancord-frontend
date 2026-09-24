import { parseError } from '../api/http'
import { apiFetch } from '../api/session'
import type { BoardColumnEntry } from './boardColumnsService'
import type { PermissionDecisionMap } from './permissionsService'
import type { TaskAssignmentEntry } from './taskAssignmentsService'
import type { TaskEntry } from './tasksService'

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
  serverId: string,
  archived?: boolean,
): Promise<BoardEntry[]> {
  const params = new URLSearchParams()
  if (archived !== undefined) {
    params.set('archived', String(archived))
  }

  const response = await apiFetch(`/api/servers/${serverId}/boards?${params.toString()}`)
  if (!response.ok) throw new Error(await parseError(response))

  const data = (await response.json()) as SpringPage<BoardEntry>
  return Array.isArray(data.content) ? data.content : []
}

export async function createBoard(
  serverId: string,
  input: {
    name: string
    description: string
    columnNames?: string[]
  },
): Promise<BoardEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      serverId,
      name: input.name,
      description: input.description,
      columnNames: input.columnNames,
    }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardEntry>
}

export async function updateBoard(
  serverId: string,
  boardId: string,
  input: {
    name: string
    description: string
  },
): Promise<BoardEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      serverId,
      name: input.name,
      description: input.description,
    }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardEntry>
}

export async function fetchBoardById(
  serverId: string,
  boardId: string,
): Promise<BoardEntry> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardEntry>
}

/** Everything the board page shows, and what the caller may do on the board. */
export type LabelEntry = {
  labelId: number
  boardId: number
  name: string
  color: string
}

/** A priority level of a board. Position 1 is the most urgent. */
export type PriorityEntry = {
  priorityId: number
  boardId: number
  name: string
  color: string | null
  position: number
}

export type TaskLabelEntry = {
  id: number
  taskId: number
  labelId: number
  addedAt: string
}

export type BoardSnapshot = {
  board: BoardEntry
  columns: BoardColumnEntry[]
  tasks: TaskEntry[]
  assignments: TaskAssignmentEntry[]
  labels: LabelEntry[]
  /** Which labels are on which tasks. */
  taskLabels: TaskLabelEntry[]
  /** The board's priority levels, most urgent first. */
  priorities: PriorityEntry[]
  permissions: PermissionDecisionMap
}

export async function fetchBoardSnapshot(
  serverId: string,
  boardId: string,
): Promise<BoardSnapshot> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/snapshot`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardSnapshot>
}

export async function archiveBoard(
  serverId: string,
  boardId: string,
  archived: boolean,
): Promise<BoardEntry> {
  const params = new URLSearchParams({ archived: String(archived) })
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/archive?${params.toString()}`, {
    method: 'PATCH',
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<BoardEntry>
}

export async function deleteBoard(
  serverId: string,
  boardId: string,
): Promise<void> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(await parseError(response))
}
