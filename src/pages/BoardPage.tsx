import { useEffect, useState, type DragEvent } from 'react'
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
import { evaluatePermission } from '../services/permissionsService'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { ToastStack } from '../components/dashboard/ToastStack'
import type { HeaderUser, ToastMessage } from '../components/dashboard/types'

type LoadState = 'idle' | 'loading' | 'error' | 'ready'
type ColumnDropEdge = 'before' | 'after'
type ColumnDropIntent = { targetColumnId: number; edge: ColumnDropEdge }

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
  const [suppressEditUntil, setSuppressEditUntil] = useState(0)

  const isBoardArchived = Boolean(board?.isArchived)
  const canEditColumnsOnPage = canEditColumn && !isBoardArchived
  const canCreateColumnsOnPage = canCreateColumn && !isBoardArchived
  const canDeleteColumnsOnPage = canDeleteColumn && !isBoardArchived
  const canMoveColumnsOnPage = canEditColumn && canMoveColumn && !isBoardArchived

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
        const [boardData, columnData, editPerm, createPerm, deletePerm, movePerm] = await Promise.all([
          fetchBoardById(token, serverId, userId, boardId),
          fetchBoardColumns(token, serverId, boardId, userId),
          evaluatePermission(token, serverId, userId, 'EDIT_COLUMN', boardId),
          evaluatePermission(token, serverId, userId, 'CREATE_COLUMN', boardId),
          evaluatePermission(token, serverId, userId, 'DELETE_COLUMN', boardId),
          evaluatePermission(token, serverId, userId, 'MOVE_COLUMN', boardId),
        ])

        if (cancelled) return
        setBoard(boardData)
        setColumns(columnData)
        setCanEditColumn(editPerm.allowed && !boardData.isArchived)
        setCanCreateColumn(createPerm.allowed && !boardData.isArchived)
        setCanDeleteColumn(deletePerm.allowed && !boardData.isArchived)
        setCanMoveColumn(movePerm.allowed && !boardData.isArchived)
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

              return (
                <article
                  key={column.columnId}
                  data-column-id={column.columnId}
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
                  <p className="kc-muted">Tasks and interactions coming next.</p>
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
                Delete <strong>{deleteTargetColumn.name}</strong>? This cannot be undone. The
                column must be empty before it can be deleted.
              </p>
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
