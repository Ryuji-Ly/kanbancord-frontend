import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { t } from '../../i18n'
import { BoardModal } from '../../components/dashboard/boards/BoardModal'
import { mergeBoardPermissionDrafts } from '../../components/dashboard/boards/boardPermissionDraft'
import { fetchScopedPermissions, type PermissionEntry } from '../../services/permissionsService'
import { AccessCheckPanel } from '../accessCheck/AccessCheckPanel'
import { boardSettingsAccess } from '../board/boardModel'
import { boardKeys, useBoardCatalogMutations, useBoardSnapshot } from '../board/boardQueries'
import { actorRankWeight } from '../dashboard/dashboardModel'
import { useServerMutations } from '../dashboard/serverMutations'
import {
  useServerAccess,
  useServerCatalog,
  useServerMembers,
  useServerPermissions,
  useServerRoles,
} from '../server/serverQueries'
import { BoardFeaturesSettings } from './BoardFeaturesSettings'
import { BoardNotificationsSettings } from './BoardNotificationsSettings'
import { BoardThreadsSettings } from './BoardThreadsSettings'
import { LabelsSettings } from './LabelsSettings'
import { PrioritiesSettings } from './PrioritiesSettings'

type BoardSettingsDialogProps = {
  serverId: string
  boardId: string
  onClose: () => void
  /** The board no longer exists; the caller should leave anything showing it. */
  onDeleted: () => void
  showToast: (text: string, type?: 'success' | 'error') => void
  showError: (text: string) => void
}

/**
 * A board's settings: details, permissions, simple mode, notifications, checking who may do what,
 * labels, priority levels, and archiving or deleting it.
 * The same dialog opens from the board page and from the dashboard. Each part shows only what the
 * user may change; simple mode, labels and priorities save as they change, details and permissions
 * on Save.
 */
