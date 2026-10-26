import { useQueries } from '@tanstack/react-query'
import { LuPin, LuPinOff } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { t } from '../../i18n'
import { fetchBoards } from '../../services/boardsService'
import type { DiscordGuild } from '../../types/auth'
import { usePinnedBoards } from '../../features/dashboard/usePinnedBoards'
import { serverKeys } from '../../features/server/serverQueries'
import { BoardCard } from './boards/BoardCard'

/**
 * The boards the user pinned, from every server, above the selected server's overview: the same
 * cards as a server's board list, each naming its server, so the boards they work on most are one
 * click away whichever server is open below. A pin whose board was deleted, or in a server the user
 * or the bot has left, is simply not shown.
 */
export function PinnedBoardsRow({ servers }: { servers: DiscordGuild[] }) {
  const navigate = useNavigate()
  const { pins, togglePin } = usePinnedBoards()
  const serverIds = [...new Set(pins.map((pin) => pin.serverId))].filter((id) => servers.some((server) => server.id === id))
  // The same cache as each server's board list, so opening a server shows its boards at once.
  const boardLists = useQueries({
    queries: serverIds.map((serverId) => ({
      queryKey: serverKeys.boards(serverId),
      queryFn: () => fetchBoards(serverId),
    })),
  })
  const boardsByServer = new Map(serverIds.map((serverId, index) => [serverId, boardLists[index]?.data ?? []]))

  const shown = pins.flatMap((pin) => {
    const server = servers.find((entry) => entry.id === pin.serverId)
    const board = boardsByServer.get(pin.serverId)?.find((entry) => String(entry.boardId) === pin.boardId)
    return server && board ? [{ pin, server, board }] : []
  })
  if (shown.length === 0) return null

  return (
    <section className="kc-panel kc-pinned-boards" aria-labelledby="kc-pinned-title">
      <h3 id="kc-pinned-title" className="kc-pinned-title">
        <LuPin aria-hidden="true" />
        {t('dashboard.pinned.title')}
      </h3>
      <div className="kc-board-grid">
        {shown.map(({ pin, server, board }) => (
          <BoardCard
            key={`${pin.serverId}:${pin.boardId}`}
            board={board}
            pinned={false}
            serverName={server.name}
            onOpenBoard={() => navigate(`/boards/${board.boardId}?serverId=${encodeURIComponent(server.id)}`)}
            actions={
              <button
                type="button"
                className="kc-btn kc-btn-ghost kc-actions-menu-btn"
                aria-label={t('dashboard.pinned.unpin', { name: board.name })}
                title={t('dashboard.pinned.unpin', { name: board.name })}
                onClick={(event) => {
                  event.stopPropagation()
                  togglePin(pin.serverId, pin.boardId)
                }}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <LuPinOff aria-hidden="true" />
              </button>
            }
          />
        ))}
      </div>
    </section>
  )
}
