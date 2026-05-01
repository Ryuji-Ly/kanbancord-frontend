import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
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
type TaskDropTarget = { columnId: number; dropIndex: number }
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
  const columnDragImageRef = useRef<HTMLElement | null>(null)
  const columnDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const transparentDragImageRef = useRef<HTMLImageElement | null>(null)
  const taskDragImageRef = useRef<HTMLElement | null>(null)
  const taskDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

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

                        return (
                        <li
                          key={task.taskId}
                          data-task-id={task.taskId}
                          style={isTaskSkeleton && draggedTaskHeight ? { height: `${draggedTaskHeight}px` } : undefined}
                          className={[
                            'kc-column-task-card',
                            canMoveTasksOnPage ? 'kc-column-task-card--movable' : '',
                            isTaskSkeleton ? 'kc-column-task-card--drag-skeleton' : '',
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
                          {!isTaskSkeleton && (
                            <>
                              {task.priority && (
                                <span className="kc-column-task-priority">{task.priority}</span>
                              )}
                              <TaskTitle title={task.title} />
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
