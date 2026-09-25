import { useRef, useState, type DragEvent } from 'react'
import type { BoardColumnEntry } from '../../services/boardColumnsService'
import type { TaskEntry } from '../../services/tasksService'
import {
  isColumnDragExcludedTarget,
  moveTaskLocally,
  reorderColumnsByIndex,
  resolveColumnDropIndex,
  resolveTaskDropIndex,
  resolveTaskDropTargetFromBoard,
  type TaskDropTarget,
} from './boardModel'

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
/** Clicks right after a drag are the end of the drag, not a request to open or rename something. */
const CLICK_SUPPRESSION_MS = 250

type Ghost = { element: HTMLElement; offsetX: number; offsetY: number }

/** A half-transparent copy of the dragged element that follows the pointer (the browser's own drag image is hidden). */
function createGhost(event: DragEvent<HTMLElement>): Ghost {
  const source = event.currentTarget
  const rect = source.getBoundingClientRect()
  const clone = source.cloneNode(true) as HTMLElement
  Object.assign(clone.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: `${rect.width}px`,
    minWidth: `${rect.width}px`,
    maxWidth: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: 'none',
    margin: '0',
    opacity: '0.5',
    boxSizing: 'border-box',
    border: '1px solid color-mix(in srgb, var(--kc-subtle) 18%, transparent)',
    boxShadow: '0 8px 20px color-mix(in srgb, var(--kc-shadow) 35%, transparent)',
    zIndex: '2000',
  })
  document.body.appendChild(clone)
  return {
    element: clone,
    offsetX: Math.max(0, Math.min(event.clientX - rect.left, rect.width)),
    offsetY: Math.max(0, Math.min(event.clientY - rect.top, rect.height)),
  }
}

function moveGhost(ghost: Ghost | null, clientX: number, clientY: number) {
  if (!ghost) return
  ghost.element.style.left = `${clientX - ghost.offsetX}px`
  ghost.element.style.top = `${clientY - ghost.offsetY}px`
}

type Options = {
  /** Columns in board order. */
  columns: BoardColumnEntry[]
  tasksByColumn: Record<number, TaskEntry[]>
  canMoveColumns: boolean
  canMoveTasks: boolean
  onMoveColumn: (columnId: number, index: number) => void
  onMoveTask: (taskId: number, columnId: number, index: number) => void
}

/**
 * Drag and drop of columns (within the board row) and tasks (within and between columns, or anywhere
 * on the row), with a live preview of where the dragged item will land.
 */
