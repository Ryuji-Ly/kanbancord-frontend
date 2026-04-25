import { FiPlus } from 'react-icons/fi'
import type { BoardEntry } from '../../../services/boardsService'
import { BoardCard } from './BoardCard'

type BoardCapability = {
  canEditDetails: boolean
  canEditPermissions: boolean
}

type BoardsSectionProps = {
  boards: BoardEntry[]
  loading: boolean
  canCreateBoard: boolean
  boardCapabilities: Record<string, BoardCapability>
  onOpenCreate: () => void
  onOpenSettings: (board: BoardEntry) => void
}

export function BoardsSection({
  boards,
  loading,
  canCreateBoard,
  boardCapabilities,
  onOpenCreate,
  onOpenSettings,
}: BoardsSectionProps) {
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

      {loading ? (
        <div className="kc-loading-state" aria-live="polite" aria-busy="true">
          <span className="kc-spinner" aria-hidden="true" />
          <span className="kc-muted">Loading boards...</span>
        </div>
      ) : boards.length === 0 ? (
        <p className="kc-muted">No boards yet.</p>
      ) : (
        <div className="kc-board-grid">
          {boards.map((board) => {
            const capability = boardCapabilities[String(board.boardId)] ?? {
              canEditDetails: false,
              canEditPermissions: false,
            }
            return (
              <BoardCard
                key={board.boardId}
                board={board}
                canConfigure={capability.canEditDetails || capability.canEditPermissions}
                onOpenSettings={onOpenSettings}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
