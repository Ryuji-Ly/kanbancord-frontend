import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getStoredToken } from '../services/authService'
import { fetchMe } from '../services/meService'
import { fetchBoardById, type BoardEntry } from '../services/boardsService'
import {
  fetchBoardColumns,
  createColumn,
  updateColumn,
  deleteColumn,
  type BoardColumnEntry,
} from '../services/boardColumnsService'
import {
  createTask,
  deleteTask,
  fetchBoardTasks,
  updateTask,
  type TaskEntry,
} from '../services/tasksService'
import {
  createTaskAssignment,
  deleteTaskAssignment,
  fetchBoardTaskAssignments,
  type TaskAssignmentEntry,
} from '../services/taskAssignmentsService'
import {
  fetchServerMembers,
  type ServerMemberEntry,
} from '../services/serverMembersService'
import {
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
  updateTaskComment,
  type TaskCommentEditor,
  type TaskCommentEntry,
} from '../services/taskCommentsService'
import { evaluatePermissions } from '../services/permissionsService'
import { boardTopic, connectRealtimeChannel, type RealtimeEvent } from '../services/realtimeService'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { ToastStack } from '../components/dashboard/ToastStack'
import type { HeaderUser, ToastMessage } from '../components/dashboard/types'

type LoadState = 'idle' | 'loading' | 'error' | 'ready'
type ActiveHeaderUser = NonNullable<HeaderUser>
type TaskDropTarget = { columnId: number; dropIndex: number }
type TaskDraft = {
  title: string
  description: string
  priority: string
  dueDate: string
}
type TaskCommentDraft = {
  content: string
}

type AssigneeMember = {
  userId: string
  username: string
  displayName: string
  nickname: string | null
  avatarUrl: string | null
}

const EMPTY_TASK_DRAFT: TaskDraft = {
  title: '',
  description: '',
  priority: '',
  dueDate: '',
}

const EMPTY_TASK_COMMENT_DRAFT: TaskCommentDraft = {
  content: '',
}

const BOARD_PERMISSION_KEYS = [
  'EDIT_COLUMN',
  'CREATE_COLUMN',
  'DELETE_COLUMN',
  'MOVE_COLUMN',
  'CREATE_TASK',
  'EDIT_TASK',
  'DELETE_TASK',
  'MOVE_TASK',
  'ASSIGN_TASK_SELF',
  'ASSIGN_TASK_OTHERS',
  'CREATE_TASK_COMMENT',
  'EDIT_TASK_COMMENT',
  'DELETE_TASK_COMMENT',
]

function resolveCommentAuthorName(comment: TaskCommentEntry): string {
  return comment.authorGlobalName?.trim() || comment.authorUsername
}

function resolveEditorLabel(editor: TaskCommentEditor): string {
  return editor.globalName?.trim() || editor.username
}

function resolveAssigneeDisplayName(user: Pick<AssigneeMember, 'displayName' | 'username'>): string {
  const display = user.displayName?.trim()
  return display || user.username
}

function formatCommentTimestamp(value: string | null): string {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString()
}

function toggleTaskListItemByIndex(markdown: string, itemIndex: number, checked: boolean): string {
  if (itemIndex < 0) return markdown

  const lines = markdown.split(/\r?\n/)
  let seen = -1
  const taskRegex = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\](?:\s.*)?)$/

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = line.match(taskRegex)
    if (!match) continue

    seen += 1
    if (seen !== itemIndex) continue

    const [, prefix, , suffix] = match
    lines[index] = `${prefix}${checked ? 'x' : ' '}${suffix}`
    return lines.join('\n')
  }

  return markdown
}

function sortCommentsByCreatedAt(entries: TaskCommentEntry[]): TaskCommentEntry[] {
  return [...entries].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  )
}

function isColumnDragExcludedTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('[data-no-column-drag="true"]') !== null
}

function resolveColumnDropIndex(
  row: HTMLElement,
  entries: BoardColumnEntry[],
  draggedColumnId: number,
  clientX: number,
): number {
  const draggableEntries = entries.filter((entry) => entry.columnId !== draggedColumnId)
  if (draggableEntries.length === 0) return 0

  const positionedEntries = draggableEntries
    .map((entry) => {
      const element = row.querySelector<HTMLElement>(`.kc-board-column-card[data-column-id="${entry.columnId}"]`)
      if (!element) return null
      return { entry, rect: element.getBoundingClientRect() }
    })
    .filter((item): item is { entry: BoardColumnEntry; rect: DOMRect } => item !== null)

  if (positionedEntries.length === 0) return 0

  for (let index = 0; index < positionedEntries.length; index += 1) {
    const current = positionedEntries[index]
    const middle = current.rect.left + current.rect.width / 2

    if (clientX < middle) {
      return index
    }
  }

  return positionedEntries.length
}

function normalizeColumnPositions(entries: BoardColumnEntry[]): BoardColumnEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    position: index + 1,
  }))
}

function reorderColumnsByIndex(
  entries: BoardColumnEntry[],
  draggedColumnId: number,
  dropIndex: number,
): BoardColumnEntry[] {
  const draggedIndex = entries.findIndex((entry) => entry.columnId === draggedColumnId)
  if (draggedIndex < 0) return entries

  const withoutDragged = entries.filter((entry) => entry.columnId !== draggedColumnId)
  const boundedDropIndex = Math.max(0, Math.min(dropIndex, withoutDragged.length))

  const draggedEntry = entries[draggedIndex]
  const reordered = [...withoutDragged]
  reordered.splice(boundedDropIndex, 0, draggedEntry)
  return normalizeColumnPositions(reordered)
}

function sortTasks(entries: TaskEntry[]): TaskEntry[] {
  return [...entries].sort(
    (left, right) => Number(left.position ?? 0) - Number(right.position ?? 0),
  )
}

function groupTasksByColumn(entries: TaskEntry[]): Record<number, TaskEntry[]> {
  return entries.reduce<Record<number, TaskEntry[]>>((groups, entry) => {
    const existing = groups[entry.columnId] ?? []
    groups[entry.columnId] = sortTasks([...existing, entry])
    return groups
  }, {})
}

function normalizeTasks(entries: TaskEntry[], columnId: number): TaskEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    columnId,
    position: index + 1,
  }))
}

function moveTaskLocally(
  taskGroups: Record<number, TaskEntry[]>,
  draggedTaskId: number,
  targetColumnId: number,
  dropIndex: number,
): Record<number, TaskEntry[]> {
  let draggedTask: TaskEntry | null = null
  let sourceColumnId: number | null = null

  for (const [rawColumnId, entries] of Object.entries(taskGroups)) {
    const columnId = Number(rawColumnId)
    const found = entries.find((entry) => entry.taskId === draggedTaskId)
    if (found) {
      draggedTask = found
      sourceColumnId = columnId
      break
    }
  }

  if (!draggedTask || sourceColumnId === null) {
    return taskGroups
  }

  const nextGroups: Record<number, TaskEntry[]> = Object.fromEntries(
    Object.entries(taskGroups).map(([columnId, entries]) => [columnId, [...entries]]),
  )

  const sourceTasks = [...(nextGroups[sourceColumnId] ?? [])].filter(
    (entry) => entry.taskId !== draggedTaskId,
  )
  const targetTasks =
    sourceColumnId === targetColumnId
      ? sourceTasks
      : [...(nextGroups[targetColumnId] ?? [])]

  const insertIndex = Math.max(0, Math.min(dropIndex, targetTasks.length))

  targetTasks.splice(insertIndex, 0, {
    ...draggedTask,
    columnId: targetColumnId,
  })

  nextGroups[sourceColumnId] = normalizeTasks(sourceTasks, sourceColumnId)
  nextGroups[targetColumnId] = normalizeTasks(targetTasks, targetColumnId)
  return nextGroups
}

function resolveTaskDropIndex(
  dropzone: HTMLElement,
  entries: TaskEntry[],
  draggedTaskId: number,
  clientY: number,
): number {
  const candidates = entries.filter((entry) => entry.taskId !== draggedTaskId)
  const positionedTasks = candidates
    .map((entry) => {
      const element = dropzone.querySelector<HTMLElement>(`.kc-column-task-card[data-task-id="${entry.taskId}"]`)
      if (!element) return null
      return { entry, rect: element.getBoundingClientRect() }
    })
    .filter((item): item is { entry: TaskEntry; rect: DOMRect } => item !== null)

  if (positionedTasks.length === 0) return 0

  for (let index = 0; index < positionedTasks.length; index += 1) {
    const current = positionedTasks[index]
    const middle = current.rect.top + current.rect.height / 2

    if (clientY < middle) {
      return index
    }
  }

  return positionedTasks.length
}

function resolveTaskTargetColumnId(
  row: HTMLElement,
  entries: BoardColumnEntry[],
  clientX: number,
): number | null {
  const positionedColumns = entries
    .map((entry) => {
      const element = row.querySelector<HTMLElement>(`.kc-board-column-card[data-column-id="${entry.columnId}"]`)
      if (!element) return null
      return { entry, rect: element.getBoundingClientRect() }
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

function resolveTaskDropTargetFromBoard(
  row: HTMLElement,
  columns: BoardColumnEntry[],
  tasksByColumn: Record<number, TaskEntry[]>,
  draggedTaskId: number,
  clientX: number,
  clientY: number,
): TaskDropTarget | null {
  const targetColumnId = resolveTaskTargetColumnId(row, columns, clientX)
  if (targetColumnId === null) return null

  const targetColumnElement = row.querySelector<HTMLElement>(
    `.kc-board-column-card[data-column-id="${targetColumnId}"]`,
  )
  if (!targetColumnElement) return null

  return {
    columnId: targetColumnId,
    dropIndex: resolveTaskDropIndex(
      targetColumnElement,
      tasksByColumn[targetColumnId] ?? [],
      draggedTaskId,
      clientY,
    ),
  }
}

function TaskTitle({ title }: { title: string }) {
  const titleRef = useRef<HTMLSpanElement | null>(null)
  const [displayTitle, setDisplayTitle] = useState(title)

  useEffect(() => {
    setDisplayTitle(title)
  }, [title])

  useLayoutEffect(() => {
    const element = titleRef.current
    if (!element) return

    const card = element.closest('.kc-column-task-card')
    if (!(card instanceof HTMLElement)) return

    const priorityTag = card.querySelector('.kc-column-task-priority')
    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(clampTitle)
    })

    let frameId = 0

    function clampTitle() {
      const currentElement = titleRef.current
      if (!currentElement) return
      const titleElement = currentElement

      const computedStyles = window.getComputedStyle(titleElement)
      const lineHeight = Number.parseFloat(computedStyles.lineHeight)
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return

      const maxHeight = lineHeight * 2
      const range = document.createRange()

      function countRenderedLines() {
        const rects = Array.from(range.getClientRects())
        const lineTops: number[] = []

        for (const rect of rects) {
          const matchesExistingLine = lineTops.some((top) => Math.abs(top - rect.top) < 1)
          if (!matchesExistingLine) {
            lineTops.push(rect.top)
          }
        }

        return lineTops.length
      }

      function fitsWithinClamp(text: string) {
        titleElement.textContent = text
        range.selectNodeContents(titleElement)
        return titleElement.scrollHeight <= maxHeight + 1 && countRenderedLines() <= 2
      }

      if (fitsWithinClamp(title)) {
        setDisplayTitle((current) => (current === title ? current : title))
        range.detach()
        return
      }

      let low = 0
      let high = title.length
      let bestFit = '\u2026'

      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        const candidate = `${title.slice(0, mid).trimEnd()}\u2026`

        if (fitsWithinClamp(candidate)) {
          bestFit = candidate
          low = mid + 1
        } else {
          high = mid - 1
        }
      }

      while (bestFit.length > 1 && !fitsWithinClamp(bestFit)) {
        const trimmed = bestFit.slice(0, -1).replace(/\u2026$/, '').trimEnd()
        bestFit = `${trimmed}\u2026`
      }

      setDisplayTitle((current) => (current === bestFit ? current : bestFit))
      range.detach()
    }

    frameId = window.requestAnimationFrame(clampTitle)
    resizeObserver.observe(card)
    resizeObserver.observe(element)
    if (priorityTag instanceof HTMLElement) {
      resizeObserver.observe(priorityTag)
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
      resizeObserver.disconnect()
    }
  }, [title])

  return (
    <span ref={titleRef} className="kc-column-task-title">
      {displayTitle}
    </span>
  )
}