export function useBoardDragAndDrop({ columns, tasksByColumn, canMoveColumns, canMoveTasks, onMoveColumn, onMoveTask }: Options) {
  const [draggedColumnId, setDraggedColumnId] = useState<number | null>(null)
  const [columnDropIndex, setColumnDropIndex] = useState<number | null>(null)
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskDropTarget | null>(null)
  const [draggedTaskHeight, setDraggedTaskHeight] = useState<number | null>(null)
  const suppressClicksUntil = useRef(0)
  const ghost = useRef<Ghost | null>(null)
  const transparentImage = useRef<HTMLImageElement | null>(null)

  function hideNativeDragImage(event: DragEvent<HTMLElement>, id: number) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(id))
    if (!transparentImage.current) {
      transparentImage.current = new Image()
      transparentImage.current.src = TRANSPARENT_PIXEL
    }
    event.dataTransfer.setDragImage(transparentImage.current, 0, 0)
  }

  function startGhost(event: DragEvent<HTMLElement>) {
    removeGhost()
    ghost.current = createGhost(event)
    moveGhost(ghost.current, event.clientX, event.clientY)
  }

  function removeGhost() {
    ghost.current?.element.remove()
    ghost.current = null
  }

  function suppressClicks() {
    suppressClicksUntil.current = Date.now() + CLICK_SUPPRESSION_MS
  }

  // ── Columns ──────────────────────────────────────────────────────────────

  function columnDragStart(event: DragEvent<HTMLElement>, columnId: number) {
    if (isColumnDragExcludedTarget(event.target)) {
      event.preventDefault()
      columnDragEnd()
      return
    }
    hideNativeDragImage(event, columnId)
    startGhost(event)
    setDraggedColumnId(columnId)
    setColumnDropIndex(Math.max(0, columns.findIndex((entry) => entry.columnId === columnId)))
    suppressClicks()
  }

  function columnDragEnd() {
    setDraggedColumnId(null)
    setColumnDropIndex(null)
    suppressClicks()
    removeGhost()
  }

  function commitColumnDrop(columnId: number, dropIndex: number) {
    const currentIndex = columns.findIndex((entry) => entry.columnId === columnId)
    columnDragEnd()
    if (currentIndex >= 0 && dropIndex !== currentIndex) {
      onMoveColumn(columnId, dropIndex)
    }
  }

  // ── Tasks ────────────────────────────────────────────────────────────────

  function taskDragStart(event: DragEvent<HTMLElement>, taskId: number) {
    if (!canMoveTasks) {
      event.preventDefault()
      taskDragEnd()
      return
    }
    event.stopPropagation()
    hideNativeDragImage(event, taskId)
    startGhost(event)

    const source = Object.entries(tasksByColumn).find(([, entries]) => entries.some((entry) => entry.taskId === taskId))
    if (source) {
      const columnId = Number(source[0])
      const sourceIndex = source[1].findIndex((entry) => entry.taskId === taskId)
      setDropTarget({ columnId, dropIndex: Math.max(0, sourceIndex) })
    }
    setDraggedTaskHeight(event.currentTarget.getBoundingClientRect().height)
    setDraggedTaskId(taskId)
    suppressClicks()
  }

  function taskDragEnd() {
    setDraggedTaskId(null)
    setDropTarget(null)
    setDraggedTaskHeight(null)
    removeGhost()
  }

  function taskDragOver(event: DragEvent<HTMLElement>, columnId: number) {
    if (!canMoveTasks || draggedTaskId === null) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    moveGhost(ghost.current, event.clientX, event.clientY)
    setDropTarget({
      columnId,
      dropIndex: resolveTaskDropIndex(event.currentTarget, tasksByColumn[columnId] ?? [], draggedTaskId, event.clientY),
    })
  }

  function taskDrop(event: DragEvent<HTMLElement>, columnId: number) {
    if (!canMoveTasks || draggedTaskId === null) return
    event.preventDefault()
    event.stopPropagation()
    const dropIndex = resolveTaskDropIndex(event.currentTarget, tasksByColumn[columnId] ?? [], draggedTaskId, event.clientY)
    commitTaskDrop(draggedTaskId, { columnId, dropIndex })
  }

  /** Indexes count the column's other tasks, as the server does; dropping a task where it was is a no-op. */
  function commitTaskDrop(taskId: number, target: TaskDropTarget) {
    taskDragEnd()
    const source = Object.values(tasksByColumn).flat().find((task) => task.taskId === taskId)
    if (!source) return
    const currentIndex = (tasksByColumn[source.columnId] ?? []).findIndex((task) => task.taskId === taskId)
    if (source.columnId === target.columnId && currentIndex === target.dropIndex) return
    onMoveTask(taskId, target.columnId, target.dropIndex)
  }

  // ── The board row (drops between or beside columns) ──────────────────────

  function rowDragOver(event: DragEvent<HTMLElement>) {
    moveGhost(ghost.current, event.clientX, event.clientY)

    if (canMoveTasks && draggedTaskId !== null) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDropTarget(
        resolveTaskDropTargetFromBoard(event.currentTarget, columns, tasksByColumn, draggedTaskId, event.clientX, event.clientY),
      )
      return
    }

    if (!canMoveColumns || draggedColumnId === null) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setColumnDropIndex(resolveColumnDropIndex(event.currentTarget, columns, draggedColumnId, event.clientX))
  }

  function rowDrop(event: DragEvent<HTMLElement>) {
    if (canMoveTasks && draggedTaskId !== null) {
      event.preventDefault()
      const target = resolveTaskDropTargetFromBoard(
        event.currentTarget,
        columns,
        tasksByColumn,
        draggedTaskId,
        event.clientX,
        event.clientY,
      )
      if (target) {
        commitTaskDrop(draggedTaskId, target)
      } else {
        taskDragEnd()
      }
      return
    }

    if (!canMoveColumns || draggedColumnId === null) return
    event.preventDefault()
    commitColumnDrop(draggedColumnId, resolveColumnDropIndex(event.currentTarget, columns, draggedColumnId, event.clientX))
  }

  // ── Preview ──────────────────────────────────────────────────────────────

  const draggedColumnIndex = draggedColumnId !== null ? columns.findIndex((entry) => entry.columnId === draggedColumnId) : -1
  const columnsForRender =
    draggedColumnId !== null && draggedColumnIndex >= 0
      ? reorderColumnsByIndex(
          columns,
          draggedColumnId,
          Math.max(0, Math.min(columnDropIndex ?? draggedColumnIndex, Math.max(columns.length - 1, 0))),
        )
      : columns
  const tasksForRender =
    draggedTaskId !== null && dropTarget !== null
      ? moveTaskLocally(tasksByColumn, draggedTaskId, dropTarget.columnId, dropTarget.dropIndex)
      : tasksByColumn

  return {
    draggedColumnId,
    draggedTaskId,
    draggedTaskHeight,
    taskDropColumnId: draggedTaskId !== null ? (dropTarget?.columnId ?? null) : null,
    columnsForRender,
    tasksForRender,
    /** Whether a click now is the tail end of a drag rather than a deliberate click. */
    justDragged: () => Date.now() < suppressClicksUntil.current,
    columnDragStart,
    columnDragEnd,
    taskDragStart,
    taskDragEnd,
    taskDragOver,
    taskDrop,
    rowDragOver,
    rowDrop,
  }
}
