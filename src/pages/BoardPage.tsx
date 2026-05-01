import { useEffect, useState, type CSSProperties, type DragEvent } from 'react'
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
  fetchBoardTasks,
  updateTask,
  type TaskEntry,
} from '../services/tasksService'
import { evaluatePermission } from '../services/permissionsService'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { ToastStack } from '../components/dashboard/ToastStack'
import type { HeaderUser, ToastMessage } from '../components/dashboard/types'

type LoadState = 'idle' | 'loading' | 'error' | 'ready'
type ColumnDropEdge = 'before' | 'after'
type ColumnDropIntent = { targetColumnId: number; edge: ColumnDropEdge }
type TaskDropEdge = 'before' | 'after'
type TaskDropIntent = {
  columnId: number
  targetTaskId: number | null
  edge: TaskDropEdge
}
type TaskDraft = {
  title: string
  description: string
  priority: string
  dueDate: string
}

const EMPTY_TASK_DRAFT: TaskDraft = {
  title: '',
  description: '',
  priority: '',
  dueDate: '',
}

function isColumnDragExcludedTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('[data-no-column-drag="true"]') !== null
}

function resolveColumnDropIntent(
  row: HTMLElement,
  entries: BoardColumnEntry[],
  draggedColumnId: number,
  clientX: number,
): ColumnDropIntent | null {
  const draggableEntries = entries.filter((entry) => entry.columnId !== draggedColumnId)
  if (draggableEntries.length === 0) return null

  const positionedEntries = draggableEntries
    .map((entry) => {
      const element = row.querySelector<HTMLElement>(`.kc-board-column-card[data-column-id="${entry.columnId}"]`)
      if (!element) return null
      return { entry, rect: element.getBoundingClientRect() }
    })
    .filter((item): item is { entry: BoardColumnEntry; rect: DOMRect } => item !== null)

  if (positionedEntries.length === 0) return null

  const firstEntry = positionedEntries[0]
  const lastEntry = positionedEntries[positionedEntries.length - 1]

  if (clientX <= firstEntry.rect.left) {
    return { targetColumnId: firstEntry.entry.columnId, edge: 'before' }
  }

  if (clientX >= lastEntry.rect.right) {
    return { targetColumnId: lastEntry.entry.columnId, edge: 'after' }
  }

  for (let index = 0; index < positionedEntries.length; index += 1) {
    const current = positionedEntries[index]
    const middle = current.rect.left + current.rect.width / 2

    if (clientX >= current.rect.left && clientX <= current.rect.right) {
      return {
        targetColumnId: current.entry.columnId,
        edge: clientX < middle ? 'before' : 'after',
      }
    }

    if (index < positionedEntries.length - 1) {
      const next = positionedEntries[index + 1]
      if (clientX > current.rect.right && clientX < next.rect.left) {
        const gapMiddle = current.rect.right + (next.rect.left - current.rect.right) / 2
        return clientX < gapMiddle
          ? { targetColumnId: current.entry.columnId, edge: 'after' }
          : { targetColumnId: next.entry.columnId, edge: 'before' }
      }
    }
  }

  return null
}

function normalizeColumnPositions(entries: BoardColumnEntry[]): BoardColumnEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    position: index + 1,
  }))
}

function reorderColumns(
  entries: BoardColumnEntry[],
  draggedColumnId: number,
  targetColumnId: number,
  edge: ColumnDropEdge,
): BoardColumnEntry[] {
  const draggedIndex = entries.findIndex((entry) => entry.columnId === draggedColumnId)
  const targetIndex = entries.findIndex((entry) => entry.columnId === targetColumnId)

  if (draggedIndex < 0 || targetIndex < 0) return entries

  const reordered = [...entries]
  const [draggedEntry] = reordered.splice(draggedIndex, 1)
  let insertIndex = targetIndex + (edge === 'after' ? 1 : 0)

  if (draggedIndex < insertIndex) {
    insertIndex -= 1
  }

  reordered.splice(insertIndex, 0, draggedEntry)
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
  targetTaskId: number | null,
  edge: TaskDropEdge,
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

  let insertIndex = targetTasks.length
  if (targetTaskId !== null) {
    const targetIndex = targetTasks.findIndex((entry) => entry.taskId === targetTaskId)
    if (targetIndex >= 0) {
      insertIndex = targetIndex + (edge === 'after' ? 1 : 0)
    }
  }

  targetTasks.splice(insertIndex, 0, {
    ...draggedTask,
    columnId: targetColumnId,
  })

  nextGroups[sourceColumnId] = normalizeTasks(sourceTasks, sourceColumnId)
  nextGroups[targetColumnId] = normalizeTasks(targetTasks, targetColumnId)
  return nextGroups
}

