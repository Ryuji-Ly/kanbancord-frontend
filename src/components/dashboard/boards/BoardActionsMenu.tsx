import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { FiArchive, FiBell, FiDownload, FiMoreHorizontal, FiRotateCcw, FiSettings, FiTrash2, FiUpload, FiX } from 'react-icons/fi'
import { LuPin, LuPinOff } from 'react-icons/lu'
import { readableError } from '../../../api/http'
import { t } from '../../../i18n'
import { Trans } from '../../../i18n/Trans'
import { ConfirmDialog } from '../../../features/board/components/ConfirmDialog'
import { useBoardSnapshot } from '../../../features/board/boardQueries'
import { BoardExportSettings } from '../../../features/boardTransfer/BoardExportSettings'
import { ImportTasksDialog } from '../../../features/boardTransfer/ImportTasksDialog'
import { useServerMutations } from '../../../features/dashboard/serverMutations'
import { usePinnedBoards } from '../../../features/dashboard/usePinnedBoards'
import { MyBoardRemindersDialog } from '../../../features/notifications/RemindersSettings'
import type { BoardEntry } from '../../../services/boardsService'

type BoardActionsMenuProps = {
  serverId: string
  board: BoardEntry
  /** Whether the board settings would show this user anything they may change. */
  canOpenSettings: boolean
  canArchive: boolean
  canDelete: boolean
  /** May add tasks, so may import them from a list or a file. */
  canImport: boolean
  onOpenSettings: () => void
  /** The board was archived or restored. */
  onChanged?: () => void
  /** The board no longer exists; the caller should leave anything showing it. */
  onDeleted?: () => void
  showToast: (text: string, type?: 'success' | 'error') => void
  showError: (text: string) => void
}

type Dialog = 'export' | 'import' | 'archive' | 'delete' | 'reminders'

/**
 * Everything one can do with a board besides opening it, behind one ⋯ button: pinning it to the
 * dashboard, its settings, exporting it, importing tasks into it, and archiving or deleting it. The settings stay about
 * configuring the board; the rest opens its own small dialog. Pinning is personal, so everyone who
 * can see the board gets the menu.
 */
