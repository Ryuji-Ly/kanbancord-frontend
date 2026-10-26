import { useMemo, useState, type ReactNode } from 'react'
import { t } from '../../../i18n'
import type { BoardEntry } from '../../../services/boardsService'
import { BoardCard } from './BoardCard'
import { CreateBoardButton } from './CreateBoardButton'

type BoardVisibilityFilter = 'active' | 'archived' | 'all'

type BoardsSectionProps = {
  boards: BoardEntry[]
  loading: boolean
  canCreateBoard: boolean
  isPinned: (board: BoardEntry) => boolean
  /** Each board's ⋯ menu. */
  renderActions: (board: BoardEntry) => ReactNode
  onOpenCreate: () => void
  onOpenImport: () => void
  onOpenBoard: (board: BoardEntry) => void
}

export function BoardsSection({
  boards,
  loading,
  canCreateBoard,
  isPinned,
  renderActions,
  onOpenCreate,
  onOpenImport,
  onOpenBoard,
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
          <h3>{t('dashboard.boards.title')}</h3>
          <p className="kc-muted">{t('dashboard.boards.intro')}</p>
        </div>
        {canCreateBoard && <CreateBoardButton onCreate={onOpenCreate} onImport={onOpenImport} />}
      </div>

      <div className="kc-board-toolbar">
        <input
          type="text"
          className="kc-input kc-board-search"
          placeholder={t('dashboard.boards.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('dashboard.boards.searchLabel')}
        />
        <select
          className="kc-input kc-board-filter"
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value as BoardVisibilityFilter)}
          aria-label={t('dashboard.boards.filterLabel')}
        >
          <option value="active">{t('dashboard.boards.active')}</option>
          <option value="archived">{t('dashboard.boards.archived')}</option>
          <option value="all">{t('dashboard.boards.all')}</option>
        </select>
      </div>

      {loading ? (
        <div className="kc-loading-state" aria-live="polite" aria-busy="true">
          <span className="kc-spinner" aria-hidden="true" />
          <span className="kc-muted">{t('dashboard.boards.loading')}</span>
        </div>
      ) : boards.length === 0 ? (
        <p className="kc-muted">{t('dashboard.boards.none')}</p>
      ) : visibleBoards.length === 0 ? (
        <p className="kc-muted">{t('dashboard.boards.noMatch')}</p>
      ) : (
        <div className="kc-board-grid">
          {visibleBoards.map((board) => (
            <BoardCard
              key={board.boardId}
              board={board}
              pinned={isPinned(board)}
              actions={renderActions(board)}
              onOpenBoard={onOpenBoard}
            />
          ))}
        </div>
      )}
    </div>
  )
}