function AssigneeAvatar({
  assignee,
  className,
  loading = 'eager',
}: {
  assignee: Pick<AssigneeMember, 'avatarUrl' | 'displayName' | 'username'>
  className: string
  loading?: ComponentPropsWithoutRef<'img'>['loading']
}) {
  const label = resolveAssigneeDisplayName(assignee)

  return (
    <span className={className} aria-hidden="true" title={label}>
      {assignee.avatarUrl ? (
        <img src={assignee.avatarUrl} alt="" loading={loading} decoding="async" />
      ) : (
        <span>{label.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  )
}

function TaskCardAssigneeStack({ assignees }: { assignees: AssigneeMember[] }) {
  if (assignees.length === 0) return null

  const visibleAssignees = assignees.slice(0, 4)
  const hiddenCount = assignees.length - visibleAssignees.length

  return (
    <div className="kc-column-task-assignees" aria-label={`Assigned to ${assignees.map(resolveAssigneeDisplayName).join(', ')}`}>
      {visibleAssignees.map((assignee) => (
        <AssigneeAvatar
          key={assignee.userId}
          assignee={assignee}
          className="kc-column-task-assignee"
          loading="lazy"
        />
      ))}
      {hiddenCount > 0 ? (
        <span
          className="kc-column-task-assignee kc-column-task-assignee--count"
          aria-label={`${hiddenCount} more assignees`}
        >
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  )
}

export function BoardPage() {
  const { boardId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const serverId = searchParams.get('serverId') ?? ''

  const [state, setState] = useState<LoadState>('idle')
  const [error, setError] = useState('')
  const [board, setBoard] = useState<BoardEntry | null>(null)
  const [columns, setColumns] = useState<BoardColumnEntry[]>([])
  const [me, setMe] = useState<HeaderUser>(null)

  // Permissions
  const [canEditColumn, setCanEditColumn] = useState(false)
  const [canCreateColumn, setCanCreateColumn] = useState(false)
  const [canDeleteColumn, setCanDeleteColumn] = useState(false)
  const [canMoveColumn, setCanMoveColumn] = useState(false)
  const [canCreateTask, setCanCreateTask] = useState(false)
  const [canEditTask, setCanEditTask] = useState(false)
  const [canDeleteTask, setCanDeleteTask] = useState(false)
  const [canMoveTask, setCanMoveTask] = useState(false)
  const [canAssignTaskSelf, setCanAssignTaskSelf] = useState(false)
  const [canAssignTaskOthers, setCanAssignTaskOthers] = useState(false)
  const [canCreateTaskComment, setCanCreateTaskComment] = useState(false)
  const [canEditTaskComment, setCanEditTaskComment] = useState(false)
  const [canDeleteTaskComment, setCanDeleteTaskComment] = useState(false)
  const [tasksByColumn, setTasksByColumn] = useState<Record<number, TaskEntry[]>>({})

  // Inline rename
  const [editingColumnId, setEditingColumnId] = useState<number | null>(null)
  const [editingColumnName, setEditingColumnName] = useState('')

  // Add column
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')

  // 3-dot menu
  const [openMenuColumnId, setOpenMenuColumnId] = useState<number | null>(null)

  // Delete confirmation
  const [deleteTargetColumn, setDeleteTargetColumn] = useState<BoardColumnEntry | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [nextToastId, setNextToastId] = useState(0)
  const [draggedColumnId, setDraggedColumnId] = useState<number | null>(null)
  const [columnDropIndex, setColumnDropIndex] = useState<number | null>(null)
  const [movingColumns, setMovingColumns] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [taskDropColumnId, setTaskDropColumnId] = useState<number | null>(null)
  const [taskDropIndex, setTaskDropIndex] = useState<number | null>(null)
  const [draggedTaskHeight, setDraggedTaskHeight] = useState<number | null>(null)
  const [movingTasks, setMovingTasks] = useState(false)
  const [suppressEditUntil, setSuppressEditUntil] = useState(0)
  const [taskModalColumn, setTaskModalColumn] = useState<BoardColumnEntry | null>(null)
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK_DRAFT)
  const [taskModalError, setTaskModalError] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)
  const [taskDraftAssigneeIds, setTaskDraftAssigneeIds] = useState<string[]>([])
  const [taskAssigneeQuery, setTaskAssigneeQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState<TaskEntry | null>(null)
  const [taskPanelDraft, setTaskPanelDraft] = useState<TaskDraft>(EMPTY_TASK_DRAFT)
  const [taskPanelError, setTaskPanelError] = useState('')
  const [savingTask, setSavingTask] = useState(false)
  const [taskPanelAssigneeQuery, setTaskPanelAssigneeQuery] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [taskPanelExpanded, setTaskPanelExpanded] = useState(false)
  const [togglingTaskChecklist, setTogglingTaskChecklist] = useState(false)
  const [deleteTargetTask, setDeleteTargetTask] = useState<TaskEntry | null>(null)
  const [deleteTaskError, setDeleteTaskError] = useState('')
  const [deletingTask, setDeletingTask] = useState(false)
  const [taskComments, setTaskComments] = useState<TaskCommentEntry[]>([])
  const [taskCommentsState, setTaskCommentsState] = useState<LoadState>('idle')
  const [taskCommentsError, setTaskCommentsError] = useState('')
  const [showCommentComposer, setShowCommentComposer] = useState(false)
  const [taskCommentDraft, setTaskCommentDraft] = useState<TaskCommentDraft>(EMPTY_TASK_COMMENT_DRAFT)
  const [creatingComment, setCreatingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editingCommentContent, setEditingCommentContent] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [openCommentMenuId, setOpenCommentMenuId] = useState<number | null>(null)
  const [deleteTargetComment, setDeleteTargetComment] = useState<TaskCommentEntry | null>(null)
  const [deleteCommentError, setDeleteCommentError] = useState('')
  const [deletingComment, setDeletingComment] = useState(false)
  const [togglingCommentChecklistIds, setTogglingCommentChecklistIds] = useState<Set<number>>(new Set())
  const [serverMembers, setServerMembers] = useState<ServerMemberEntry[]>([])
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignmentEntry[]>([])
  const serverMembersLoadKeyRef = useRef('')
  const boardRealtimeRefreshTimerRef = useRef<number | null>(null)
  const latestSelectedTaskRef = useRef<TaskEntry | null>(null)
  const latestMeRef = useRef<HeaderUser>(me)
  const columnDragImageRef = useRef<HTMLElement | null>(null)
  const columnDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const transparentDragImageRef = useRef<HTMLImageElement | null>(null)
  const taskDragImageRef = useRef<HTMLElement | null>(null)
  const taskDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const taskPanelRef = useRef<HTMLElement | null>(null)

  const isBoardArchived = Boolean(board?.isArchived)
  const canEditColumnsOnPage = canEditColumn && !isBoardArchived
  const canCreateColumnsOnPage = canCreateColumn && !isBoardArchived
  const canDeleteColumnsOnPage = canDeleteColumn && !isBoardArchived
  const canMoveColumnsOnPage = canEditColumn && canMoveColumn && !isBoardArchived
  const canCreateTasksOnPage = canCreateTask && !isBoardArchived
  const canMoveTasksOnPage = canEditTask && canMoveTask && !isBoardArchived
  const canAssignInTaskModal = (canAssignTaskSelf || canAssignTaskOthers) && !isBoardArchived

  const availableAssigneeMembers: AssigneeMember[] = useMemo(
    () =>
      serverMembers.map((member) => ({
        userId: String(member.userId),
        username: member.username,
        displayName: member.displayName,
        nickname: member.nickname,
        avatarUrl: member.avatarUrl,
      })),
    [serverMembers],
  )

  const assigneeMembersByUserId = useMemo(() => {
    const next = new Map<string, AssigneeMember>()

    availableAssigneeMembers.forEach((member) => {
      next.set(member.userId, member)
    })

    if (me) {
      next.set(String(me.userId), {
        userId: String(me.userId),
        username: me.username,
        displayName: me.globalName || me.username,
        nickname: null,
        avatarUrl: me.avatarUrl ?? null,
      })
    }

    return next
  }, [availableAssigneeMembers, me])

  function resolveAssigneeMember(userId: string): AssigneeMember {
    const known = assigneeMembersByUserId.get(userId)
    if (known) return known

    return {
      userId,
      username: userId,
      displayName: userId,
      nickname: null,
      avatarUrl: null,
    }
  }

  const deferredTaskAssigneeQuery = useDeferredValue(taskAssigneeQuery)
  const deferredTaskPanelAssigneeQuery = useDeferredValue(taskPanelAssigneeQuery)

  const selectedDraftAssignees = taskDraftAssigneeIds
    .map((id) => resolveAssigneeMember(id))

  const selectedTaskAssignees = useMemo(() => {
    if (!selectedTask) return []

    return taskAssignments
      .filter((assignment) => assignment.taskId === selectedTask.taskId)
      .map((assignment) => resolveAssigneeMember(String(assignment.userId)))
  }, [selectedTask, taskAssignments, assigneeMembersByUserId])

  const taskAssigneeIds = useMemo(
    () => new Set(selectedTaskAssignees.map((assignee) => assignee.userId)),
    [selectedTaskAssignees],
  )

  const taskAssigneesByTaskId = useMemo(
    () =>
      taskAssignments.reduce<Record<number, AssigneeMember[]>>((groups, assignment) => {
        const taskId = assignment.taskId
        const assignee = resolveAssigneeMember(String(assignment.userId))
        const existing = groups[taskId] ?? []
        groups[taskId] = [...existing, assignee]
        return groups
      }, {}),
    [taskAssignments, assigneeMembersByUserId],
  )

  const filteredTaskPanelAssigneeMembers = useMemo(() => availableAssigneeMembers.filter((member) => {
    if (taskAssigneeIds.has(member.userId)) return false
    if (!canAssignTaskOthers) return false

    const query = deferredTaskPanelAssigneeQuery.trim().toLowerCase()
    if (!query) return true

    return [
      member.username,
      member.displayName,
      member.nickname ?? '',
      member.userId,
    ].some((value) => value.toLowerCase().includes(query))
  }).slice(0, 50), [availableAssigneeMembers, canAssignTaskOthers, deferredTaskPanelAssigneeQuery, taskAssigneeIds])

  function canManageTaskAssignee(targetUserId: string): boolean {
    if (isBoardArchived || !me) return false
    if (canAssignTaskOthers) return true
    if (canAssignTaskSelf && String(me.userId) === targetUserId) return true
    return false
  }

  const filteredAssigneeMembers = useMemo(() => availableAssigneeMembers.filter((member) => {
    if (taskDraftAssigneeIds.includes(member.userId)) return false
    if (!canAssignTaskOthers) return false

    const query = deferredTaskAssigneeQuery.trim().toLowerCase()
    if (!query) return true

    return [
      member.username,
      member.displayName,
      member.nickname ?? '',
      member.userId,
    ].some((value) => value.toLowerCase().includes(query))
  }).slice(0, 50), [availableAssigneeMembers, canAssignTaskOthers, deferredTaskAssigneeQuery, taskDraftAssigneeIds])

  useEffect(() => {
    latestSelectedTaskRef.current = selectedTask
  }, [selectedTask])

  useEffect(() => {
    latestMeRef.current = me
  }, [me])

  // Close panel when clicking anywhere outside it or a task card
  useEffect(() => {
    if (!selectedTask) return
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Element
      if (
        target.closest('.kc-task-panel') ||
        target.closest('[data-task-id]') ||
        target.closest('.kc-modal-overlay')
      ) return
      setSelectedTask(null)
      setTaskPanelDraft(EMPTY_TASK_DRAFT)
      setTaskPanelError('')
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [selectedTask])

  useEffect(() => {
    if (!me || (!canAssignInTaskModal && !selectedTask)) {
      setServerMembers([])
      return
    }

    const currentMe = me
    const token = getStoredToken()
    if (!token) return

    const loadKey = `${serverId}:${String(currentMe.userId)}`
    if (serverMembersLoadKeyRef.current === loadKey) return
    serverMembersLoadKeyRef.current = loadKey

    let cancelled = false

    async function loadMembersAndProfiles() {
      try {
        const members = await fetchServerMembers(token, serverId, String(currentMe.userId))
        if (cancelled) return
        setServerMembers(members)
      } catch {
        if (cancelled) return
        setServerMembers([])
      }
    }

    void loadMembersAndProfiles()

    return () => {
      cancelled = true
    }
  }, [me, canAssignInTaskModal, serverId, Boolean(selectedTask)])

  useEffect(() => {
    if (!selectedTask || !me) {
      setTaskComments([])
      setTaskCommentsState('idle')
      setTaskCommentsError('')
      return
    }

    const currentTask = selectedTask
    const currentUser = me

    const token = getStoredToken()
    if (!token) return

    let cancelled = false

    async function loadTaskComments() {
      setTaskCommentsState('loading')
      setTaskCommentsError('')
      try {
        const comments = await fetchTaskCommentsForTask(token, currentUser, currentTask)
        if (cancelled) return
        setTaskComments(comments)
        setTaskCommentsState('ready')
      } catch (err) {
        if (cancelled) return
        setTaskComments([])
        setTaskCommentsState('error')
        setTaskCommentsError(`Failed to load comments: ${err}`)
      }
    }

    void loadTaskComments()

    return () => {
      cancelled = true
    }
  }, [selectedTask, me, serverId, boardId])

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    const id = nextToastId
    setNextToastId(id + 1)
    setToasts((prev) => [...prev, { id, text, type }])
    const delay = type === 'success' ? 3000 : 5000
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, delay)
  }

  useEffect(() => {
    const token = getStoredToken()
    if (!token || !boardId || !serverId) {
      setError('Missing board context. Please open a board from the dashboard.')
      setState('error')
      return
    }

    let cancelled = false

    async function loadBoardPage() {
      setState('loading')
      setError('')
      try {
        const meResponse = await fetchMe(token)
        setMe(meResponse)
        const snapshot = await fetchBoardSnapshot(token, String(meResponse.userId))

        if (cancelled) return
        applyBoardSnapshot(snapshot)
        setState('ready')
      } catch (err) {
        if (cancelled) return
        setError(`Failed to load board: ${err}`)
        setState('error')
      }
    }

    void loadBoardPage()

    return () => {
      cancelled = true
    }
  }, [boardId, serverId])

  useEffect(() => {
    const token = getStoredToken()
    if (!token || !boardId || !serverId || !me) return

    const disconnect = connectRealtimeChannel({
      token,
      destination: boardTopic(serverId, boardId),
      onEvent: (event) => {
        scheduleRealtimeBoardRefresh(event)
      },
      onError: (value) => {
        console.error('Board realtime error:', value)
      },
    })

    return () => {
      if (boardRealtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(boardRealtimeRefreshTimerRef.current)
        boardRealtimeRefreshTimerRef.current = null
      }
      disconnect()
    }
  }, [boardId, serverId, me])

  async function fetchBoardSnapshot(token: string, userId: string) {
    const [boardData, columnData, taskData, taskAssignmentData, permissionMap] = await Promise.all([
      fetchBoardById(token, serverId, userId, boardId),
      fetchBoardColumns(token, serverId, boardId, userId),
      fetchBoardTasks(token, serverId, boardId, userId),
      fetchBoardTaskAssignments(token, serverId, boardId, userId),
      evaluatePermissions(token, serverId, userId, BOARD_PERMISSION_KEYS, boardId),
    ])

    return {
      boardData,
      columnData,
      taskData,
      taskAssignmentData,
      permissionMap,
    }
  }

  function applyBoardSnapshot(snapshot: Awaited<ReturnType<typeof fetchBoardSnapshot>>) {
    setBoard(snapshot.boardData)
    setColumns(snapshot.columnData)
    setTasksByColumn(groupTasksByColumn(snapshot.taskData))
    setTaskAssignments(snapshot.taskAssignmentData)
    setCanEditColumn(Boolean(snapshot.permissionMap.EDIT_COLUMN?.allowed) && !snapshot.boardData.isArchived)
    setCanCreateColumn(Boolean(snapshot.permissionMap.CREATE_COLUMN?.allowed) && !snapshot.boardData.isArchived)
    setCanDeleteColumn(Boolean(snapshot.permissionMap.DELETE_COLUMN?.allowed) && !snapshot.boardData.isArchived)
    setCanMoveColumn(Boolean(snapshot.permissionMap.MOVE_COLUMN?.allowed) && !snapshot.boardData.isArchived)
    setCanCreateTask(Boolean(snapshot.permissionMap.CREATE_TASK?.allowed) && !snapshot.boardData.isArchived)
    setCanEditTask(Boolean(snapshot.permissionMap.EDIT_TASK?.allowed) && !snapshot.boardData.isArchived)
    setCanDeleteTask(Boolean(snapshot.permissionMap.DELETE_TASK?.allowed) && !snapshot.boardData.isArchived)
    setCanMoveTask(Boolean(snapshot.permissionMap.MOVE_TASK?.allowed) && !snapshot.boardData.isArchived)
    setCanAssignTaskSelf(Boolean(snapshot.permissionMap.ASSIGN_TASK_SELF?.allowed) && !snapshot.boardData.isArchived)
    setCanAssignTaskOthers(Boolean(snapshot.permissionMap.ASSIGN_TASK_OTHERS?.allowed) && !snapshot.boardData.isArchived)
    setCanCreateTaskComment(Boolean(snapshot.permissionMap.CREATE_TASK_COMMENT?.allowed) && !snapshot.boardData.isArchived)
    setCanEditTaskComment(Boolean(snapshot.permissionMap.EDIT_TASK_COMMENT?.allowed) && !snapshot.boardData.isArchived)
    setCanDeleteTaskComment(Boolean(snapshot.permissionMap.DELETE_TASK_COMMENT?.allowed) && !snapshot.boardData.isArchived)
    setSelectedTask((current) => {
      if (!current) return current
      return snapshot.taskData.find((entry) => entry.taskId === current.taskId) ?? null
    })
  }

  async function refreshBoardSnapshot(token: string, currentUser: ActiveHeaderUser) {
    try {
      const snapshot = await fetchBoardSnapshot(token, String(currentUser.userId))
      applyBoardSnapshot(snapshot)
      setState('ready')
    } catch (err) {
      console.error('Failed to refresh board snapshot:', err)
    }
  }

  async function fetchTaskCommentsForTask(
    token: string,
    currentUser: ActiveHeaderUser,
    currentTask: TaskEntry,
  ): Promise<TaskCommentEntry[]> {
    const comments = await fetchTaskComments(
      token,
      serverId,
      boardId,
      currentTask.taskId,
      String(currentUser.userId),
    )

    return sortCommentsByCreatedAt(comments)
  }

  function scheduleRealtimeBoardRefresh(event: RealtimeEvent) {
    const token = getStoredToken()
    const currentUser = latestMeRef.current
    if (!token || !currentUser) return

    if (boardRealtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(boardRealtimeRefreshTimerRef.current)
    }

    boardRealtimeRefreshTimerRef.current = window.setTimeout(() => {
      boardRealtimeRefreshTimerRef.current = null
      void refreshBoardSnapshot(token, currentUser)

      if (event.entityType === 'TASK_COMMENT' && latestSelectedTaskRef.current) {
        const task = latestSelectedTaskRef.current
        void fetchTaskCommentsForTask(token, currentUser, task)
          .then((comments) => {
            if (latestSelectedTaskRef.current?.taskId !== task.taskId) return
            setTaskComments(comments)
            setTaskCommentsState('ready')
            setTaskCommentsError('')
          })
          .catch((err) => {
            console.error('Failed to refresh task comments:', err)
          })
      }
    }, 150)
  }

  async function saveColumnName(column: BoardColumnEntry) {
    const trimmed = editingColumnName.trim()
    setEditingColumnId(null)
    if (!trimmed || trimmed === column.name || !me) return

    const token = getStoredToken()
    if (!token) return

    const previousColumns = columns
    setColumns((current) =>
      current.map((entry) =>
        entry.columnId === column.columnId
          ? {
              ...entry,
              name: trimmed,
            }
          : entry,
      ),
    )

    try {
      const updated = await updateColumn(
        token,
        serverId,
        boardId,
        column.columnId,
        trimmed,
        String(me.userId),
        {
          position: column.position,
          color: column.color,
          wipLimit: column.wipLimit,
        },
      )
      setColumns((current) =>
        current.map((entry) => (entry.columnId === updated.columnId ? updated : entry)),
      )
      showToast('Column updated', 'success')
    } catch {
      setColumns(previousColumns)
      showToast('Failed to update column', 'error')
    }
  }

  async function handleAddColumn() {
    const trimmed = newColumnName.trim()
    setAddingColumn(false)
    setNewColumnName('')
    if (!trimmed || !me) return
    const token = getStoredToken()
    if (!token) return
    const optimisticId = -Date.now()
    const optimisticColumn: BoardColumnEntry = {
      columnId: optimisticId,
      name: trimmed,
      boardId: Number(boardId),
      position: columns.length + 1,
      color: null,
      wipLimit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setColumns((cols) => [...cols, optimisticColumn])
    try {
      const created = await createColumn(token, serverId, boardId, trimmed, String(me.userId))
      setColumns((cols) => cols.map((c) => (c.columnId === optimisticId ? created : c)))
      showToast('Column created', 'success')
    } catch {
      setColumns((cols) => cols.filter((c) => c.columnId !== optimisticId))
      showToast('Failed to create column', 'error')
    }
  }

  async function handleDeleteColumn() {
    if (!deleteTargetColumn || !me) return
    const token = getStoredToken()
    if (!token) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteColumn(
        token,
        serverId,
        boardId,
        deleteTargetColumn.columnId,
        String(me.userId),
      )
      setColumns((cols) => cols.filter((c) => c.columnId !== deleteTargetColumn.columnId))
      setTasksByColumn((prev) => {
        const next = { ...prev }
        delete next[deleteTargetColumn.columnId]
        return next
      })
      setDeleteTargetColumn(null)
    } catch (err) {
      setDeleteError(String(err))
    } finally {
      setDeleting(false)
    }
  }

  async function persistColumnOrder(
    nextColumns: BoardColumnEntry[],
    previousColumns: BoardColumnEntry[],
  ) {
    if (!me) {
      setColumns(previousColumns)
      return
    }

    const token = getStoredToken()
    if (!token) {
      setColumns(previousColumns)
      return
    }

    setMovingColumns(true)
    try {
      const updatedColumns = await Promise.all(
        nextColumns.map((column, index) =>
          updateColumn(token, serverId, boardId, column.columnId, column.name, String(me.userId), {
            position: index + 1,
            color: column.color,
            wipLimit: column.wipLimit,
          }),
        ),
      )

      setColumns(
        [...updatedColumns].sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0)),
      )
      showToast('Columns reordered', 'success')
    } catch {
      setColumns(previousColumns)
      showToast('Failed to reorder columns', 'error')
    } finally {
      setMovingColumns(false)
    }
  }

  function cleanupColumnDragImage() {
    if (columnDragImageRef.current) {
      columnDragImageRef.current.remove()
      columnDragImageRef.current = null
    }
  }

  function getTransparentDragImage(): HTMLImageElement {
    if (!transparentDragImageRef.current) {
      const image = new Image()
      image.src =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
      transparentDragImageRef.current = image
    }
    return transparentDragImageRef.current
  }

  function updateColumnDragImagePosition(clientX: number, clientY: number) {
    if (!columnDragImageRef.current) return

    columnDragImageRef.current.style.left = `${clientX - columnDragOffsetRef.current.x}px`
    columnDragImageRef.current.style.top = `${clientY - columnDragOffsetRef.current.y}px`
  }

  function cleanupTaskDragImage() {
    if (taskDragImageRef.current) {
      taskDragImageRef.current.remove()
      taskDragImageRef.current = null
    }
  }

  function updateTaskDragImagePosition(clientX: number, clientY: number) {
    if (!taskDragImageRef.current) return

    taskDragImageRef.current.style.left = `${clientX - taskDragOffsetRef.current.x}px`
    taskDragImageRef.current.style.top = `${clientY - taskDragOffsetRef.current.y}px`
  }

  function handleColumnDragStart(event: DragEvent<HTMLElement>, columnId: number) {
    if (isColumnDragExcludedTarget(event.target)) {
      event.preventDefault()
      clearColumnDragState()
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(columnId))

    const transparentImage = getTransparentDragImage()
    event.dataTransfer.setDragImage(transparentImage, 0, 0)

    const source = event.currentTarget
    const rect = source.getBoundingClientRect()
    const clone = source.cloneNode(true) as HTMLElement
    clone.style.position = 'fixed'
    clone.style.top = '0'
    clone.style.left = '0'
    clone.style.width = `${rect.width}px`
    clone.style.minWidth = `${rect.width}px`
    clone.style.maxWidth = `${rect.width}px`
    clone.style.height = `${rect.height}px`
    clone.style.pointerEvents = 'none'
    clone.style.margin = '0'
    clone.style.opacity = '0.5'
    clone.style.boxSizing = 'border-box'
    clone.style.border = '1px solid rgba(148, 163, 184, 0.18)'
    clone.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.35)'
    clone.style.zIndex = '2000'

    cleanupColumnDragImage()
    document.body.appendChild(clone)
    columnDragImageRef.current = clone

    const offsetX = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
    const offsetY = Math.max(0, Math.min(event.clientY - rect.top, rect.height))
    columnDragOffsetRef.current = { x: offsetX, y: offsetY }
    updateColumnDragImagePosition(event.clientX, event.clientY)

    setDraggedColumnId(columnId)
    setColumnDropIndex(Math.max(0, columns.findIndex((entry) => entry.columnId === columnId)))
    setOpenMenuColumnId(null)
    setEditingColumnId(null)
    setSuppressEditUntil(Date.now() + 250)
  }

  async function handleColumnDrop(dropIndex: number) {
    if (!canMoveColumnsOnPage || !draggedColumnId || movingColumns) return

    const previousColumns = columns
    const nextColumns = reorderColumnsByIndex(previousColumns, draggedColumnId, dropIndex)

    setDraggedColumnId(null)
    setColumnDropIndex(null)
    cleanupColumnDragImage()

    const changed = nextColumns.some(
      (column, index) => column.columnId !== previousColumns[index]?.columnId,
    )

    if (!changed) return

    setColumns(nextColumns)
    await persistColumnOrder(nextColumns, previousColumns)
  }

  function handleBoardRowDragOver(event: DragEvent<HTMLElement>) {
    if (draggedColumnId !== null) {
      updateColumnDragImagePosition(event.clientX, event.clientY)
    }
    if (draggedTaskId !== null) {
      updateTaskDragImagePosition(event.clientX, event.clientY)
    }

    if (canMoveTasksOnPage && draggedTaskId !== null) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'

      const target = resolveTaskDropTargetFromBoard(
        event.currentTarget,
        columns,
        tasksByColumn,
        draggedTaskId,
        event.clientX,
        event.clientY,
      )

      if (!target) {
        setTaskDropColumnId(null)
        setTaskDropIndex(null)
        return
      }

      setTaskDropColumnId(target.columnId)
      setTaskDropIndex(target.dropIndex)
      return
    }

    if (!canMoveColumnsOnPage || !draggedColumnId) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    const nextDropIndex = resolveColumnDropIndex(
      event.currentTarget,
      columns,
      draggedColumnId,
      event.clientX,
    )
    setColumnDropIndex(nextDropIndex)
  }

  async function handleBoardRowDrop(event: DragEvent<HTMLElement>) {
    if (canMoveTasksOnPage && draggedTaskId !== null && !movingTasks) {
      event.preventDefault()

      const target = resolveTaskDropTargetFromBoard(
        event.currentTarget,
        columns,
        tasksByColumn,
        draggedTaskId,
        event.clientX,
        event.clientY,
      )

      if (!target) {
        clearTaskDragState()
        return
      }

      const previousTaskGroups = tasksByColumn
      const draggedTask = Object.values(previousTaskGroups)
        .flat()
        .find((task) => task.taskId === draggedTaskId)
      if (!draggedTask) {
        clearTaskDragState()
        return
      }

      const nextTaskGroups = moveTaskLocally(
        previousTaskGroups,
        draggedTaskId,
        target.columnId,
        target.dropIndex,
      )

      clearTaskDragState()

      const sourceColumnId = draggedTask.columnId
      const changed = JSON.stringify(nextTaskGroups[sourceColumnId] ?? []) !== JSON.stringify(previousTaskGroups[sourceColumnId] ?? [])
        || JSON.stringify(nextTaskGroups[target.columnId] ?? []) !== JSON.stringify(previousTaskGroups[target.columnId] ?? [])

      if (!changed) return

      setTasksByColumn(nextTaskGroups)
      const affectedColumnIds = Array.from(new Set([sourceColumnId, target.columnId]))
      await persistTaskMove(nextTaskGroups, previousTaskGroups, affectedColumnIds)
      return
    }

    if (!canMoveColumnsOnPage || !draggedColumnId) return

    event.preventDefault()

    const nextDropIndex = resolveColumnDropIndex(
      event.currentTarget,
      columns,
      draggedColumnId,
      event.clientX,
    )

    await handleColumnDrop(nextDropIndex)
  }

  function clearColumnDragState() {
    setDraggedColumnId(null)
    setColumnDropIndex(null)
    setSuppressEditUntil(Date.now() + 250)
    cleanupColumnDragImage()
  }

  function openTaskPanel(task: TaskEntry) {
    setSelectedTask(task)
    setTaskPanelDraft({
      title: task.title ?? '',
      description: task.description ?? '',
      priority: task.priority ?? '',
      dueDate: task.dueDate ? task.dueDate.slice(0, 16) : '',
    })
    setTaskPanelError('')
    setTaskPanelAssigneeQuery('')
    setEditingDescription(false)
    setTaskPanelExpanded(false)
  }

  function closeTaskPanel() {
    setSelectedTask(null)
    setTaskPanelDraft(EMPTY_TASK_DRAFT)
    setTaskPanelError('')
    setTaskComments([])
    setTaskCommentsState('idle')
    setTaskCommentsError('')
    setShowCommentComposer(false)
    setTaskCommentDraft(EMPTY_TASK_COMMENT_DRAFT)
    setEditingCommentId(null)
    setEditingCommentContent('')
    setOpenCommentMenuId(null)
    setDeleteTargetComment(null)
    setDeleteCommentError('')
    setTaskPanelAssigneeQuery('')
    setEditingDescription(false)
    setTaskPanelExpanded(false)
  }

  function canEditComment(_comment: TaskCommentEntry): boolean {
    return canEditTaskComment
  }

  function canDeleteComment(_comment: TaskCommentEntry): boolean {
    return canDeleteTaskComment
  }

  function getCommentEditLabel(comment: TaskCommentEntry): string {
    const created = comment.createdAt ? new Date(comment.createdAt).getTime() : 0
    const updated = comment.updatedAt ? new Date(comment.updatedAt).getTime() : 0
    if (!updated || updated <= created) return ''

    const uniqueEditors = Array.from(
      new Map((comment.editedByUsers ?? []).map((editor) => [editor.userId, editor])).values(),
    )
    const nonAuthorEditors = uniqueEditors.filter((editor) => editor.userId !== comment.userId)

    if (nonAuthorEditors.length === 0) {
      return '(edited)'
    }

    const labelEditors = uniqueEditors.length > 0 ? uniqueEditors : nonAuthorEditors
    return `(edited by: ${labelEditors.map(resolveEditorLabel).join(', ')})`
  }

  function createMarkdownComponents(options: {
    editable: boolean
    onToggle?: (itemIndex: number, checked: boolean) => void
  }) {
    return {
      input: (props: ComponentPropsWithoutRef<'input'>) => {
        if (props.type !== 'checkbox') {
          return <input {...props} />
        }

        return (
          <input
            {...props}
            type="checkbox"
            disabled={!options.editable}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation()
              const target = event.currentTarget
              const markdownRoot = target.closest('.kc-markdown')
              const taskListCheckboxes = markdownRoot
                ? Array.from(markdownRoot.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
                : []
              const domItemIndex = taskListCheckboxes.indexOf(target)
              if (domItemIndex < 0) return
              options.onToggle?.(domItemIndex, event.currentTarget.checked)
            }}
          />
        )
      },
    }
  }

  async function handleToggleTaskDescriptionChecklist(itemIndex: number, checked: boolean) {
    if (!selectedTask || !me || !canEditTask || isBoardArchived) return
    if (togglingTaskChecklist) return
    const token = getStoredToken()
    if (!token) return

    const previousDescription = taskPanelDraft.description ?? ''
    const nextDescription = toggleTaskListItemByIndex(previousDescription, itemIndex, checked)
    if (nextDescription === previousDescription) return

    setTaskPanelDraft((prev) => ({ ...prev, description: nextDescription }))
    setTaskPanelError('')
    setTogglingTaskChecklist(true)
    setSavingTask(true)

    try {
      const updated = await updateTask(
        token,
        serverId,
        boardId,
        selectedTask.taskId,
        String(me.userId),
        {
          title: taskPanelDraft.title.trim() || selectedTask.title,
          description: nextDescription.trim() || null,
          columnId: selectedTask.columnId,
          position: selectedTask.position,
          priority: taskPanelDraft.priority.trim() || null,
          dueDate: taskPanelDraft.dueDate || null,
        },
      )

      setTasksByColumn((prev) => ({
        ...prev,
        [updated.columnId]: sortTasks(
          (prev[updated.columnId] ?? []).map((t) =>
            t.taskId === updated.taskId ? updated : t,
          ),
        ),
      }))
      setSelectedTask(updated)
      setTaskPanelDraft((prev) => ({
        ...prev,
        description: updated.description ?? '',
      }))
    } catch (err) {
      setTaskPanelDraft((prev) => ({ ...prev, description: previousDescription }))
      setTaskPanelError(String(err))
    } finally {
      setSavingTask(false)
      setTogglingTaskChecklist(false)
    }
  }

  async function handleToggleCommentChecklist(commentId: number, itemIndex: number, checked: boolean) {
    if (!selectedTask || !me || !canEditTaskComment || isBoardArchived) return
    if (togglingCommentChecklistIds.has(commentId)) return
    const token = getStoredToken()
    if (!token) return

    const targetComment = taskComments.find((comment) => comment.commentId === commentId)
    if (!targetComment) return

    const previousContent = targetComment.content ?? ''
    const nextContent = toggleTaskListItemByIndex(previousContent, itemIndex, checked)
    if (nextContent === previousContent) return

    setTaskComments((prev) =>
      prev.map((comment) =>
        comment.commentId === commentId
          ? { ...comment, content: nextContent }
          : comment,
      ),
    )
    setTaskCommentsError('')
    setTogglingCommentChecklistIds((prev) => {
      const next = new Set(prev)
      next.add(commentId)
      return next
    })

    try {
      const updated = await updateTaskComment(
        token,
        serverId,
        boardId,
        selectedTask.taskId,
        commentId,
        String(me.userId),
        nextContent,
      )
      setTaskComments((prev) =>
        sortCommentsByCreatedAt(
          prev.map((comment) =>
            comment.commentId === commentId ? updated : comment,
          ),
        ),
      )
    } catch (err) {
      setTaskComments((prev) =>
        prev.map((comment) =>
          comment.commentId === commentId
            ? { ...comment, content: previousContent }
            : comment,
        ),
      )
      setTaskCommentsError(String(err))
    } finally {
      setTogglingCommentChecklistIds((prev) => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
    }
  }

  async function handleCreateComment() {
    if (!selectedTask || !me) return
    const content = taskCommentDraft.content.trim()
    if (!content) return
    const token = getStoredToken()
    if (!token) return

    setCreatingComment(true)
    setTaskCommentsError('')
    try {
      const created = await createTaskComment(
        token,
        serverId,
        boardId,
        selectedTask.taskId,
        String(me.userId),
        content,
      )
      setTaskComments((prev) =>
        sortCommentsByCreatedAt([...prev, created]),
      )
      setTaskCommentDraft(EMPTY_TASK_COMMENT_DRAFT)
      setShowCommentComposer(false)
    } catch (err) {
      setTaskCommentsError(String(err))
    } finally {
      setCreatingComment(false)
    }
  }

  async function handleSaveEditedComment() {
    if (!selectedTask || !me || editingCommentId === null) return
    const content = editingCommentContent.trim()
    if (!content) return
    const token = getStoredToken()
    if (!token) return

    setSavingComment(true)
    setTaskCommentsError('')
    try {
      const updated = await updateTaskComment(
        token,
        serverId,
        boardId,
        selectedTask.taskId,
        editingCommentId,
        String(me.userId),
        content,
      )
      setTaskComments((prev) =>
        sortCommentsByCreatedAt(
          prev.map((comment) =>
            comment.commentId === editingCommentId ? updated : comment,
          ),
        ),
      )
      setEditingCommentId(null)
      setEditingCommentContent('')
      setOpenCommentMenuId(null)
    } catch (err) {
      setTaskCommentsError(String(err))
    } finally {
      setSavingComment(false)
    }
  }

  async function handleDeleteComment() {
    if (!selectedTask || !deleteTargetComment || !me) return
    const token = getStoredToken()
    if (!token) return

    setDeletingComment(true)
    setDeleteCommentError('')
    try {
      await deleteTaskComment(
        token,
        serverId,
        boardId,
        selectedTask.taskId,
        deleteTargetComment.commentId,
        String(me.userId),
      )
      setTaskComments((prev) =>
        prev.filter((comment) => comment.commentId !== deleteTargetComment.commentId),
      )
      setDeleteTargetComment(null)
      setOpenCommentMenuId(null)
    } catch (err) {
      setDeleteCommentError(String(err))
    } finally {
      setDeletingComment(false)
    }
  }

  async function handleAddTaskAssignee(targetUserId: string) {
    if (!selectedTask || !me || !canManageTaskAssignee(targetUserId)) return
    if (
      taskAssignments.some(
        (assignment) =>
          assignment.taskId === selectedTask.taskId && String(assignment.userId) === targetUserId,
      )
    ) {
      return
    }

    const token = getStoredToken()
    if (!token) return

    try {
      const created = await createTaskAssignment(
        token,
        serverId,
        boardId,
        selectedTask.taskId,
        String(me.userId),
        targetUserId,
      )
      setTaskAssignments((prev) => [...prev, created])
    } catch (err) {
      setTaskPanelError(String(err))
    }
  }

  async function handleRemoveTaskAssignee(targetUserId: string) {
    if (!selectedTask || !me || !canManageTaskAssignee(targetUserId)) return

    const targetAssignment = taskAssignments.find(
      (assignment) =>
        assignment.taskId === selectedTask.taskId && String(assignment.userId) === targetUserId,
    )
    if (!targetAssignment) return

    const token = getStoredToken()
    if (!token) return

    try {
      await deleteTaskAssignment(
        token,
        serverId,
        boardId,
        selectedTask.taskId,
        targetAssignment.id,
        String(me.userId),
      )
      setTaskAssignments((prev) => prev.filter((assignment) => assignment.id !== targetAssignment.id))
    } catch (err) {
      setTaskPanelError(String(err))
    }
  }

  async function handleSaveTask() {
    if (!selectedTask || !me) return
    const title = taskPanelDraft.title.trim()
    if (!title) {
      setTaskPanelError('Task title is required.')
      return
    }
    const token = getStoredToken()
    if (!token) return
    setSavingTask(true)
    setTaskPanelError('')
    try {
      const updated = await updateTask(
        token,
        serverId,
        boardId,
        selectedTask.taskId,
        String(me.userId),
        {
          title,
          description: taskPanelDraft.description.trim() || null,
          columnId: selectedTask.columnId,
          position: selectedTask.position,
          priority: taskPanelDraft.priority.trim() || null,
          dueDate: taskPanelDraft.dueDate || null,
        },
      )
      setTasksByColumn((prev) => ({
        ...prev,
        [updated.columnId]: sortTasks(
          (prev[updated.columnId] ?? []).map((t) =>
            t.taskId === updated.taskId ? updated : t,
          ),
        ),
      }))
      setSelectedTask(updated)
      showToast('Task updated', 'success')
    } catch (err) {
      setTaskPanelError(String(err))
    } finally {
      setSavingTask(false)
    }
  }

  async function handleDeleteTask() {
    if (!deleteTargetTask || !me) return
    const token = getStoredToken()
    if (!token) return
    setDeletingTask(true)
    setDeleteTaskError('')
    try {
      await deleteTask(token, serverId, boardId, deleteTargetTask.taskId, String(me.userId))
      setTasksByColumn((prev) => ({
        ...prev,
        [deleteTargetTask.columnId]: (prev[deleteTargetTask.columnId] ?? []).filter(
          (t) => t.taskId !== deleteTargetTask.taskId,
        ),
      }))
      setDeleteTargetTask(null)
      closeTaskPanel()
      showToast('Task deleted', 'success')
    } catch (err) {
      setDeleteTaskError(String(err))
    } finally {
      setDeletingTask(false)
    }
  }

  function openCreateTaskModal(column: BoardColumnEntry) {
    if (!canCreateTasksOnPage) return
    setTaskModalColumn(column)
    setTaskDraft({ ...EMPTY_TASK_DRAFT })
    if (canAssignTaskSelf && !canAssignTaskOthers && me) {
      setTaskDraftAssigneeIds([String(me.userId)])
    } else {
      setTaskDraftAssigneeIds([])
    }
    setTaskAssigneeQuery('')
    setTaskModalError('')
  }

  function closeCreateTaskModal() {
    setTaskModalColumn(null)
    setTaskDraft({ ...EMPTY_TASK_DRAFT })
    setTaskDraftAssigneeIds([])
    setTaskAssigneeQuery('')
    setTaskModalError('')
  }

  function getColumnTasks(columnId: number): TaskEntry[] {
    return tasksByColumn[columnId] ?? []
  }

  function getNextTaskPosition(columnId: number): number {
    return getColumnTasks(columnId).reduce(
      (maxPosition, task) => Math.max(maxPosition, Number(task.position ?? 0)),
      0,
    ) + 1
  }

  async function handleCreateTask() {
    if (!taskModalColumn || !me) return

    const title = taskDraft.title.trim()
    if (!title) {
      setTaskModalError('Task title is required.')
      return
    }

    const token = getStoredToken()
    if (!token) return

    const columnId = taskModalColumn.columnId
    const nextPosition = getNextTaskPosition(columnId)
    const optimisticTaskId = -Date.now()
    const now = new Date().toISOString()
    const optimisticTask: TaskEntry = {
      taskId: optimisticTaskId,
      boardId: Number(boardId),
      columnId,
      title,
      description: taskDraft.description.trim() || null,
      position: nextPosition,
      priority: taskDraft.priority.trim() || null,
      dueDate: taskDraft.dueDate || null,
      isArchived: false,
      metadata: null,
      createdBy: me.userId,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }

    setCreatingTask(true)
    setTaskModalError('')
    setTasksByColumn((prev) => ({
      ...prev,
      [columnId]: sortTasks([...(prev[columnId] ?? []), optimisticTask]),
    }))

    try {
      const created = await createTask(token, serverId, boardId, String(me.userId), {
        title,
        description: taskDraft.description.trim() || null,
        columnId,
        position: nextPosition,
        priority: taskDraft.priority.trim() || null,
        dueDate: taskDraft.dueDate || null,
      })

      if (canAssignInTaskModal && taskDraftAssigneeIds.length > 0) {
        try {
          await Promise.all(
            taskDraftAssigneeIds.map((assigneeUserId) =>
              createTaskAssignment(
                token,
                serverId,
                boardId,
                created.taskId,
                String(me.userId),
                assigneeUserId,
              ),
            ),
          )
        } catch {
          showToast('Task created, but assigning members failed', 'error')
        }
      }

      setTasksByColumn((prev) => ({
        ...prev,
        [columnId]: sortTasks(
          (prev[columnId] ?? []).map((task) =>
            task.taskId === optimisticTaskId ? created : task,
          ),
        ),
      }))
      closeCreateTaskModal()
      showToast('Task created', 'success')
    } catch (err) {
      setTasksByColumn((prev) => ({
        ...prev,
        [columnId]: (prev[columnId] ?? []).filter((task) => task.taskId !== optimisticTaskId),
      }))
      setTaskModalError(String(err))
      showToast('Failed to create task', 'error')
    } finally {
      setCreatingTask(false)
    }
  }

  function clearTaskDragState() {
    setDraggedTaskId(null)
    setTaskDropColumnId(null)
    setTaskDropIndex(null)
    setDraggedTaskHeight(null)
    cleanupTaskDragImage()
  }

  function handleTaskDragStart(event: DragEvent<HTMLElement>, taskId: number) {
    if (!canMoveTasksOnPage) {
      event.preventDefault()
      clearTaskDragState()
      return
    }

    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(taskId))

    const transparentImage = getTransparentDragImage()
    event.dataTransfer.setDragImage(transparentImage, 0, 0)

    const source = event.currentTarget
    const rect = source.getBoundingClientRect()
    const clone = source.cloneNode(true) as HTMLElement
    clone.style.position = 'fixed'
    clone.style.top = '0'
    clone.style.left = '0'
    clone.style.width = `${rect.width}px`
    clone.style.minWidth = `${rect.width}px`
    clone.style.maxWidth = `${rect.width}px`
    clone.style.height = `${rect.height}px`
    clone.style.pointerEvents = 'none'
    clone.style.margin = '0'
    clone.style.opacity = '0.5'
    clone.style.boxSizing = 'border-box'
    clone.style.border = '1px solid rgba(148, 163, 184, 0.18)'
    clone.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.35)'
    clone.style.zIndex = '2000'

    cleanupTaskDragImage()
    document.body.appendChild(clone)
    taskDragImageRef.current = clone

    const offsetX = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
    const offsetY = Math.max(0, Math.min(event.clientY - rect.top, rect.height))
    taskDragOffsetRef.current = { x: offsetX, y: offsetY }
    updateTaskDragImagePosition(event.clientX, event.clientY)

    const sourceColumnId = Object.entries(tasksByColumn).find(([, entries]) =>
      entries.some((entry) => entry.taskId === taskId),
    )
    if (sourceColumnId) {
      const columnId = Number(sourceColumnId[0])
      const sourceIndex = (tasksByColumn[columnId] ?? []).findIndex((entry) => entry.taskId === taskId)
      setTaskDropColumnId(columnId)
      setTaskDropIndex(Math.max(0, sourceIndex))
    }

    setDraggedTaskHeight(rect.height)
    setDraggedTaskId(taskId)
    setSuppressEditUntil(Date.now() + 250)
  }

  function handleTaskDragOver(event: DragEvent<HTMLElement>, columnId: number) {
    if (!canMoveTasksOnPage || !draggedTaskId) return

    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    updateTaskDragImagePosition(event.clientX, event.clientY)

    const dropIndex = resolveTaskDropIndex(
      event.currentTarget,
      getColumnTasks(columnId),
      draggedTaskId,
      event.clientY,
    )

    setTaskDropColumnId(columnId)
    setTaskDropIndex(dropIndex)
  }

  async function persistTaskMove(
    nextTaskGroups: Record<number, TaskEntry[]>,
    previousTaskGroups: Record<number, TaskEntry[]>,
    affectedColumnIds: number[],
  ) {
    if (!me) {
      setTasksByColumn(previousTaskGroups)
      return
    }

    const token = getStoredToken()
    if (!token) {
      setTasksByColumn(previousTaskGroups)
      return
    }

    setMovingTasks(true)
    try {
      const updatedTasks = await Promise.all(
        affectedColumnIds.flatMap((columnId) =>
          (nextTaskGroups[columnId] ?? []).map((task, index) =>
            updateTask(token, serverId, boardId, task.taskId, String(me.userId), {
              title: task.title,
              description: task.description,
              columnId,
              position: index + 1,
              priority: task.priority,
              dueDate: task.dueDate,
            }),
          ),
        ),
      )

      const mergedGroups = { ...nextTaskGroups }
      for (const columnId of affectedColumnIds) {
        mergedGroups[columnId] = sortTasks(
          updatedTasks.filter((task) => task.columnId === columnId),
        )
      }
      setTasksByColumn(mergedGroups)
      showToast('Tasks reordered', 'success')
    } catch {
      setTasksByColumn(previousTaskGroups)
      showToast('Failed to reorder tasks', 'error')
    } finally {
      setMovingTasks(false)
    }
  }

  async function handleTaskDrop(event: DragEvent<HTMLElement>, columnId: number) {
    if (!canMoveTasksOnPage || !draggedTaskId || movingTasks) return

    event.preventDefault()
    event.stopPropagation()

    const previousTaskGroups = tasksByColumn
    const draggedTask = Object.values(previousTaskGroups)
      .flat()
      .find((task) => task.taskId === draggedTaskId)
    if (!draggedTask) {
      clearTaskDragState()
      return
    }

    const dropIndex = resolveTaskDropIndex(
      event.currentTarget,
      getColumnTasks(columnId),
      draggedTaskId,
      event.clientY,
    )

    const nextTaskGroups = moveTaskLocally(
      previousTaskGroups,
      draggedTaskId,
      columnId,
      dropIndex,
    )

    clearTaskDragState()

    const sourceColumnId = draggedTask.columnId
    const changed = JSON.stringify(nextTaskGroups[sourceColumnId] ?? []) !== JSON.stringify(previousTaskGroups[sourceColumnId] ?? [])
      || JSON.stringify(nextTaskGroups[columnId] ?? []) !== JSON.stringify(previousTaskGroups[columnId] ?? [])

    if (!changed) return

    setTasksByColumn(nextTaskGroups)
    const affectedColumnIds = Array.from(new Set([sourceColumnId, columnId]))
    await persistTaskMove(nextTaskGroups, previousTaskGroups, affectedColumnIds)
  }

  const deleteTaskCount = deleteTargetColumn ? getColumnTasks(deleteTargetColumn.columnId).length : 0

  return (
    <>
      <div
        className="kc-dashboard-root"
        onDragOver={handleBoardRowDragOver}
        onDrop={(event) => {
          void handleBoardRowDrop(event)
        }}
      >
      <DashboardHeader
        isAuthenticated={Boolean(me)}
        me={me}
        loading={state === 'loading'}
        subtitle="Board"
        onBrandClick={() => {
          navigate('/')
        }}
        onLogout={() => {
          navigate('/')
        }}
        onLogin={() => {
          navigate('/')
        }}
      />

      <div className="kc-board-subbar" role="banner" aria-label="Board title bar">
        <h2>{board?.name ?? 'Board'}</h2>
        {isBoardArchived && <span className="kc-board-archived-badge">Archived</span>}
      </div>

      <main className="kc-content kc-board-page">
        {state === 'loading' && (
          <div className="kc-loading-state" aria-live="polite" aria-busy="true">
            <span className="kc-spinner" aria-hidden="true" />
            <span className="kc-muted">Loading board...</span>
          </div>
        )}

        {state === 'error' && <p className="kc-banner">{error}</p>}

        {state === 'ready' && isBoardArchived && (
          <p className="kc-banner kc-banner--success">
            This board is archived. All columns and tasks are view-only until the board is restored.
          </p>
        )}

        {state === 'ready' && board && (
          <section
            className="kc-board-page-columns"
            aria-label="Board columns"
          >
            {openMenuColumnId !== null && (
              <div
                className="kc-column-menu-backdrop"
                onClick={() => setOpenMenuColumnId(null)}
              />
            )}

            {columns.length === 0 && !canCreateColumnsOnPage && (
              <p className="kc-muted">No columns found on this board.</p>
            )}

            {(() => {
              const currentDraggedIndex =
                draggedColumnId !== null
                  ? columns.findIndex((entry) => entry.columnId === draggedColumnId)
                  : -1
              const previewDropIndex =
                draggedColumnId !== null
                  ? Math.max(
                      0,
                      Math.min(
                        columnDropIndex ?? Math.max(currentDraggedIndex, 0),
                        Math.max(columns.length - 1, 0),
                      ),
                    )
                  : 0
              const columnsForRender =
                draggedColumnId !== null && currentDraggedIndex >= 0
                  ? reorderColumnsByIndex(columns, draggedColumnId, previewDropIndex)
                  : columns

              return columnsForRender.map((column) => {
              const previewTaskGroups =
                draggedTaskId !== null && taskDropColumnId !== null && taskDropIndex !== null
                  ? moveTaskLocally(tasksByColumn, draggedTaskId, taskDropColumnId, taskDropIndex)
                  : null
              const columnTasks = previewTaskGroups
                ? previewTaskGroups[column.columnId] ?? []
                : getColumnTasks(column.columnId)
              const columnStyle = {
                '--kc-column-accent': column.color ?? '#60a5fa',
              } as CSSProperties
              const isTaskDropzoneActive = draggedTaskId !== null && taskDropColumnId === column.columnId
                const isColumnSkeleton = draggedColumnId !== null && draggedColumnId === column.columnId

              return (
                <article
                  key={column.columnId}
                  data-column-id={column.columnId}
                  style={columnStyle}
                  className={[
                    'kc-panel',
                    'kc-board-column-card',
                    canMoveColumnsOnPage ? 'kc-board-column-card--movable' : '',
                      isColumnSkeleton ? 'kc-board-column-card--drag-skeleton' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  draggable={canMoveColumnsOnPage && !movingColumns && editingColumnId !== column.columnId}
                  onDragStart={(event) => handleColumnDragStart(event, column.columnId)}
                  onDragEnd={clearColumnDragState}
                >
                <div className="kc-column-header">
                  {canEditColumnsOnPage && editingColumnId === column.columnId ? (
                    <input
                      data-no-column-drag="true"
                      className="kc-column-name-input"
                      value={editingColumnName}
                      autoFocus
                      onChange={(e) => setEditingColumnName(e.target.value)}
                      onBlur={() => void saveColumnName(column)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveColumnName(column)
                        if (e.key === 'Escape') setEditingColumnId(null)
                      }}
                    />
                  ) : (
                    <h3
                      className={canEditColumnsOnPage ? 'kc-column-name-editable' : undefined}
                      onClick={() => {
                        if (!canEditColumnsOnPage) return
                        if (Date.now() < suppressEditUntil) return
                        setEditingColumnId(column.columnId)
                        setEditingColumnName(column.name)
                      }}
                    >
                      {column.name}
                    </h3>
                  )}

                  {canDeleteColumnsOnPage && (
                    <div className="kc-column-menu-wrap" data-no-column-drag="true">
                      <button
                        className="kc-column-menu-btn"
                        aria-label="Column options"
                        aria-expanded={openMenuColumnId === column.columnId}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuColumnId((prev) =>
                            prev === column.columnId ? null : column.columnId,
                          )
                        }}
                      >
                        {'\u22EF'}
                      </button>
                      {openMenuColumnId === column.columnId && (
                        <ul className="kc-column-menu-dropdown" role="menu">
                          <li role="none">
                            <button
                              role="menuitem"
                              className="kc-column-menu-item kc-column-menu-item--danger"
                              onClick={() => {
                                setDeleteTargetColumn(column)
                                setOpenMenuColumnId(null)
                                setDeleteError('')
                              }}
                            >
                              Delete column
                            </button>
                          </li>
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="kc-column-content" data-no-column-drag="true">
                  <div
                    className={[
                      'kc-column-task-dropzone',
                      isTaskDropzoneActive ? 'kc-column-task-dropzone--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-no-column-drag="true"
                    onDragOver={(event) => handleTaskDragOver(event, column.columnId)}
                    onDrop={(event) => {
                      void handleTaskDrop(event, column.columnId)
                    }}
                  >
                  {columnTasks.length > 0 ? (
                    <ul className="kc-column-task-list">
                      {columnTasks.map((task) => {
                        const isTaskSkeleton = draggedTaskId !== null && draggedTaskId === task.taskId
                        const taskAssignees = taskAssigneesByTaskId[task.taskId] ?? []

                        return (
                        <li
                          key={task.taskId}
                          data-task-id={task.taskId}
                          style={isTaskSkeleton && draggedTaskHeight ? { height: `${draggedTaskHeight}px` } : undefined}
                          className={[
                            'kc-column-task-card',
                            canMoveTasksOnPage ? 'kc-column-task-card--movable' : '',
                            isTaskSkeleton ? 'kc-column-task-card--drag-skeleton' : '',
                            selectedTask?.taskId === task.taskId ? 'kc-column-task-card--selected' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          draggable={canMoveTasksOnPage && !movingTasks}
                          data-no-column-drag="true"
                          onDragStart={(event) => handleTaskDragStart(event, task.taskId)}
                          onDragEnd={(event) => {
                            event.stopPropagation()
                            clearTaskDragState()
                          }}
                          onClick={() => {
                            if (Date.now() < suppressEditUntil) return
                            if (isTaskSkeleton) return
                            openTaskPanel(task)
                          }}
                        >
                          {!isTaskSkeleton && (
                            <>
                              {task.priority && (
                                <span className="kc-column-task-priority">{task.priority}</span>
                              )}
                              <TaskTitle title={task.title} />
                              <TaskCardAssigneeStack assignees={taskAssignees} />
                            </>
                          )}
                        </li>
                        )
                      })}
                    </ul>
                  ) : null}
                  </div>

                  {canCreateTasksOnPage && (
                    <button
                      type="button"
                      className="kc-column-add-task-btn"
                      data-no-column-drag="true"
                      onClick={() => openCreateTaskModal(column)}
                    >
                      + Add a task
                    </button>
                  )}
                </div>
              </article>
              )
              })
            })()}

            {canCreateColumnsOnPage &&
              (addingColumn ? (
                <div
                  className="kc-panel kc-board-column-card kc-board-column-card--add-draft"
                  data-no-column-drag="true"
                >
                  <div className="kc-column-header">
                    <input
                      className="kc-column-name-input"
                      placeholder="Column name..."
                      value={newColumnName}
                      autoFocus
                      onChange={(e) => setNewColumnName(e.target.value)}
                      onBlur={() => void handleAddColumn()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleAddColumn()
                        if (e.key === 'Escape') {
                          setAddingColumn(false)
                          setNewColumnName('')
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  className="kc-board-add-column-btn"
                  data-no-column-drag="true"
                  onClick={() => setAddingColumn(true)}
                >
                  + Add new column
                </button>
              ))}
          </section>
        )}
      </main>

      {selectedTask && (
        <aside
          ref={(el) => { taskPanelRef.current = el }}
          className={`kc-task-panel${taskPanelExpanded ? ' kc-task-panel--expanded' : ''}`}
          aria-label="Task details"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target === e.currentTarget && canEditTask && !isBoardArchived) {
              void handleSaveTask()
            }
          }}
        >
          <div className="kc-task-panel-header">
            <h3 className="kc-task-panel-title">Task details</h3>
            <div className="kc-task-panel-header-actions">
              <button
                type="button"
                className="kc-modal-close"
                aria-label={taskPanelExpanded ? 'Collapse task panel' : 'Expand task panel'}
                title={taskPanelExpanded ? 'Collapse' : 'Expand'}
                onClick={() => setTaskPanelExpanded((prev) => !prev)}
              >
                {taskPanelExpanded ? '⊡' : '⊞'}
              </button>
              <button
                type="button"
                className="kc-modal-close"
                aria-label="Close task panel"
                onClick={closeTaskPanel}
              >
                ×
              </button>
            </div>
          </div>

          <div
            className="kc-task-panel-body"
            onClick={(e) => {
              const t = e.target as Element
              if (!t.closest('input, textarea, button, select, a, [role="button"]')) {
                setTaskPanelExpanded((prev) => !prev)
              }
            }}
          >
            {taskPanelError && <p className="kc-banner">{taskPanelError}</p>}

            {canEditTask && !isBoardArchived ? (
              <>
                <label className="kc-field">
                  <span className="kc-field-label">Title</span>
                  <input
                    className="kc-input"
                    value={taskPanelDraft.title}
                    maxLength={200}
                    onChange={(e) =>
                      setTaskPanelDraft((prev) => ({ ...prev, title: e.target.value }))
                    }
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveTask() }}
                  />
                </label>

                <div className="kc-task-modal-grid">
                  <label className="kc-field">
                    <span className="kc-field-label">Priority</span>
                    <input
                      className="kc-input"
                      value={taskPanelDraft.priority}
                      maxLength={20}
                      placeholder="Optional"
                      onChange={(e) =>
                        setTaskPanelDraft((prev) => ({ ...prev, priority: e.target.value }))
                      }
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveTask() }}
                    />
                  </label>

                  <label className="kc-field">
                    <span className="kc-field-label">Due Date</span>
                    <input
                      className="kc-input"
                      type="datetime-local"
                      value={taskPanelDraft.dueDate}
                      onChange={(e) =>
                        setTaskPanelDraft((prev) => ({ ...prev, dueDate: e.target.value }))
                      }
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveTask() }}
                    />
                  </label>
                </div>

                  <div className="kc-field">
                    <span className="kc-field-label">Description</span>
                    {editingDescription ? (
                      <textarea
                        className="kc-textarea"
                        autoFocus
                        value={taskPanelDraft.description}
                        onChange={(e) =>
                          setTaskPanelDraft((prev) => ({ ...prev, description: e.target.value }))
                        }
                        onBlur={() => setEditingDescription(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            setEditingDescription(false)
                          }
                        }}
                      />
                    ) : (
                      <div
                        className={`kc-task-description-preview kc-markdown${!taskPanelDraft.description ? ' kc-task-description-preview--empty' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setEditingDescription(true) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditingDescription(true) }}
                        title="Click to edit description"
                      >
                        {taskPanelDraft.description
                          ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                              components={createMarkdownComponents({
                                editable: canEditTask && !isBoardArchived && !togglingTaskChecklist,
                                onToggle: (itemIndex, checked) => {
                                  void handleToggleTaskDescriptionChecklist(itemIndex, checked)
                                },
                              })}
                            >
                              {taskPanelDraft.description}
                            </ReactMarkdown>
                            )
                          : <span className="kc-task-description-preview__placeholder">Click to add a description…</span>
                        }
                      </div>
                    )}
                  </div>
              </>
            ) : (
              <>
                <div className="kc-task-panel-field">
                  <span className="kc-field-label">Title</span>
                  <p className="kc-task-panel-value">{selectedTask.title}</p>
                </div>
                  {(selectedTask.priority || selectedTask.dueDate) && (
                    <div className="kc-task-modal-grid">
                      {selectedTask.priority && (
                        <div className="kc-task-panel-field">
                          <span className="kc-field-label">Priority</span>
                          <p className="kc-task-panel-value">{selectedTask.priority}</p>
                        </div>
                      )}
                      {selectedTask.dueDate && (
                        <div className="kc-task-panel-field">
                          <span className="kc-field-label">Due Date</span>
                          <p className="kc-task-panel-value">{new Date(selectedTask.dueDate).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedTask.description && (
                  <div className="kc-task-panel-field">
                    <span className="kc-field-label">Description</span>
                    <div className="kc-task-panel-value kc-task-panel-value--description kc-markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={createMarkdownComponents({ editable: false })}
                        >
                          {selectedTask.description}
                        </ReactMarkdown>
                    </div>
                  </div>
                )}
              </>
            )}

            {(selectedTaskAssignees.length > 0 || canAssignTaskSelf || canAssignTaskOthers) && (
              <div className="kc-task-panel-field">
                <span className="kc-field-label">Assignees</span>
                <div className="kc-task-assignee-chip-list">
                  {selectedTaskAssignees.map((assignee) => (
                    <span key={assignee.userId} className="kc-task-assignee-chip">
                      <span className="kc-task-assignee-chip-avatar" aria-hidden="true">
                        {assignee.avatarUrl ? (
                          <img src={assignee.avatarUrl} alt="" />
                        ) : (
                          <span>{resolveAssigneeDisplayName(assignee).slice(0, 1).toUpperCase()}</span>
                        )}
                      </span>
                      <span className="kc-task-assignee-chip-label">{resolveAssigneeDisplayName(assignee)}</span>
                      {canManageTaskAssignee(assignee.userId) && (
                        <button
                          type="button"
                          className="kc-task-assignee-chip-remove"
                          aria-label={`Remove ${resolveAssigneeDisplayName(assignee)}`}
                          onClick={() => {
                            void handleRemoveTaskAssignee(assignee.userId)
                          }}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}

                  {canAssignTaskOthers && (
                    <input
                      className="kc-task-assignee-input"
                      value={taskPanelAssigneeQuery}
                      placeholder="Search user"
                      onChange={(event) => setTaskPanelAssigneeQuery(event.target.value)}
                    />
                  )}

                  {canAssignTaskSelf && !canAssignTaskOthers && me && !taskAssigneeIds.has(String(me.userId)) && (
                    <button
                      type="button"
                      className="kc-btn kc-btn-ghost"
                      onClick={() => {
                        void handleAddTaskAssignee(String(me.userId))
                      }}
                    >
                      Assign yourself
                    </button>
                  )}
                </div>

                {canAssignTaskOthers && taskPanelAssigneeQuery.trim() && filteredTaskPanelAssigneeMembers.length > 0 && (
                  <ul className="kc-task-assignee-results" role="listbox">
                    {filteredTaskPanelAssigneeMembers.map((member) => (
                      <li key={member.userId}>
                        <button
                          type="button"
                          className="kc-task-assignee-result"
                          onClick={() => {
                            void handleAddTaskAssignee(member.userId)
                            setTaskPanelAssigneeQuery('')
                          }}
                        >
                          <span className="kc-task-assignee-chip-avatar" aria-hidden="true">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt="" />
                            ) : (
                              <span>{resolveAssigneeDisplayName(member).slice(0, 1).toUpperCase()}</span>
                            )}
                          </span>
                          <span className="kc-task-assignee-result-main">
                            <strong>{resolveAssigneeDisplayName(member)}</strong>
                            <small>@{member.username}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {selectedTaskAssignees.length === 0 && (
                  <p className="kc-task-panel-value">No assignees yet.</p>
                )}
              </div>
            )}

            <section className="kc-task-comments" aria-label="Task comments">
              <div className="kc-task-comments-header">
                <h4>Comments</h4>
                {canCreateTaskComment && (
                  <button
                    type="button"
                    className="kc-btn kc-btn-ghost"
                    onClick={() => {
                      setShowCommentComposer((prev) => !prev)
                      setTaskCommentsError('')
                      setOpenCommentMenuId(null)
                    }}
                  >
                    {showCommentComposer ? 'Cancel' : 'New comment'}
                  </button>
                )}
              </div>

              {taskCommentsState === 'loading' && <p className="kc-muted">Loading comments...</p>}
              {taskCommentsError && <p className="kc-banner">{taskCommentsError}</p>}

              {showCommentComposer && canCreateTaskComment && (
                <div className="kc-task-comment-compose">
                  <textarea
                    className="kc-textarea"
                    value={taskCommentDraft.content}
                    placeholder="Write a comment..."
                    onChange={(event) =>
                      setTaskCommentDraft({ content: event.target.value })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void handleCreateComment()
                      }
                    }}
                  />
                  <div className="kc-task-comment-compose-actions">
                    <button
                      type="button"
                      className="kc-btn kc-btn-primary"
                      disabled={creatingComment || !taskCommentDraft.content.trim()}
                      onClick={() => void handleCreateComment()}
                    >
                      {creatingComment ? 'Posting...' : 'Post comment'}
                    </button>
                  </div>
                </div>
              )}

              {taskCommentsState === 'ready' && taskComments.length === 0 && (
                <p className="kc-muted">No comments yet.</p>
              )}

              {taskComments.length > 0 && (
                <ul className="kc-task-comments-list">
                  {taskComments.map((comment) => {
                    const isEditingThisComment = editingCommentId === comment.commentId
                    const canEditThisComment = canEditComment(comment)
                    const canDeleteThisComment = canDeleteComment(comment)
                    const showCommentActions = canEditThisComment || canDeleteThisComment
                    const editLabel = getCommentEditLabel(comment)
                    const authorName = resolveCommentAuthorName(comment)

                    return (
                      <li key={comment.commentId} className="kc-task-comment-item">
                        <div className="kc-task-comment-avatar" aria-hidden="true">
                          {comment.authorAvatarUrl ? (
                            <img src={comment.authorAvatarUrl} alt="" />
                          ) : (
                            <span>{authorName.slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>

                        <div className="kc-task-comment-main">
                          <div className="kc-task-comment-meta">
                            <strong>{authorName}</strong>
                            <span>{formatCommentTimestamp(comment.createdAt)}</span>
                            {editLabel && <small>{editLabel}</small>}
                          </div>

                          {isEditingThisComment ? (
                            <div className="kc-task-comment-edit">
                              <textarea
                                className="kc-textarea"
                                value={editingCommentContent}
                                onChange={(event) => setEditingCommentContent(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault()
                                    void handleSaveEditedComment()
                                  }
                                }}
                              />
                              <div className="kc-task-comment-edit-actions">
                                <button
                                  type="button"
                                  className="kc-btn kc-btn-ghost"
                                  onClick={() => {
                                    setEditingCommentId(null)
                                    setEditingCommentContent('')
                                  }}
                                  disabled={savingComment}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="kc-btn kc-btn-primary"
                                  onClick={() => void handleSaveEditedComment()}
                                  disabled={savingComment || !editingCommentContent.trim()}
                                >
                                  {savingComment ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="kc-task-comment-content kc-markdown">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                                components={createMarkdownComponents({
                                  editable: canEditComment(comment) && !isBoardArchived && !togglingCommentChecklistIds.has(comment.commentId),
                                  onToggle: (itemIndex, checked) => {
                                    void handleToggleCommentChecklist(comment.commentId, itemIndex, checked)
                                  },
                                })}
                              >
                                {comment.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>

                        {showCommentActions && (
                          <div className="kc-task-comment-menu-wrap">
                            <button
                              type="button"
                              className="kc-column-menu-btn"
                              aria-label="Comment options"
                              aria-expanded={openCommentMenuId === comment.commentId}
                              onClick={() =>
                                setOpenCommentMenuId((prev) =>
                                  prev === comment.commentId ? null : comment.commentId,
                                )
                              }
                            >
                              {'\u22EF'}
                            </button>
                            {openCommentMenuId === comment.commentId && (
                              <ul className="kc-column-menu-dropdown" role="menu">
                                {canEditThisComment && (
                                  <li role="none">
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="kc-column-menu-item"
                                      onClick={() => {
                                        setEditingCommentId(comment.commentId)
                                        setEditingCommentContent(comment.content)
                                        setOpenCommentMenuId(null)
                                      }}
                                    >
                                      Edit comment
                                    </button>
                                  </li>
                                )}
                                {canDeleteThisComment && (
                                  <li role="none">
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="kc-column-menu-item kc-column-menu-item--danger"
                                      onClick={() => {
                                        setDeleteTargetComment(comment)
                                        setDeleteCommentError('')
                                        setOpenCommentMenuId(null)
                                      }}
                                    >
                                      Delete comment
                                    </button>
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          {(canEditTask || canDeleteTask) && !isBoardArchived && (
            <div className="kc-task-panel-footer">
              {canDeleteTask && (
                <button
                  type="button"
                  className="kc-btn kc-btn-danger"
                  onClick={() => {
                    setDeleteTargetTask(selectedTask)
                    setDeleteTaskError('')
                  }}
                  disabled={savingTask}
                >
                  Delete
                </button>
              )}
              {canEditTask && (
                <div className="kc-task-panel-footer-actions">
                  <button
                    type="button"
                    className="kc-btn kc-btn-ghost"
                    onClick={closeTaskPanel}
                    disabled={savingTask}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="kc-btn kc-btn-primary"
                    onClick={() => void handleSaveTask()}
                    disabled={savingTask}
                  >
                    {savingTask ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      )}

      {taskModalColumn && (
        <div
          className="kc-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Create Task"
          onClick={() => {
            if (!creatingTask) {
              closeCreateTaskModal()
            }
          }}
        >
          <div className="kc-modal kc-task-modal" onClick={(event) => event.stopPropagation()}>
            <div className="kc-modal-header">
              <h3 className="kc-modal-title">Create task</h3>
              <button
                type="button"
                className="kc-modal-close"
                aria-label="Close create task modal"
                onClick={() => {
                  if (!creatingTask) {
                    closeCreateTaskModal()
                  }
                }}
              >
                ×
              </button>
            </div>
            <div className="kc-modal-body kc-task-modal-body">
              <p className="kc-muted">
                New tasks in <strong>{taskModalColumn.name}</strong> are added to the end of the column.
              </p>
              {taskModalError && <p className="kc-banner">{taskModalError}</p>}

              <label className="kc-field">
                <span className="kc-field-label">Title</span>
                <input
                  className="kc-input"
                  value={taskDraft.title}
                  maxLength={200}
                  autoFocus
                  onChange={(event) =>
                    setTaskDraft((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </label>

              <div className="kc-task-modal-grid">
                <label className="kc-field">
                  <span className="kc-field-label">Priority</span>
                  <input
                    className="kc-input"
                    value={taskDraft.priority}
                    maxLength={20}
                    placeholder="Optional"
                    onChange={(event) =>
                      setTaskDraft((prev) => ({ ...prev, priority: event.target.value }))
                    }
                  />
                </label>

                <label className="kc-field">
                  <span className="kc-field-label">Due Date</span>
                  <input
                    className="kc-input"
                    type="datetime-local"
                    value={taskDraft.dueDate}
                    onChange={(event) =>
                      setTaskDraft((prev) => ({ ...prev, dueDate: event.target.value }))
                    }
                  />
                </label>
              </div>

              <label className="kc-field">
                <span className="kc-field-label">Description</span>
                <textarea
                  className="kc-textarea"
                  value={taskDraft.description}
                  onChange={(event) =>
                    setTaskDraft((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </label>

              {canAssignInTaskModal && (
                <div className="kc-field">
                  <span className="kc-field-label">Assignees</span>
                  <div className="kc-task-assignee-picker">
                    <div className="kc-task-assignee-chip-list">
                      {selectedDraftAssignees.map((assignee) => {
                        const canRemove = canAssignTaskOthers
                        return (
                          <span key={assignee.userId} className="kc-task-assignee-chip">
                            <span className="kc-task-assignee-chip-avatar" aria-hidden="true">
                              {assignee.avatarUrl ? (
                                <img src={assignee.avatarUrl} alt="" />
                              ) : (
                                <span>{resolveAssigneeDisplayName(assignee).slice(0, 1).toUpperCase()}</span>
                              )}
                            </span>
                            <span className="kc-task-assignee-chip-label">{resolveAssigneeDisplayName(assignee)}</span>
                            {canRemove && (
                              <button
                                type="button"
                                className="kc-task-assignee-chip-remove"
                                aria-label={`Remove ${resolveAssigneeDisplayName(assignee)}`}
                                onClick={() => {
                                  setTaskDraftAssigneeIds((prev) => prev.filter((id) => id !== assignee.userId))
                                }}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        )
                      })}

                      {canAssignTaskOthers && (
                        <input
                          className="kc-task-assignee-input"
                          value={taskAssigneeQuery}
                          placeholder="Search user"
                          onChange={(event) => setTaskAssigneeQuery(event.target.value)}
                        />
                      )}
                    </div>

                    {canAssignTaskOthers && taskAssigneeQuery.trim() && filteredAssigneeMembers.length > 0 && (
                      <ul className="kc-task-assignee-results" role="listbox">
                        {filteredAssigneeMembers.map((member) => (
                          <li key={member.userId}>
                            <button
                              type="button"
                              className="kc-task-assignee-result"
                              onClick={() => {
                                setTaskDraftAssigneeIds((prev) => [...prev, member.userId])
                                setTaskAssigneeQuery('')
                              }}
                            >
                              <span className="kc-task-assignee-chip-avatar" aria-hidden="true">
                                {member.avatarUrl ? (
                                  <img src={member.avatarUrl} alt="" />
                                ) : (
                                  <span>{resolveAssigneeDisplayName(member).slice(0, 1).toUpperCase()}</span>
                                )}
                              </span>
                              <span className="kc-task-assignee-result-main">
                                <strong>{resolveAssigneeDisplayName(member)}</strong>
                                <small>@{member.username}</small>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="kc-task-modal-actions">
              <button
                type="button"
                className="kc-btn kc-btn-ghost"
                onClick={() => closeCreateTaskModal()}
                disabled={creatingTask}
              >
                Cancel
              </button>
              <button
                type="button"
                className="kc-btn kc-btn-primary"
                onClick={() => void handleCreateTask()}
                disabled={creatingTask}
              >
                {creatingTask ? 'Creating...' : 'Create task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetTask && (
        <div
          className="kc-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Delete Task"
          onClick={() => {
            if (!deletingTask) {
              setDeleteTargetTask(null)
              setDeleteTaskError('')
            }
          }}
        >
          <div className="kc-modal kc-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="kc-modal-header">
              <h3 className="kc-modal-title">Delete Task</h3>
            </div>
            <div className="kc-modal-body">
              <p className="kc-modal-confirm-desc">
                Delete <strong>{deleteTargetTask.title}</strong>? This cannot be undone.
              </p>
              {deleteTaskError && <p className="kc-banner">{deleteTaskError}</p>}
            </div>
            <div className="kc-modal-footer">
              <button
                type="button"
                className="kc-btn kc-btn-ghost"
                onClick={() => {
                  setDeleteTargetTask(null)
                  setDeleteTaskError('')
                }}
                disabled={deletingTask}
              >
                Cancel
              </button>
              <button
                type="button"
                className="kc-btn kc-btn-danger"
                onClick={() => void handleDeleteTask()}
                disabled={deletingTask}
              >
                {deletingTask ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetComment && (
        <div
          className="kc-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Delete Comment"
          onClick={() => {
            if (!deletingComment) {
              setDeleteTargetComment(null)
              setDeleteCommentError('')
            }
          }}
        >
          <div className="kc-modal kc-modal--confirm" onClick={(event) => event.stopPropagation()}>
            <div className="kc-modal-header">
              <h3 className="kc-modal-title">Delete Comment</h3>
            </div>
            <div className="kc-modal-body">
              <p className="kc-modal-confirm-desc">Delete this comment? This cannot be undone.</p>
              {deleteCommentError && <p className="kc-banner">{deleteCommentError}</p>}
            </div>
            <div className="kc-modal-footer">
              <button
                type="button"
                className="kc-btn kc-btn-ghost"
                onClick={() => {
                  setDeleteTargetComment(null)
                  setDeleteCommentError('')
                }}
                disabled={deletingComment}
              >
                Cancel
              </button>
              <button
                type="button"
                className="kc-btn kc-btn-danger"
                onClick={() => void handleDeleteComment()}
                disabled={deletingComment}
              >
                {deletingComment ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetColumn && (
        <div
          className="kc-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Delete Column"
          onClick={() => {
            if (!deleting) {
              setDeleteTargetColumn(null)
              setDeleteError('')
            }
          }}
        >
          <div className="kc-modal kc-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="kc-modal-header">
              <h3 className="kc-modal-title">Delete Column</h3>
            </div>
            <div className="kc-modal-body">
              <p className="kc-modal-confirm-desc">
                Delete <strong>{deleteTargetColumn.name}</strong>? This cannot be undone.
              </p>
              {deleteTaskCount > 0 && (
                <p className="kc-modal-confirm-desc">
                  This will also delete {deleteTaskCount} {deleteTaskCount === 1 ? 'task' : 'tasks'} in this column.
                </p>
              )}
              {deleteError && <p className="kc-banner">{deleteError}</p>}
            </div>
            <div className="kc-modal-footer">
              <button
                type="button"
                className="kc-btn kc-btn-ghost"
                onClick={() => {
                  setDeleteTargetColumn(null)
                  setDeleteError('')
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="kc-btn kc-btn-danger"
                onClick={() => void handleDeleteColumn()}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      <ToastStack toasts={toasts} />
    </>
  )
}
