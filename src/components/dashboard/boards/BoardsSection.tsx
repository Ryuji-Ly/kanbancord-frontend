import { useMemo, useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import type { BoardEntry } from '../../../services/boardsService'
import { BoardCard } from './BoardCard'

type BoardVisibilityFilter = 'active' | 'archived' | 'all'

type BoardCapability = {
  canEditDetails: boolean
  canEditPermissions: boolean
  canArchive: boolean
  canDelete: boolean
}

type BoardsSectionProps = {
  boards: BoardEntry[]
  loading: boolean
  canCreateBoard: boolean
  boardCapabilities: Record<string, BoardCapability>
  onOpenCreate: () => void
  onOpenBoard: (board: BoardEntry) => void
  onOpenSettings: (board: BoardEntry) => void
}

export function BoardsSection({
  boards,
  loading,
  canCreateBoard,
  boardCapabilities,
  onOpenCreate,
  onOpenBoard,
  onOpenSettings,
}: BoardsSectionProps) {
  const [search, setSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<BoardVisibilityFilter>('active')

  const visibleBoards = useMemo(() => {
    const query = search.trim().toLowerCase()
    const sortedBoards = [...boards].sort((left, right) => Number(left.isArchived) - Number(right.isArchived))

    return sortedBoards.filter((board) => {
      if (visibilityFilter === 'active' && board.isArchived) return false
      if (visibilityFilter === 'archived' && !board.isArchived) return false
      if (!query) return true

      return (
        board.name.toLowerCase().includes(query) ||
        (board.description?.toLowerCase().includes(query) ?? false)
      )
    })
  }, [boards, search, visibilityFilter])

  return (
    <div className="kc-board-section">
      <div className="kc-board-section-header">
        <div>
          <h3>Boards</h3>
          <p className="kc-muted">Create and configure kanban boards for this server.</p>
        </div>
        {canCreateBoard && (
          <button type="button" className="kc-btn kc-btn-primary" onClick={onOpenCreate}>
            <FiPlus aria-hidden="true" /> Create Board
          </button>
        )}
      </div>

      <div className="kc-board-toolbar">
        <input
          type="text"
          className="kc-input kc-board-search"
          placeholder="Search boards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search boards"
        />
        <select
          className="kc-input kc-board-filter"
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value as BoardVisibilityFilter)}
          aria-label="Filter boards by archived status"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="kc-loading-state" aria-live="polite" aria-busy="true">
          <span className="kc-spinner" aria-hidden="true" />
          <span className="kc-muted">Loading boards...</span>
        </div>
      ) : boards.length === 0 ? (
        <p className="kc-muted">No boards yet.</p>
      ) : visibleBoards.length === 0 ? (
        <p className="kc-muted">No boards match the current search/filter.</p>
      ) : (
        <div className="kc-board-grid">
          {visibleBoards.map((board) => {
            const capability = boardCapabilities[String(board.boardId)] ?? {
              canEditDetails: false,
              canEditPermissions: false,
              canArchive: false,
              canDelete: false,
            }
            return (
              <BoardCard
                key={board.boardId}
                board={board}
                onOpenBoard={onOpenBoard}
                canConfigure={
                  capability.canEditDetails ||
                  capability.canEditPermissions ||
                  capability.canArchive ||
                  capability.canDelete
                }
                onOpenSettings={onOpenSettings}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
