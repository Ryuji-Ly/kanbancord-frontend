import { parseError } from '../api/http'
import { apiFetch } from '../api/session'
import type { BoardEntry } from './boardsService'

/** The optional parts of a board file; the board, its columns and tasks are always in it. */
export const BOARD_PARTS = ['labels', 'priorities', 'assignees', 'comments', 'permissions'] as const
export type BoardPart = (typeof BOARD_PARTS)[number]

/** A board file, as far as the website reads it; the API checks the rest when importing. */
export type BoardFile = {
  format: string
  version: number
  board: { name: string; description?: string }
  columns: unknown[]
  tasks: { assignees?: unknown[]; roles?: unknown[]; comments?: unknown[] }[]
  labels?: unknown[]
  priorities?: unknown[]
  permissions?: unknown[]
}

export type BoardImportResult = {
  board: BoardEntry
  imported: Record<string, number>
  skipped: Record<string, number>
}

export async function exportBoard(serverId: string, boardId: string, parts: BoardPart[]): Promise<BoardFile> {
  const params = new URLSearchParams()
  parts.forEach((part) => params.append('part', part))
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/export?${params.toString()}`)
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as BoardFile
}

export async function importBoard(
  serverId: string,
  input: { document: BoardFile; parts: BoardPart[]; name: string },
): Promise<BoardImportResult> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as BoardImportResult
}

/** The file read as a board file, or null when it is not one. */
export function readBoardFile(text: string): BoardFile | null {
  try {
    const file = JSON.parse(text) as Partial<BoardFile> | null
    if (!file || file.format !== 'kanbancord-board' || !file.board || !Array.isArray(file.columns) || !Array.isArray(file.tasks)) {
      return null
    }
    return file as BoardFile
  } catch {
    return null
  }
}

/** The optional parts the file has. */
export function partsInFile(file: BoardFile): BoardPart[] {
  const has: Record<BoardPart, boolean> = {
    labels: Array.isArray(file.labels),
    priorities: Array.isArray(file.priorities),
    assignees: file.tasks.some((task) => Array.isArray(task.assignees) || Array.isArray(task.roles)),
    comments: file.tasks.some((task) => Array.isArray(task.comments)),
    permissions: Array.isArray(file.permissions),
  }
  return BOARD_PARTS.filter((part) => has[part])
}

/** Saves the file to the user's device. */
export function downloadBoardFile(file: BoardFile): void {
  const name = file.board.name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'board'
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
  link.download = `${name}.kanbancord.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
