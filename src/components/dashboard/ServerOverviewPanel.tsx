import { FiSettings } from 'react-icons/fi'
import { t } from '../../i18n'
import type { DiscordGuild } from '../../types/auth'
import type { BoardEntry } from '../../services/boardsService'
import type { BoardCapability } from './types'
import { BoardsSection } from './boards/BoardsSection'

type ServerOverviewPanelProps = {
  selectedServer: DiscordGuild | null
  boards: BoardEntry[]
  boardsLoading: boolean
  canCreateBoard: boolean
  boardCapabilities: Record<string, BoardCapability>
  /** Opens the server settings; the cog is shown only when given. */
  onOpenSettings?: () => void
  onOpenCreateBoard: () => void
  onOpenBoard: (board: BoardEntry) => void
  onOpenBoardSettings: (board: BoardEntry) => void
}

export function ServerOverviewPanel({
  selectedServer,
  boards,
  boardsLoading,
  canCreateBoard,
  boardCapabilities,
  onOpenSettings,
  onOpenCreateBoard,
  onOpenBoard,
  onOpenBoardSettings,
}: ServerOverviewPanelProps) {
  if (!selectedServer) return null

  return (
    <section className="kc-panel">
      <div className="kc-server-panel-header">
        <div>
          <h2>{selectedServer.name}</h2>
          <p className="kc-muted">{t('dashboard.serverOverview')}</p>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            className="kc-icon-btn kc-server-settings-btn"
            aria-label={t('dashboard.serverSettings')}
            title={t('dashboard.serverSettings')}
            onClick={onOpenSettings}
          >
            <FiSettings aria-hidden="true" />
          </button>
        )}
      </div>

      <BoardsSection
        boards={boards}
        loading={boardsLoading}
        canCreateBoard={canCreateBoard}
        boardCapabilities={boardCapabilities}
        onOpenCreate={onOpenCreateBoard}
        onOpenBoard={onOpenBoard}
        onOpenSettings={onOpenBoardSettings}
      />
    </section>
  )
}
