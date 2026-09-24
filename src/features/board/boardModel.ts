import type { BoardSnapshot, LabelEntry } from '../../services/boardsService'
import type { BoardColumnEntry } from '../../services/boardColumnsService'
import type { ServerMemberEntry } from '../../services/serverMembersService'
import type { TaskCommentEditor, TaskCommentEntry } from '../../services/taskCommentsService'
import type { TaskEntry } from '../../services/tasksService'
import type { MeResponse } from '../../types/auth'

// ── Types ────────────────────────────────────────────────────────────────────

export type TaskDraft = {
  title: string
  description: string
  /** One of the board's priority levels, or null for none. */
  priorityId: number | null
  dueDate: string
}

export const EMPTY_TASK_DRAFT: TaskDraft = {
  title: '',
  description: '',
  priorityId: null,
  dueDate: '',
}

export type AssigneeMember = {
  userId: string
  username: string
  displayName: string
  nickname: string | null
  avatarUrl: string | null
}

export type TaskDropTarget = { columnId: number; dropIndex: number }

/** What the current user may do on this board. Everything is off while the board is archived. */
export type BoardAbilities = {
  editColumn: boolean
  createColumn: boolean
  deleteColumn: boolean
  moveColumn: boolean
  createTask: boolean
  editTask: boolean
  deleteTask: boolean
  moveTask: boolean
  assignSelf: boolean
  assignOthers: boolean
  comment: boolean
  moderateCommentEdits: boolean
  moderateCommentDeletes: boolean
  applyLabel: boolean
  removeLabel: boolean
  createLabel: boolean
  managePriorities: boolean
}

export function boardAbilities(snapshot: BoardSnapshot | undefined): BoardAbilities {
  const archived = !snapshot || snapshot.board.isArchived
  const can = (key: string) => !archived && Boolean(snapshot?.permissions[key]?.allowed)
  return {
    editColumn: can('EDIT_COLUMN'),
    createColumn: can('CREATE_COLUMN'),
    deleteColumn: can('DELETE_COLUMN'),
    moveColumn: can('MOVE_COLUMN'),
    createTask: can('CREATE_TASK'),
    editTask: can('EDIT_TASK'),
    deleteTask: can('DELETE_TASK'),
    moveTask: can('MOVE_TASK'),
    assignSelf: can('ASSIGN_TASK_SELF'),
    assignOthers: can('ASSIGN_TASK_OTHERS'),
    comment: can('CREATE_TASK_COMMENT'),
    moderateCommentEdits: can('EDIT_TASK_COMMENT'),
    moderateCommentDeletes: can('DELETE_TASK_COMMENT'),
    applyLabel: can('APPLY_LABEL_TO_TASK'),
    removeLabel: can('REMOVE_LABEL_FROM_TASK'),
    createLabel: can('CREATE_LABEL'),
    managePriorities: can('MANAGE_PRIORITIES'),
  }
}

/**
 * What the user may change in the board settings. Unlike {@link boardAbilities} this is not switched
 * off for an archived board: it still has to be restorable, deletable and viewable.
 */
export type BoardSettingsAccess = {
  editDetails: boolean
  editPermissions: boolean
  archive: boolean
  delete: boolean
  createLabel: boolean
  editLabel: boolean
  deleteLabel: boolean
  managePriorities: boolean
}

export function boardSettingsAccess(permissions: Record<string, { allowed: boolean } | boolean> | undefined): BoardSettingsAccess {
  const can = (key: string) => {
    const decision = permissions?.[key]
    return typeof decision === 'boolean' ? decision : Boolean(decision?.allowed)
  }
  return {
    editDetails: can('EDIT_BOARD_DETAILS'),
    editPermissions: can('EDIT_BOARD_PERMISSIONS'),
    archive: can('ARCHIVE_BOARD'),
    delete: can('DELETE_BOARD'),
    createLabel: can('CREATE_LABEL'),
    editLabel: can('EDIT_LABEL'),
    deleteLabel: can('DELETE_LABEL'),
    managePriorities: can('MANAGE_PRIORITIES'),
  }
}

/** Whether the settings would show the user anything they may change. */
export function hasAnySetting(access: BoardSettingsAccess): boolean {
  return Object.values(access).some(Boolean)
}

// ── Labels and priorities ────────────────────────────────────────────────────

/** Colours given to new labels in turn; any colour can be picked afterwards. */
export const LABEL_PALETTE = [
  '#2563eb', '#16a34a', '#db2777', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#4f46e5', '#dc2626', '#0d9488',
]

