import { FiSettings } from 'react-icons/fi'
import { t } from '../../../i18n'
import type { BoardEntry } from '../../../services/boardsService'

type BoardCardProps = {
  board: BoardEntry
  canConfigure: boolean
  onOpenBoard: (board: BoardEntry) => void
  onOpenSettings: (board: BoardEntry) => void
}

export function BoardCard({ board, canConfigure, onOpenBoard, onOpenSettings }: BoardCardProps) {
  return (
    <article
      className="kc-board-card kc-board-card--clickable"
      role="button"
      tabIndex={0}
      onClick={() => onOpenBoard(board)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenBoard(board)
        }
      }}
    >
      <div className="kc-board-card-head">
        <div>
          <h4 className="kc-board-card-title">{board.name}</h4>
          <p className="kc-board-card-meta">{board.isArchived ? t('dashboard.boards.archivedBoard') : t('dashboard.boards.activeBoard')}</p>
        </div>
        {canConfigure && (
          <button
            type="button"
            className="kc-btn kc-btn-ghost kc-board-card-settings"
            aria-label={t('dashboard.boards.configure', { name: board.name })}
            title={t('dashboard.boards.configure', { name: board.name })}
            onClick={(e) => {
              e.stopPropagation()
              onOpenSettings(board)
            }}
          >
            <FiSettings aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="kc-board-card-description">{board.description?.trim() || t('dashboard.boards.noDescription')}</p>
    </article>
  )
}