export function BoardActionsMenu({
  serverId,
  board,
  canOpenSettings,
  canArchive,
  canDelete,
  canImport,
  onOpenSettings,
  onChanged,
  onDeleted,
  showToast,
  showError,
}: BoardActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const { isPinned, togglePin, ready } = usePinnedBoards()
  const pinned = isPinned(serverId, board.boardId)
  const mutations = useServerMutations(serverId)
  const busy = mutations.setBoardArchived.isPending || mutations.removeBoard.isPending

  // The menu closes on a click elsewhere and with Escape.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (action: () => void) => (event: ReactMouseEvent) => {
    event.stopPropagation()
    setOpen(false)
    action()
  }

  function setArchived() {
    const archived = !board.isArchived
    mutations.setBoardArchived.mutate(
      { boardId: String(board.boardId), archived },
      {
        onSuccess: () => {
          setDialog(null)
          onChanged?.()
          showToast(archived ? t('dashboard.workspace.boardArchived') : t('dashboard.workspace.boardRestored'), 'success')
        },
        onError: (error) =>
          showError(
            t(archived ? 'dashboard.workspace.archiveFailed' : 'dashboard.workspace.restoreFailed', {
              error: readableError(error, t('board.page.unknownError')),
            }),
          ),
      },
    )
  }

  function remove() {
    mutations.removeBoard.mutate(String(board.boardId), {
      onSuccess: () => {
        setDialog(null)
        if (pinned) togglePin(serverId, board.boardId)
        showToast(t('dashboard.workspace.boardDeleted'), 'success')
        onDeleted?.()
      },
      onError: (error) =>
        showError(t('dashboard.workspace.deleteBoardFailed', { error: readableError(error, t('board.page.unknownError')) })),
    })
  }

  return (
    // Clicks and keys here, and in the dialogs opened from here, are not the card's: they do not open the board.
    <div className="kc-actions-menu" ref={wrapRef} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="kc-btn kc-btn-ghost kc-actions-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('dashboard.boards.actions', { name: board.name })}
        title={t('dashboard.boards.actions', { name: board.name })}
        onClick={() => setOpen((current) => !current)}
      >
        <FiMoreHorizontal aria-hidden="true" />
      </button>

      {open && (
        <ul className="kc-actions-menu-list" role="menu">
          {ready && (
            <li role="none">
              <button type="button" role="menuitem" className="kc-actions-menu-item" onClick={choose(() => togglePin(serverId, board.boardId))}>
                {pinned ? <LuPinOff aria-hidden="true" /> : <LuPin aria-hidden="true" />}
                {pinned ? t('dashboard.boards.unpin') : t('dashboard.boards.pin')}
              </button>
            </li>
          )}
          {canOpenSettings && (
            <li role="none">
              <button type="button" role="menuitem" className="kc-actions-menu-item" onClick={choose(onOpenSettings)}>
                <FiSettings aria-hidden="true" />
                {t('dashboard.boards.settings')}
              </button>
            </li>
          )}
          {!board.isArchived && (
            <li role="none">
              <button type="button" role="menuitem" className="kc-actions-menu-item" onClick={choose(() => setDialog('reminders'))}>
                <FiBell aria-hidden="true" />
                {t('notifications.reminders.menu')}
              </button>
            </li>
          )}
          <li role="none">
            <button type="button" role="menuitem" className="kc-actions-menu-item" onClick={choose(() => setDialog('export'))}>
              <FiDownload aria-hidden="true" />
              {t('dashboard.boards.export')}
            </button>
          </li>
          {canImport && !board.isArchived && (
            <li role="none">
              <button type="button" role="menuitem" className="kc-actions-menu-item" onClick={choose(() => setDialog('import'))}>
                <FiUpload aria-hidden="true" />
                {t('dashboard.boards.importTasks')}
              </button>
            </li>
          )}
          {canArchive && (
            <li role="none">
              <button type="button" role="menuitem" className="kc-actions-menu-item" onClick={choose(() => setDialog('archive'))}>
                {board.isArchived ? <FiRotateCcw aria-hidden="true" /> : <FiArchive aria-hidden="true" />}
                {board.isArchived ? t('dashboard.boardModal.restore') : t('dashboard.boardModal.archive')}
              </button>
            </li>
          )}
          {canDelete && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="kc-actions-menu-item kc-actions-menu-item--danger"
                onClick={choose(() => setDialog('delete'))}
              >
                <FiTrash2 aria-hidden="true" />
                {t('dashboard.boardModal.delete')}
              </button>
            </li>
          )}
        </ul>
      )}

      {dialog === 'reminders' && (
        <MyBoardRemindersDialog
          serverId={serverId}
          boardId={String(board.boardId)}
          boardName={board.name}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'export' && <ExportDialog serverId={serverId} board={board} onClose={() => setDialog(null)} />}
      {dialog === 'import' && (
        <ImportTasksDialog
          serverId={serverId}
          boardId={String(board.boardId)}
          boardName={board.name}
          onClose={() => setDialog(null)}
          showToast={showToast}
        />
      )}

      {dialog === 'archive' && (
        <ConfirmDialog
          title={board.isArchived ? t('dashboard.boardModal.restore') : t('dashboard.boardModal.archive')}
          confirmLabel={board.isArchived ? t('dashboard.boardModal.restore') : t('dashboard.boardModal.archive')}
          busyLabel={t('common.applying')}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={setArchived}
        >
          <p className="kc-modal-confirm-desc">
            {board.isArchived
              ? t('dashboard.boardModal.restoreConfirm', { name: board.name })
              : t('dashboard.boardModal.archiveConfirm', { name: board.name })}
          </p>
        </ConfirmDialog>
      )}

      {dialog === 'delete' && (
        <ConfirmDialog
          title={t('dashboard.boardModal.delete')}
          confirmLabel={t('dashboard.boardModal.delete')}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={remove}
        >
          <p className="kc-modal-confirm-desc">
            <Trans k="dashboard.boardModal.deleteConfirm" values={{ name: board.name }} />
          </p>
        </ConfirmDialog>
      )}
    </div>
  )
}

/** Exporting the board as a file, in a dialog of its own. */
function ExportDialog({ serverId, board, onClose }: { serverId: string; board: BoardEntry; onClose: () => void }) {
  const snapshotQuery = useBoardSnapshot(serverId, String(board.boardId))
  const snapshot = snapshotQuery.data

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="kc-modal-overlay" role="dialog" aria-modal="true" aria-label={board.name} onClick={onClose}>
      <div className="kc-modal kc-board-export-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title">{board.name}</h3>
          <button type="button" className="kc-modal-close" aria-label={t('common.close')} onClick={onClose}>
            <FiX aria-hidden="true" />
          </button>
        </div>
        <div className="kc-modal-body">
          {snapshotQuery.isPending ? (
            <div className="kc-loading-state" aria-live="polite" aria-busy="true">
              <span className="kc-spinner" aria-hidden="true" />
            </div>
          ) : snapshot?.permissions.VIEW_TASK?.allowed ? (
            <BoardExportSettings serverId={serverId} boardId={String(board.boardId)} snapshot={snapshot} />
          ) : (
            <p className="kc-muted">{t('dashboard.boards.exportNotAllowed')}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