export function BoardSettingsDialog({ serverId, boardId, onClose, onDeleted, showToast, showError }: BoardSettingsDialogProps) {
  const queryClient = useQueryClient()
  const snapshotQuery = useBoardSnapshot(serverId, boardId)
  const snapshot = snapshotQuery.data
  const access = boardSettingsAccess(snapshot?.permissions, snapshot?.features)
  const showPermissions =
    access.editPermissions || (Boolean(snapshot?.features.PERMISSIONS) && Boolean(snapshot?.board.isArchived))

  const serverAccess = useServerAccess(serverId)
  const serverRules = useServerPermissions(serverId)
  const roles = useServerRoles(serverId, showPermissions)
  const members = useServerMembers(serverId, showPermissions)
  const catalog = useServerCatalog(serverId, showPermissions)
  const boardRules = useQuery({
    queryKey: [...boardKeys.all(serverId, boardId), 'rules'],
    queryFn: () => fetchScopedPermissions(serverId, 'BOARD', boardId),
    enabled: showPermissions,
  })

  const serverMutations = useServerMutations(serverId)
  const catalogMutations = useBoardCatalogMutations(serverId, boardId)

  const permissionsLoading = showPermissions && (serverRules.isPending || boardRules.isPending)
  const loading = snapshotQuery.isPending || permissionsLoading
  const initialPermissions: PermissionEntry[] =
    showPermissions && serverRules.data && boardRules.data ? mergeBoardPermissionDrafts(serverRules.data, boardRules.data) : []
  const saving =
    serverMutations.saveBoard.isPending || serverMutations.setBoardArchived.isPending || serverMutations.removeBoard.isPending

  function refreshBoard() {
    void queryClient.invalidateQueries({ queryKey: boardKeys.all(serverId, boardId) })
  }

  function close() {
    if (!saving) onClose()
  }

  const loadError = snapshotQuery.isError ? readableError(snapshotQuery.error, t('settings.board.loadFailed')) : ''
  useEffect(() => {
    if (!loadError) return
    showError(loadError)
    onClose()
  }, [loadError, showError, onClose])
  if (loadError) return null

  const board = snapshot?.board ?? null
  const archived = Boolean(board?.isArchived)

  return (
    <BoardModal
      key={loading ? 'loading' : 'ready'}
      show
      mode="edit"
      board={board}
      initialName={board?.name ?? ''}
      initialDescription={board?.description ?? ''}
      initialPermissions={initialPermissions}
      catalogEntries={catalog.data ?? []}
      serverRoles={roles.data ?? []}
      serverMembers={members.data ?? []}
      actorRankWeight={actorRankWeight(serverAccess.data)}
      canEditDetails={access.editDetails}
      canEditPermissions={access.editPermissions}
      canArchive={access.archive}
      canDelete={access.delete}
      loading={loading}
      saving={saving}
      onClose={close}
      onSave={(payload) => {
        if (access.editDetails && !payload.name) {
          showError(t('dashboard.workspace.nameRequired'))
          return
        }
        serverMutations.saveBoard.mutate(
          {
            boardId,
            details: access.editDetails ? { name: payload.name, description: payload.description, columnNames: [] } : undefined,
            permissions: access.editPermissions ? payload.permissions : undefined,
          },
          {
            onSuccess: () => {
              refreshBoard()
              showToast(t('dashboard.workspace.boardUpdated'), 'success')
              onClose()
            },
            onError: (error) =>
              showError(t('dashboard.workspace.saveBoardFailed', { error: readableError(error, t('board.page.unknownError')) })),
          },
        )
      }}
      onArchive={(nextArchived) =>
        serverMutations.setBoardArchived.mutate(
          { boardId, archived: nextArchived },
          {
            onSuccess: () => {
              refreshBoard()
              showToast(nextArchived ? t('dashboard.workspace.boardArchived') : t('dashboard.workspace.boardRestored'), 'success')
              onClose()
            },
            onError: (error) =>
              showError(
                t(nextArchived ? 'dashboard.workspace.archiveFailed' : 'dashboard.workspace.restoreFailed', {
                  error: readableError(error, t('board.page.unknownError')),
                }),
              ),
          },
        )
      }
      onDelete={() =>
        serverMutations.removeBoard.mutate(boardId, {
          onSuccess: () => {
            showToast(t('dashboard.workspace.boardDeleted'), 'success')
            onDeleted()
          },
          onError: (error) =>
            showError(t('dashboard.workspace.deleteBoardFailed', { error: readableError(error, t('board.page.unknownError')) })),
        })
      }
    >
      {snapshot && !archived && access.editDetails && (
        <BoardFeaturesSettings serverId={serverId} boardId={boardId} snapshot={snapshot} />
      )}
      {snapshot && !archived && access.editDetails && <BoardNotificationsSettings serverId={serverId} boardId={boardId} />}
      {snapshot && !archived && access.editDetails && <BoardThreadsSettings serverId={serverId} boardId={boardId} />}
      {snapshot && snapshot.permissions.EDIT_BOARD_PERMISSIONS?.allowed && (
        <section className="kc-board-modal-section">
          <div className="kc-board-modal-section-head">
            <h4>{t('dashboard.settings.checkAccess')}</h4>
          </div>
          <AccessCheckPanel serverId={serverId} board={{ boardId, name: snapshot.board.name }} />
        </section>
      )}
      {snapshot && !archived && (access.createLabel || access.editLabel || access.deleteLabel) && (
        <LabelsSettings
          labels={snapshot.labels}
          taskLabels={snapshot.taskLabels}
          canCreate={access.createLabel}
          canEdit={access.editLabel}
          canDelete={access.deleteLabel}
          mutations={catalogMutations}
        />
      )}
      {snapshot && !archived && access.managePriorities && (
        <PrioritiesSettings
          priorities={snapshot.priorities}
          tasks={snapshot.tasks}
          canManage={access.managePriorities}
          mutations={catalogMutations}
        />
      )}
    </BoardModal>
  )
}
