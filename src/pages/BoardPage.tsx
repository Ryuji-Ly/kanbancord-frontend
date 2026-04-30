import { useEffect, useState } from 'react'
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

  const isBoardArchived = Boolean(board?.isArchived)
  const canEditColumnsOnPage = canEditColumn && !isBoardArchived
  const canCreateColumnsOnPage = canCreateColumn && !isBoardArchived
  const canDeleteColumnsOnPage = canDeleteColumn && !isBoardArchived

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
        const [boardData, columnData, editPerm, createPerm, deletePerm] = await Promise.all([
          fetchBoardById(token, serverId, userId, boardId),
          fetchBoardColumns(token, serverId, boardId, userId),
          evaluatePermission(token, serverId, userId, 'EDIT_COLUMN', boardId),
          evaluatePermission(token, serverId, userId, 'CREATE_COLUMN', boardId),
          evaluatePermission(token, serverId, userId, 'DELETE_COLUMN', boardId),
        ])

        if (cancelled) return
        setBoard(boardData)
        setColumns(columnData)
        setCanEditColumn(editPerm.allowed && !boardData.isArchived)
        setCanCreateColumn(createPerm.allowed && !boardData.isArchived)
        setCanDeleteColumn(deletePerm.allowed && !boardData.isArchived)
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
      position: columns.length,
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

  return (
    <>
      <div className="kc-dashboard-root">
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
          <section className="kc-board-page-columns" aria-label="Board columns">
            {openMenuColumnId !== null && (
              <div
                className="kc-column-menu-backdrop"
                onClick={() => setOpenMenuColumnId(null)}
              />
            )}

            {columns.length === 0 && !canCreateColumnsOnPage && (
              <p className="kc-muted">No columns found on this board.</p>
            )}

            {columns.map((column) => (
              <article key={column.columnId} className="kc-panel kc-board-column-card">
                <div className="kc-column-header">
                  {canEditColumnsOnPage && editingColumnId === column.columnId ? (
                    <input
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
                        setEditingColumnId(column.columnId)
                        setEditingColumnName(column.name)
                      }}
                    >
                      {column.name}
                    </h3>
                  )}

                  {canDeleteColumnsOnPage && (
                    <div className="kc-column-menu-wrap">
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

                <p className="kc-muted">Tasks and interactions coming next.</p>
              </article>
            ))}

            {canCreateColumnsOnPage &&
              (addingColumn ? (
                <div className="kc-panel kc-board-column-card">
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
