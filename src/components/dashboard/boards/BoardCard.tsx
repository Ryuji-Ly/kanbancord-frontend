import { FiSettings } from 'react-icons/fi'
import type { BoardEntry } from '../../../services/boardsService'

type BoardCardProps = {
  board: BoardEntry
  canConfigure: boolean
  onOpenSettings: (board: BoardEntry) => void
}

export function BoardCard({ board, canConfigure, onOpenSettings }: BoardCardProps) {
  return (
    <article className="kc-board-card">
      <div className="kc-board-card-head">
        <div>
          <h4 className="kc-board-card-title">{board.name}</h4>
          <p className="kc-board-card-meta">{board.isArchived ? 'Archived board' : 'Active board'}</p>
        </div>
        {canConfigure && (
          <button
            type="button"
            className="kc-btn kc-btn-ghost kc-board-card-settings"
            aria-label={`Configure ${board.name}`}
            title={`Configure ${board.name}`}
            onClick={() => onOpenSettings(board)}
          >
            <FiSettings aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="kc-board-card-description">{board.description?.trim() || 'No description set.'}</p>
    </article>
  )
}