/** The palette colour used least on the board, so labels created in a row get different colours. */
export function nextLabelColor(labels: Pick<LabelEntry, 'color'>[]): string {
  const used = new Map<string, number>()
  for (const label of labels) used.set(label.color.toLowerCase(), (used.get(label.color.toLowerCase()) ?? 0) + 1)
  return LABEL_PALETTE.reduce((best, color) => ((used.get(color) ?? 0) < (used.get(best) ?? 0) ? color : best))
}

/** The labels on each task, in the board's label order. */
export function labelsByTask(snapshot: BoardSnapshot | undefined): Map<number, { label: LabelEntry; taskLabelId: number }[]> {
  const labels = new Map((snapshot?.labels ?? []).map((label) => [label.labelId, label]))
  const byTask = new Map<number, { label: LabelEntry; taskLabelId: number }[]>()
  for (const taskLabel of snapshot?.taskLabels ?? []) {
    const label = labels.get(taskLabel.labelId)
    if (!label) continue
    const list = byTask.get(taskLabel.taskId) ?? []
    list.push({ label, taskLabelId: taskLabel.id })
    byTask.set(taskLabel.taskId, list)
  }
  const order = new Map((snapshot?.labels ?? []).map((label, index) => [label.labelId, index]))
  byTask.forEach((list) => list.sort((a, b) => (order.get(a.label.labelId) ?? 0) - (order.get(b.label.labelId) ?? 0)))
  return byTask
}

/** Black or white, whichever reads better on the colour. */
export function readableTextColor(background: string | null): string {
  const hex = (background ?? '').replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#ffffff'
  const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111827' : '#ffffff'
}

// ── Ordering ─────────────────────────────────────────────────────────────────

/** Board order, as the server sorts it: by position, columns without one last. */
export function sortColumns(entries: BoardColumnEntry[]): BoardColumnEntry[] {
  return [...entries].sort(
    (left, right) =>
      Number(left.position ?? Number.POSITIVE_INFINITY) - Number(right.position ?? Number.POSITIVE_INFINITY),
  )
}

export function sortTasks(entries: TaskEntry[]): TaskEntry[] {
  return [...entries].sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
}

export function groupTasksByColumn(entries: TaskEntry[]): Record<number, TaskEntry[]> {
  const groups: Record<number, TaskEntry[]> = {}
  for (const entry of entries) {
    ;(groups[entry.columnId] ??= []).push(entry)
  }
  for (const columnId of Object.keys(groups)) {
    groups[Number(columnId)] = sortTasks(groups[Number(columnId)])
  }
  return groups
}

function normalizeTasks(entries: TaskEntry[], columnId: number): TaskEntry[] {
  return entries.map((entry, index) => ({ ...entry, columnId, position: index + 1 }))
}

export function reorderColumnsByIndex(
  entries: BoardColumnEntry[],
  draggedColumnId: number,
  dropIndex: number,
): BoardColumnEntry[] {
  const draggedIndex = entries.findIndex((entry) => entry.columnId === draggedColumnId)
  if (draggedIndex < 0) return entries

  const withoutDragged = entries.filter((entry) => entry.columnId !== draggedColumnId)
  const boundedDropIndex = Math.max(0, Math.min(dropIndex, withoutDragged.length))
  const reordered = [...withoutDragged]
  reordered.splice(boundedDropIndex, 0, entries[draggedIndex])
  return reordered.map((entry, index) => ({ ...entry, position: index + 1 }))
}

export function moveTaskLocally(
  taskGroups: Record<number, TaskEntry[]>,
  draggedTaskId: number,
  targetColumnId: number,
  dropIndex: number,
): Record<number, TaskEntry[]> {
  let draggedTask: TaskEntry | null = null
  let sourceColumnId: number | null = null

  for (const [rawColumnId, entries] of Object.entries(taskGroups)) {
    const found = entries.find((entry) => entry.taskId === draggedTaskId)
    if (found) {
      draggedTask = found
      sourceColumnId = Number(rawColumnId)
      break
    }
  }

  if (!draggedTask || sourceColumnId === null) {
    return taskGroups
  }

  const nextGroups: Record<number, TaskEntry[]> = Object.fromEntries(
    Object.entries(taskGroups).map(([columnId, entries]) => [columnId, [...entries]]),
  )

  const sourceTasks = [...(nextGroups[sourceColumnId] ?? [])].filter((entry) => entry.taskId !== draggedTaskId)
  const targetTasks = sourceColumnId === targetColumnId ? sourceTasks : [...(nextGroups[targetColumnId] ?? [])]
  const insertIndex = Math.max(0, Math.min(dropIndex, targetTasks.length))
  targetTasks.splice(insertIndex, 0, { ...draggedTask, columnId: targetColumnId })

  nextGroups[sourceColumnId] = normalizeTasks(sourceTasks, sourceColumnId)
  nextGroups[targetColumnId] = normalizeTasks(targetTasks, targetColumnId)
  return nextGroups
}

