import type { ReactNode } from 'react'
import { LuPin } from 'react-icons/lu'
import { t } from '../../../i18n'
import type { BoardEntry } from '../../../services/boardsService'

type BoardCardProps = {
  board: BoardEntry
  /** Pinned to the top of the dashboard: marked beside the name. */
  pinned: boolean
  /** The board's ⋯ menu. */
  actions: ReactNode
  /** Shown where boards from several servers are listed together, such as the pinned boards. */
  serverName?: string
  onOpenBoard: (board: BoardEntry) => void
}

export function BoardCard({ board, pinned, actions, serverName, onOpenBoard }: BoardCardProps) {
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
          <h4 className="kc-board-card-title">
            {pinned && (
              <LuPin className="kc-board-card-pin" aria-label={t('dashboard.boards.pinned')} role="img" />
            )}
            {board.name}
          </h4>
          <p className="kc-board-card-meta">
            {serverName && `${serverName} · `}
            {board.isArchived ? t('dashboard.boards.archivedBoard') : t('dashboard.boards.activeBoard')}
          </p>
        </div>
        {actions}
      </div>
      <p className="kc-board-card-description">{board.description?.trim() || t('dashboard.boards.noDescription')}</p>
    </article>
  )
}