function resolveTaskDropIntent(
  dropzone: HTMLElement,
  columnId: number,
  entries: TaskEntry[],
  draggedTaskId: number,
  clientY: number,
): TaskDropIntent {
  const candidates = entries.filter((entry) => entry.taskId !== draggedTaskId)
  const positionedTasks = candidates
    .map((entry) => {
      const element = dropzone.querySelector<HTMLElement>(`.kc-column-task-card[data-task-id="${entry.taskId}"]`)
      if (!element) return null
      return { entry, rect: element.getBoundingClientRect() }
    })
    .filter((item): item is { entry: TaskEntry; rect: DOMRect } => item !== null)

  if (positionedTasks.length === 0) {
    return { columnId, targetTaskId: null, edge: 'after' }
  }

  const firstTask = positionedTasks[0]
  const lastTask = positionedTasks[positionedTasks.length - 1]

  if (clientY <= firstTask.rect.top) {
    return { columnId, targetTaskId: firstTask.entry.taskId, edge: 'before' }
  }

  if (clientY >= lastTask.rect.bottom) {
    return { columnId, targetTaskId: lastTask.entry.taskId, edge: 'after' }
  }

  for (let index = 0; index < positionedTasks.length; index += 1) {
    const current = positionedTasks[index]
    const middle = current.rect.top + current.rect.height / 2

    if (clientY >= current.rect.top && clientY <= current.rect.bottom) {
      return {
        columnId,
        targetTaskId: current.entry.taskId,
        edge: clientY < middle ? 'before' : 'after',
      }
    }

    if (index < positionedTasks.length - 1) {
      const next = positionedTasks[index + 1]
      if (clientY > current.rect.bottom && clientY < next.rect.top) {
        const gapMiddle = current.rect.bottom + (next.rect.top - current.rect.bottom) / 2
        return clientY < gapMiddle
          ? { columnId, targetTaskId: current.entry.taskId, edge: 'after' }
          : { columnId, targetTaskId: next.entry.taskId, edge: 'before' }
      }
    }
  }

  return { columnId, targetTaskId: lastTask.entry.taskId, edge: 'after' }
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

function resolveTaskDropIntentFromBoard(
  row: HTMLElement,
  columns: BoardColumnEntry[],
  tasksByColumn: Record<number, TaskEntry[]>,
  draggedTaskId: number,
  clientX: number,
  clientY: number,
): TaskDropIntent | null {
  const targetColumnId = resolveTaskTargetColumnId(row, columns, clientX)
  if (targetColumnId === null) return null

  const targetColumnElement = row.querySelector<HTMLElement>(
    `.kc-board-column-card[data-column-id="${targetColumnId}"]`,
  )
  if (!targetColumnElement) return null

  return resolveTaskDropIntent(
    targetColumnElement,
    targetColumnId,
    tasksByColumn[targetColumnId] ?? [],
    draggedTaskId,
    clientY,
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
  const [canMoveTask, setCanMoveTask] = useState(false)
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
  const [dragOverColumnId, setDragOverColumnId] = useState<number | null>(null)
  const [dragOverEdge, setDragOverEdge] = useState<ColumnDropEdge>('after')
  const [movingColumns, setMovingColumns] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null)
  const [dragOverTaskColumnId, setDragOverTaskColumnId] = useState<number | null>(null)
  const [dragOverTaskEdge, setDragOverTaskEdge] = useState<TaskDropEdge>('after')
  const [movingTasks, setMovingTasks] = useState(false)
  const [suppressEditUntil, setSuppressEditUntil] = useState(0)
  const [taskModalColumn, setTaskModalColumn] = useState<BoardColumnEntry | null>(null)
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK_DRAFT)
  const [taskModalError, setTaskModalError] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)

  const isBoardArchived = Boolean(board?.isArchived)
  const canEditColumnsOnPage = canEditColumn && !isBoardArchived
  const canCreateColumnsOnPage = canCreateColumn && !isBoardArchived
  const canDeleteColumnsOnPage = canDeleteColumn && !isBoardArchived
  const canMoveColumnsOnPage = canEditColumn && canMoveColumn && !isBoardArchived
  const canCreateTasksOnPage = canCreateTask && !isBoardArchived
  const canMoveTasksOnPage = canEditTask && canMoveTask && !isBoardArchived

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    const id = nextToastId
    setNextToastId(id + 1)
    setToasts((prev) => [...prev, { id, text, type }])
    const delay = type === 'success' ? 3000 : 5000
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
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
        const userId = String(meResponse.userId)
        const [boardData, columnData, taskData, editPerm, createPerm, deletePerm, movePerm, createTaskPerm, editTaskPerm, moveTaskPerm] = await Promise.all([
          fetchBoardById(token, serverId, userId, boardId),
          fetchBoardColumns(token, serverId, boardId, userId),
          fetchBoardTasks(token, serverId, boardId, userId),
          evaluatePermission(token, serverId, userId, 'EDIT_COLUMN', boardId),
          evaluatePermission(token, serverId, userId, 'CREATE_COLUMN', boardId),
          evaluatePermission(token, serverId, userId, 'DELETE_COLUMN', boardId),
          evaluatePermission(token, serverId, userId, 'MOVE_COLUMN', boardId),
          evaluatePermission(token, serverId, userId, 'CREATE_TASK', boardId),
          evaluatePermission(token, serverId, userId, 'EDIT_TASK', boardId),
          evaluatePermission(token, serverId, userId, 'MOVE_TASK', boardId),
        ])

        if (cancelled) return
        setBoard(boardData)
        setColumns(columnData)
        setTasksByColumn(groupTasksByColumn(taskData))
        setCanEditColumn(editPerm.allowed && !boardData.isArchived)
        setCanCreateColumn(createPerm.allowed && !boardData.isArchived)
        setCanDeleteColumn(deletePerm.allowed && !boardData.isArchived)
        setCanMoveColumn(movePerm.allowed && !boardData.isArchived)
        setCanCreateTask(createTaskPerm.allowed && !boardData.isArchived)
        setCanEditTask(editTaskPerm.allowed && !boardData.isArchived)
        setCanMoveTask(moveTaskPerm.allowed && !boardData.isArchived)
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

  async function saveColumnName(column: BoardColumnEntry) {
    const trimmed = editingColumnName.trim()
    setEditingColumnId(null)
    if (!trimmed || trimmed === column.name || !me) return
    const token = getStoredToken()
    if (!token) return
    const previousColumns = columns
    setColumns((cols) =>
      cols.map((c) => (c.columnId === column.columnId ? { ...c, name: trimmed } : c)),
    )
    try {
      const updated = await updateColumn(
        token,
        serverId,
        boardId,
        column.columnId,
        trimmed,
        String(me.userId),
      )
      setColumns((cols) => cols.map((c) => (c.columnId === updated.columnId ? updated : c)))
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

  function handleColumnDragStart(event: DragEvent<HTMLElement>, columnId: number) {
    if (isColumnDragExcludedTarget(event.target)) {
      event.preventDefault()
      clearColumnDragState()
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(columnId))
    setDraggedColumnId(columnId)
    setDragOverColumnId(columnId)
    setDragOverEdge('after')
    setOpenMenuColumnId(null)
    setEditingColumnId(null)
    setSuppressEditUntil(Date.now() + 250)
  }

  async function handleColumnDrop(targetColumnId: number) {
    if (!canMoveColumnsOnPage || !draggedColumnId || movingColumns) return

    const previousColumns = columns
    const nextColumns = reorderColumns(previousColumns, draggedColumnId, targetColumnId, dragOverEdge)

    setDraggedColumnId(null)
    setDragOverColumnId(null)
    setDragOverEdge('after')

    const changed = nextColumns.some(
      (column, index) => column.columnId !== previousColumns[index]?.columnId,
    )

    if (!changed) return

    setColumns(nextColumns)
    await persistColumnOrder(nextColumns, previousColumns)
  }

  function handleBoardRowDragOver(event: DragEvent<HTMLElement>) {
    if (canMoveTasksOnPage && draggedTaskId !== null) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'

      const intent = resolveTaskDropIntentFromBoard(
        event.currentTarget,
        columns,
        tasksByColumn,
        draggedTaskId,
        event.clientX,
        event.clientY,
      )

      if (!intent) {
        setDragOverTaskId(null)
        setDragOverTaskColumnId(null)
        return
      }

      setDragOverTaskId(intent.targetTaskId)
      setDragOverTaskColumnId(intent.columnId)
      setDragOverTaskEdge(intent.edge)
      return
    }

    if (!canMoveColumnsOnPage || !draggedColumnId) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    const intent = resolveColumnDropIntent(
      event.currentTarget,
      columns,
      draggedColumnId,
      event.clientX,
    )

    if (!intent) {
      setDragOverColumnId(null)
      return
    }

    setDragOverColumnId(intent.targetColumnId)
    setDragOverEdge(intent.edge)
  }

  async function handleBoardRowDrop(event: DragEvent<HTMLElement>) {
    if (canMoveTasksOnPage && draggedTaskId !== null && !movingTasks) {
      event.preventDefault()

      const intent = resolveTaskDropIntentFromBoard(
        event.currentTarget,
        columns,
        tasksByColumn,
        draggedTaskId,
        event.clientX,
        event.clientY,
      )

      if (!intent) {
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
        intent.columnId,
        intent.targetTaskId,
        intent.edge,
      )

      clearTaskDragState()

      const sourceColumnId = draggedTask.columnId
      const changed = JSON.stringify(nextTaskGroups[sourceColumnId] ?? []) !== JSON.stringify(previousTaskGroups[sourceColumnId] ?? [])
        || JSON.stringify(nextTaskGroups[intent.columnId] ?? []) !== JSON.stringify(previousTaskGroups[intent.columnId] ?? [])

      if (!changed) return

      setTasksByColumn(nextTaskGroups)
      const affectedColumnIds = Array.from(new Set([sourceColumnId, intent.columnId]))
      await persistTaskMove(nextTaskGroups, previousTaskGroups, affectedColumnIds)
      return
    }

    if (!canMoveColumnsOnPage || !draggedColumnId) return

    event.preventDefault()

    const intent = resolveColumnDropIntent(
      event.currentTarget,
      columns,
      draggedColumnId,
      event.clientX,
    )

    if (!intent) {
      clearColumnDragState()
      return
    }

    setDragOverColumnId(intent.targetColumnId)
    setDragOverEdge(intent.edge)
    await handleColumnDrop(intent.targetColumnId)
  }

  function clearColumnDragState() {
    setDraggedColumnId(null)
    setDragOverColumnId(null)
    setDragOverEdge('after')
    setSuppressEditUntil(Date.now() + 250)
  }

  function openCreateTaskModal(column: BoardColumnEntry) {
    if (!canCreateTasksOnPage) return
    setTaskModalColumn(column)
    setTaskDraft({ ...EMPTY_TASK_DRAFT })
    setTaskModalError('')
  }

  function closeCreateTaskModal() {
    setTaskModalColumn(null)
    setTaskDraft({ ...EMPTY_TASK_DRAFT })
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
    setDragOverTaskId(null)
    setDragOverTaskColumnId(null)
    setDragOverTaskEdge('after')
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
    setDraggedTaskId(taskId)
    setSuppressEditUntil(Date.now() + 250)
  }

  function handleTaskDragOver(event: DragEvent<HTMLElement>, columnId: number) {
    if (!canMoveTasksOnPage || !draggedTaskId) return

    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'

    const intent = resolveTaskDropIntent(
      event.currentTarget,
      columnId,
      getColumnTasks(columnId),
      draggedTaskId,
      event.clientY,
    )

    setDragOverTaskId(intent.targetTaskId)
    setDragOverTaskColumnId(intent.columnId)
    setDragOverTaskEdge(intent.edge)
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

    const intent = resolveTaskDropIntent(
      event.currentTarget,
      columnId,
      getColumnTasks(columnId),
      draggedTaskId,
      event.clientY,
    )

    const nextTaskGroups = moveTaskLocally(
      previousTaskGroups,
      draggedTaskId,
      intent.columnId,
      intent.targetTaskId,
      intent.edge,
    )

    clearTaskDragState()

    const sourceColumnId = draggedTask.columnId
    const changed = JSON.stringify(nextTaskGroups[sourceColumnId] ?? []) !== JSON.stringify(previousTaskGroups[sourceColumnId] ?? [])
      || JSON.stringify(nextTaskGroups[intent.columnId] ?? []) !== JSON.stringify(previousTaskGroups[intent.columnId] ?? [])

    if (!changed) return

    setTasksByColumn(nextTaskGroups)
    const affectedColumnIds = Array.from(new Set([sourceColumnId, intent.columnId]))
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

            {columns.map((column, index) => {
              const columnTasks = getColumnTasks(column.columnId)
              const dragOverIndex = columns.findIndex((entry) => entry.columnId === dragOverColumnId)
              const hasActiveDropTarget = draggedColumnId !== null && dragOverIndex >= 0
              const isPrimaryBefore =
                hasActiveDropTarget &&
                dragOverIndex === index &&
                dragOverEdge === 'before' &&
                draggedColumnId !== column.columnId
              const isPrimaryAfter =
                hasActiveDropTarget &&
                dragOverIndex === index &&
                dragOverEdge === 'after' &&
                draggedColumnId !== column.columnId
              const isNeighborBefore =
                hasActiveDropTarget &&
                dragOverIndex === index - 1 &&
                dragOverEdge === 'after' &&
                draggedColumnId !== column.columnId
              const isNeighborAfter =
                hasActiveDropTarget &&
                dragOverIndex === index + 1 &&
                dragOverEdge === 'before' &&
                draggedColumnId !== column.columnId
              const columnStyle = {
                '--kc-column-accent': column.color ?? '#60a5fa',
              } as CSSProperties
              const isTaskDropzoneActive = draggedTaskId !== null && dragOverTaskColumnId === column.columnId
              const isTaskDropAtEnd = isTaskDropzoneActive && dragOverTaskId === null

              return (
                <article
                  key={column.columnId}
                  data-column-id={column.columnId}
                  style={columnStyle}
                  className={[
                    'kc-panel',
                    'kc-board-column-card',
                    canMoveColumnsOnPage ? 'kc-board-column-card--movable' : '',
                    draggedColumnId === column.columnId ? 'kc-board-column-card--dragging' : '',
                    isPrimaryBefore || isNeighborBefore ? 'kc-board-column-card--drop-before' : '',
                    isPrimaryAfter || isNeighborAfter ? 'kc-board-column-card--drop-after' : '',
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
                      isTaskDropAtEnd ? 'kc-column-task-dropzone--active' : '',
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
                        const isDropBefore =
                          draggedTaskId !== null &&
                          dragOverTaskColumnId === column.columnId &&
                          dragOverTaskId === task.taskId &&
                          dragOverTaskEdge === 'before' &&
                          draggedTaskId !== task.taskId
                        const isDropAfter =
                          draggedTaskId !== null &&
                          dragOverTaskColumnId === column.columnId &&
                          dragOverTaskId === task.taskId &&
                          dragOverTaskEdge === 'after' &&
                          draggedTaskId !== task.taskId

                        return (
                        <li
                          key={task.taskId}
                          data-task-id={task.taskId}
                          className={[
                            'kc-column-task-card',
                            canMoveTasksOnPage ? 'kc-column-task-card--movable' : '',
                            draggedTaskId === task.taskId ? 'kc-column-task-card--dragging' : '',
                            isDropBefore ? 'kc-column-task-card--drop-before' : '',
                            isDropAfter ? 'kc-column-task-card--drop-after' : '',
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
                        >
                          <span className="kc-column-task-title">{task.title}</span>
                          {task.priority && (
                            <span className="kc-column-task-priority">{task.priority}</span>
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
            })}

            {canCreateColumnsOnPage &&
              (addingColumn ? (
                <div
                  className="kc-panel kc-board-column-card"
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