/** The snapshot with a task moved the way the server will move it: both columns renumbered 1, 2, 3... */
export function snapshotWithTaskMoved(
  snapshot: BoardSnapshot,
  taskId: number,
  columnId: number,
  index: number,
): BoardSnapshot {
  const groups = moveTaskLocally(groupTasksByColumn(snapshot.tasks), taskId, columnId, index)
  return { ...snapshot, tasks: Object.values(groups).flat() }
}

/** The snapshot with a column moved the way the server will move it. */
export function snapshotWithColumnMoved(snapshot: BoardSnapshot, columnId: number, index: number): BoardSnapshot {
  return { ...snapshot, columns: reorderColumnsByIndex(sortColumns(snapshot.columns), columnId, index) }
}

// ── Drop targets ─────────────────────────────────────────────────────────────

export function isColumnDragExcludedTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('[data-no-column-drag="true"]') !== null
}

export function resolveColumnDropIndex(
  row: HTMLElement,
  entries: BoardColumnEntry[],
  draggedColumnId: number,
  clientX: number,
): number {
  const positionedEntries = entries
    .filter((entry) => entry.columnId !== draggedColumnId)
    .map((entry) => {
      const element = row.querySelector<HTMLElement>(`.kc-board-column-card[data-column-id="${entry.columnId}"]`)
      return element ? { entry, rect: element.getBoundingClientRect() } : null
    })
    .filter((item): item is { entry: BoardColumnEntry; rect: DOMRect } => item !== null)

  for (let index = 0; index < positionedEntries.length; index += 1) {
    const { rect } = positionedEntries[index]
    if (clientX < rect.left + rect.width / 2) return index
  }
  return positionedEntries.length
}

export function resolveTaskDropIndex(
  dropzone: HTMLElement,
  entries: TaskEntry[],
  draggedTaskId: number,
  clientY: number,
): number {
  const positionedTasks = entries
    .filter((entry) => entry.taskId !== draggedTaskId)
    .map((entry) => {
      const element = dropzone.querySelector<HTMLElement>(`.kc-column-task-card[data-task-id="${entry.taskId}"]`)
      return element ? { entry, rect: element.getBoundingClientRect() } : null
    })
    .filter((item): item is { entry: TaskEntry; rect: DOMRect } => item !== null)

  for (let index = 0; index < positionedTasks.length; index += 1) {
    const { rect } = positionedTasks[index]
    if (clientY < rect.top + rect.height / 2) return index
  }
  return positionedTasks.length
}

function resolveTaskTargetColumnId(row: HTMLElement, entries: BoardColumnEntry[], clientX: number): number | null {
  const positionedColumns = entries
    .map((entry) => {
      const element = row.querySelector<HTMLElement>(`.kc-board-column-card[data-column-id="${entry.columnId}"]`)
      return element ? { entry, rect: element.getBoundingClientRect() } : null
    })
    .filter((item): item is { entry: BoardColumnEntry; rect: DOMRect } => item !== null)

  if (positionedColumns.length === 0) return null

  const firstColumn = positionedColumns[0]
  const lastColumn = positionedColumns[positionedColumns.length - 1]
  if (clientX <= firstColumn.rect.left) return firstColumn.entry.columnId
  if (clientX >= lastColumn.rect.right) return lastColumn.entry.columnId

  for (let index = 0; index < positionedColumns.length; index += 1) {
    const current = positionedColumns[index]
    if (clientX >= current.rect.left && clientX <= current.rect.right) {
      return current.entry.columnId
    }
    if (index < positionedColumns.length - 1) {
      const next = positionedColumns[index + 1]
      if (clientX > current.rect.right && clientX < next.rect.left) {
        const gapMiddle = current.rect.right + (next.rect.left - current.rect.right) / 2
        return clientX < gapMiddle ? current.entry.columnId : next.entry.columnId
      }
    }
  }
  return null
}

/** Where a task dropped anywhere on the board row lands: the nearest column and position in it. */
export function resolveTaskDropTargetFromBoard(
  row: HTMLElement,
  columns: BoardColumnEntry[],
  tasksByColumn: Record<number, TaskEntry[]>,
  draggedTaskId: number,
  clientX: number,
  clientY: number,
): TaskDropTarget | null {
  const targetColumnId = resolveTaskTargetColumnId(row, columns, clientX)
  if (targetColumnId === null) return null

  const targetColumnElement = row.querySelector<HTMLElement>(`.kc-board-column-card[data-column-id="${targetColumnId}"]`)
  if (!targetColumnElement) return null

  return {
    columnId: targetColumnId,
    dropIndex: resolveTaskDropIndex(targetColumnElement, tasksByColumn[targetColumnId] ?? [], draggedTaskId, clientY),
  }
}

// ── Markdown checklists ──────────────────────────────────────────────────────

/** Ticks or unticks the n-th `- [ ]` item of a markdown text. */
export function toggleTaskListItemByIndex(markdown: string, itemIndex: number, checked: boolean): string {
  if (itemIndex < 0) return markdown

  const lines = markdown.split(/\r?\n/)
  let seen = -1
  const taskRegex = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\](?:\s.*)?)$/

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(taskRegex)
    if (!match) continue

    seen += 1
    if (seen !== itemIndex) continue

    const [, prefix, , suffix] = match
    lines[index] = `${prefix}${checked ? 'x' : ' '}${suffix}`
    return lines.join('\n')
  }

  return markdown
}

// ── Tasks and drafts ─────────────────────────────────────────────────────────

export function draftFromTask(task: TaskEntry): TaskDraft {
  return {
    title: task.title ?? '',
    description: task.description ?? '',
    priorityId: task.priorityId ?? null,
    dueDate: task.dueDate ? task.dueDate.slice(0, 16) : '',
  }
}

// ── Comments ─────────────────────────────────────────────────────────────────

export function sortCommentsByCreatedAt(entries: TaskCommentEntry[]): TaskCommentEntry[] {
  return [...entries].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
}

export function resolveCommentAuthorName(comment: TaskCommentEntry): string {
  return comment.authorGlobalName?.trim() || comment.authorUsername
}

function resolveEditorLabel(editor: TaskCommentEditor): string {
  return editor.globalName?.trim() || editor.username
}

export function formatCommentTimestamp(value: string | null): string {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString()
}

/** "(edited)" when the author edited, or "(edited by: …)" naming everyone when someone else did. */
export function commentEditLabel(comment: TaskCommentEntry): string {
  const created = comment.createdAt ? new Date(comment.createdAt).getTime() : 0
  const updated = comment.updatedAt ? new Date(comment.updatedAt).getTime() : 0
  if (!updated || updated <= created) return ''

  const uniqueEditors = Array.from(new Map((comment.editedByUsers ?? []).map((editor) => [editor.userId, editor])).values())
  const nonAuthorEditors = uniqueEditors.filter((editor) => editor.userId !== comment.userId)
  if (nonAuthorEditors.length === 0) return '(edited)'
  return `(edited by: ${uniqueEditors.map(resolveEditorLabel).join(', ')})`
}

// ── Assignees ────────────────────────────────────────────────────────────────

export function resolveAssigneeDisplayName(user: Pick<AssigneeMember, 'displayName' | 'username'>): string {
  return user.displayName?.trim() || user.username
}

export function toAssigneeMembers(members: ServerMemberEntry[]): AssigneeMember[] {
  return members.map((member) => ({
    userId: String(member.userId),
    username: member.username,
    displayName: member.displayName,
    nickname: member.nickname,
    avatarUrl: member.avatarUrl,
  }))
}

/** Server members by user id, plus the current user (who may be missing from a stale member list). */
export function assigneeDirectory(members: AssigneeMember[], me: MeResponse | null): Map<string, AssigneeMember> {
  const directory = new Map(members.map((member) => [member.userId, member]))
  if (me) {
    directory.set(String(me.userId), {
      userId: String(me.userId),
      username: me.username,
      displayName: me.globalName || me.username,
      nickname: null,
      avatarUrl: me.avatarUrl ?? null,
    })
  }
  return directory
}

export function resolveAssignee(directory: Map<string, AssigneeMember>, userId: string): AssigneeMember {
  return directory.get(userId) ?? { userId, username: userId, displayName: userId, nickname: null, avatarUrl: null }
}

/** Up to 50 members matching a search, leaving out those already picked. */
export function searchMembers(members: AssigneeMember[], query: string, exclude: Set<string>): AssigneeMember[] {
  const needle = query.trim().toLowerCase()
  return members
    .filter((member) => !exclude.has(member.userId))
    .filter(
      (member) =>
        !needle ||
        [member.username, member.displayName, member.nickname ?? '', member.userId].some((value) =>
          value.toLowerCase().includes(needle),
        ),
    )
    .slice(0, 50)
}
