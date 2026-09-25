import { useDeferredValue, useMemo, useState } from 'react'
import { ServerNotificationsSettings } from '../notifications/ServerNotificationsSettings'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { BoardEntry } from '../../services/boardsService'
import {
  DISCORD_FLAG_NAMES,
  DISCORD_PERM_IMPORTANCE,
  KANBAN_PERM_INFO,
  fetchServerPermissions,
  groupPermissionsByGrantedTo,
  type PermissionEntry,
  type SubjectLookups,
} from '../../services/permissionsService'
import type { DiscordGuild } from '../../types/auth'
import { AddEntryModal } from '../../components/dashboard/AddEntryModal'
import { BoardModal } from '../../components/dashboard/boards/BoardModal'
import { BoardSettingsDialog } from '../boardSettings/BoardSettingsDialog'
import { AuditLogSection } from '../audit/AuditLogSection'
import { FeaturesSettings } from '../serverSettings/FeaturesSettings'
import { NO_FEATURES } from '../../services/featuresService'
import { ServerSettingsDialog, type ServerSettingsSection } from '../serverSettings/ServerSettingsDialog'
import { PermissionsSection } from '../../components/dashboard/permissions/PermissionsSection'
import { buildInheritedBoardPermissionDrafts } from '../../components/dashboard/boards/boardPermissionDraft'
import { DeleteGroupModal } from '../../components/dashboard/DeleteGroupModal'
import { permissionRankWeight } from '../../components/dashboard/permissionRank'
import { ServerOverviewPanel } from '../../components/dashboard/ServerOverviewPanel'
import type { BoardModalConfig, DeleteGroupTarget } from '../../components/dashboard/types'
import {
  serverKeys,
  useServerAccess,
  useServerBoards,
  useServerCatalog,
  useServerMembers,
  useServerPermissions,
  useServerFeatures,
  useServerRealtime,
  useServerRoles,
} from '../server/serverQueries'
import { actorRankWeight, boardCapabilities } from './dashboardModel'
import { useServerMutations } from './serverMutations'

type RuleState = 'ALLOW' | 'DENY'

/** Users may hand out only permissions ranked below their own, unless they are admins. */
function canGrant(rankWeight: number, key: string): boolean {
  return rankWeight === 1000 || rankWeight > permissionRankWeight(key)
}

type BoardEditor = {
  config: BoardModalConfig
  /** Draft rules the modal starts from: inherited server rules, with the board's own overrides applied. */
  permissions: PermissionEntry[]
  loading: boolean
}

type ServerWorkspaceProps = {
  serverId: string
  server: DiscordGuild
  showError: (text: string) => void
  showToast: (text: string, type?: 'success' | 'error') => void
}

/**
 * Everything shown for the selected server: its boards and its permission rules, with the dialogs
 * to change them. Render with `key={serverId}` so switching servers starts from a clean slate.
 */
export function ServerWorkspace({ serverId, server, showError, showToast }: ServerWorkspaceProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const boardsQuery = useServerBoards(serverId)
  const accessQuery = useServerAccess(serverId)
  const permissionsQuery = useServerPermissions(serverId)
  const rolesQuery = useServerRoles(serverId)
  const membersQuery = useServerMembers(serverId)
  const catalogQuery = useServerCatalog(serverId)
  const mutations = useServerMutations(serverId)
  const featuresQuery = useServerFeatures(serverId)
  useServerRealtime(serverId, true)

  const serverPermissions = permissionsQuery.data
  const serverRoles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data])
  const serverMembers = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const catalogEntries = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data])
  const access = accessQuery.data
  const rankWeight = actorRankWeight(access)
  const features = featuresQuery.data ?? NO_FEATURES
  const capabilities = useMemo(() => boardCapabilities(access, featuresQuery.data), [access, featuresQuery.data])

  // ── Permission list ─────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [permFilter, setPermFilter] = useState('')
  const [openAddGroupKey, setOpenAddGroupKey] = useState('')
  const [newPermId, setNewPermId] = useState<number | ''>('')
  const [newPermState, setNewPermState] = useState<RuleState>('ALLOW')
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<DeleteGroupTarget | null>(null)

  const filteredGroups = useMemo(() => {
    if (!serverPermissions) return []
    const lookups: SubjectLookups = {
      roles: new Map(serverRoles.map((role) => [role.roleId, role.name])),
      members: new Map(serverMembers.map((member) => [member.userId, member.displayName ?? member.nickname ?? member.userId])),
    }
    const groups = groupPermissionsByGrantedTo(serverPermissions, lookups)
    const query = permFilter.trim().toLowerCase()
    if (!query) return groups
    const usernames = new Map(serverMembers.map((member) => [member.userId, member.username ?? '']))
    return groups.filter(
      (group) =>
        group.subjectDisplay.toLowerCase().includes(query) ||
        String(group.subjectId).includes(query) ||
        (group.subjectType === 'USER' && (usernames.get(group.subjectId)?.toLowerCase().includes(query) ?? false)) ||
        group.permissions.some((permission) =>
          (KANBAN_PERM_INFO[permission.kanbanPermissionKey]?.name ?? permission.kanbanPermissionKey)
            .toLowerCase()
            .includes(query),
        ),
    )
  }, [serverPermissions, permFilter, serverRoles, serverMembers])

  function toggleGroup(groupKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  function toggleRuleState(permissionId: number, currentState: RuleState) {
    const state = currentState === 'ALLOW' ? 'DENY' : 'ALLOW'
    mutations.setRuleState.mutate(
      { permissionId, state },
      {
        onSuccess: () => showToast(`Permission state changed to ${state}`, 'success'),
        onError: (error) => showError(`Failed to update permission: ${error}`),
      },
    )
  }

  function removeRule(permissionId: number) {
    mutations.removeRule.mutate(permissionId, {
      onSuccess: () => showToast('Permission removed', 'success'),
      onError: (error) => showError(`Failed to delete permission: ${error}`),
    })
  }

  function removeGroup() {
    if (!deleteGroupTarget) return
    mutations.removeRules.mutate(
      deleteGroupTarget.permissions.map((permission) => permission.id),
      {
        onSuccess: () => {
          showToast(`Removed all permissions for ${deleteGroupTarget.subjectDisplay}`, 'success')
          setDeleteGroupTarget(null)
        },
        onError: (error) => showError(`Failed to delete permission entry: ${error}`),
      },
    )
  }

  function openInlineAdd(subjectType: string, subjectId: string, existingKeys: string[]) {
    const available = catalogEntries.filter((entry) => !existingKeys.includes(entry.key) && canGrant(rankWeight, entry.key))
    if (available.length === 0) {
      showToast('No grantable permissions available for this target', 'error')
      return
    }
    setOpenAddGroupKey(`${subjectType}:${subjectId}`)
    setNewPermState('ALLOW')
    setNewPermId(available[0].permissionId)
  }

  function cancelInlineAdd() {
    setOpenAddGroupKey('')
    setNewPermId('')
    setNewPermState('ALLOW')
  }

  function addInline(subjectType: string, subjectId: string, priority: number) {
    if (!newPermId) return
    mutations.addRules.mutate(
      [{ subjectType, subjectId, kanbanPermissionId: Number(newPermId), state: newPermState, priority }],
      {
        onSuccess: () => {
          cancelInlineAdd()
          showToast('Permission added', 'success')
        },
        onError: (error) => showError(`Failed to add permission: ${error}`),
      },
    )
  }

  // ── "Add new entry" modal ───────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [modalSubject, setModalSubject] = useState<{ type: string; id: string; display: string } | null>(null)
  const [modalPermStates, setModalPermStates] = useState<Record<number, RuleState>>({})
  const deferredModalSearch = useDeferredValue(modalSearch)

  const existingSubjectIds = useMemo(() => {
    const ids: Record<string, Set<string>> = { DISCORD_PERMISSION: new Set(), ROLE: new Set(), USER: new Set() }
    for (const permission of serverPermissions ?? []) ids[permission.subjectType]?.add(permission.subjectId)
    return ids
  }, [serverPermissions])

  const filteredDiscordPerms = useMemo(() => {
    const query = modalSearch.toLowerCase()
    return Object.entries(DISCORD_FLAG_NAMES)
      .filter(([id]) => !existingSubjectIds.DISCORD_PERMISSION.has(id))
      .filter(([id, name]) => !query || name.toLowerCase().includes(query) || id.includes(query))
      .sort(([left], [right]) => (DISCORD_PERM_IMPORTANCE[left] ?? 999) - (DISCORD_PERM_IMPORTANCE[right] ?? 999))
      .map(([id, name]) => ({ id, name }))
  }, [modalSearch, existingSubjectIds])

  const filteredRoles = useMemo(() => {
    const query = modalSearch.toLowerCase()
    return serverRoles
      .filter((role) => !existingSubjectIds.ROLE.has(role.roleId))
      .filter((role) => !query || role.name.toLowerCase().includes(query) || role.roleId.includes(query))
  }, [modalSearch, serverRoles, existingSubjectIds])

  const filteredMembers = useMemo(() => {
    const query = deferredModalSearch.toLowerCase()
    return serverMembers
      .filter((member) => !existingSubjectIds.USER.has(member.userId))
      .filter((member) => {
        if (!query) return true
        const display = member.displayName ?? member.nickname ?? `User #${member.userId}`
        return (
          display.toLowerCase().includes(query) ||
          (member.username?.toLowerCase().includes(query) ?? false) ||
          member.userId.includes(query)
        )
      })
      .slice(0, 50)
  }, [deferredModalSearch, serverMembers, existingSubjectIds])

  const grantableCatalogEntries = useMemo(() => {
    if (!modalSubject) return []
    const existingKeys = (serverPermissions ?? [])
      .filter((permission) => permission.subjectType === modalSubject.type && permission.subjectId === modalSubject.id)
      .map((permission) => permission.kanbanPermissionKey)
    return catalogEntries.filter((entry) => canGrant(rankWeight, entry.key) && !existingKeys.includes(entry.key))
  }, [modalSubject, catalogEntries, serverPermissions, rankWeight])

  function openAddModal() {
    setShowAddModal(true)
    setModalSearch('')
    setModalSubject(null)
    setModalPermStates({})
  }

  function cyclePermState(permissionId: number) {
    setModalPermStates((prev) => {
      const current = prev[permissionId]
      if (!current) return { ...prev, [permissionId]: 'ALLOW' }
      if (current === 'ALLOW') return { ...prev, [permissionId]: 'DENY' }
      const next = { ...prev }
      delete next[permissionId]
      return next
    })
  }

  function saveAddModal() {
    const entries = Object.entries(modalPermStates)
    if (!modalSubject || entries.length === 0) return
    mutations.addRules.mutate(
      entries.map(([permissionId, state]) => ({
        subjectType: modalSubject.type,
        subjectId: modalSubject.id,
        kanbanPermissionId: Number(permissionId),
        state,
        priority: 100,
      })),
      {
        onSuccess: () => {
          setShowAddModal(false)
          showToast(`${entries.length} permission${entries.length > 1 ? 's' : ''} added`, 'success')
        },
        onError: (error) => showError(`Failed to save permissions: ${error}`),
      },
    )
  }

  // ── Board create / settings modal ───────────────────────────────────────
  const [boardEditor, setBoardEditor] = useState<BoardEditor | null>(null)

  function loadServerRules() {
    return queryClient.ensureQueryData({
      queryKey: serverKeys.permissions(serverId),
      queryFn: () => fetchServerPermissions(serverId),
    })
  }

  async function openCreateBoard() {
    try {
      const rules = await loadServerRules()
      setBoardEditor({
        config: {
          mode: 'create',
          board: null,
          canEditDetails: true,
          canEditPermissions: features.PERMISSIONS,
          canArchive: false,
          canDelete: false,
        },
        permissions: buildInheritedBoardPermissionDrafts(rules),
        loading: false,
      })
    } catch (error) {
      showError(`Failed to prepare board creation: ${error}`)
    }
  }

  // An existing board's settings open in the same dialog as on the board page.
  const [settingsBoardId, setSettingsBoardId] = useState<string | null>(null)

  function openBoardSettings(board: BoardEntry) {
    const capability = capabilities[String(board.boardId)]
    if (capability && Object.values(capability).some(Boolean)) setSettingsBoardId(String(board.boardId))
  }

  function closeBoardEditor() {
    if (!mutations.saveBoard.isPending && !mutations.setBoardArchived.isPending && !mutations.removeBoard.isPending) {
      setBoardEditor(null)
    }
  }

  function saveBoard(payload: { name: string; description: string; permissions: PermissionEntry[]; columnNames: string[] }) {
    if (!boardEditor) return
    const { config } = boardEditor
    if (config.canEditDetails && !payload.name.trim()) {
      showError('Board name is required')
      return
    }
    const creating = config.mode === 'create'
    mutations.saveBoard.mutate(
      {
        boardId: creating ? undefined : String(config.board?.boardId),
        details: creating || config.canEditDetails
          ? { name: payload.name, description: payload.description, columnNames: payload.columnNames }
          : undefined,
        permissions: creating || config.canEditPermissions ? payload.permissions : undefined,
      },
      {
        onSuccess: () => {
          showToast(creating ? 'Board created' : 'Board updated', 'success')
          setBoardEditor(null)
        },
        onError: (error) => showError(`Failed to save board: ${error}`),
      },
    )
  }

  function setArchived(archived: boolean) {
    const board = boardEditor?.config.board
    if (!board) return
    mutations.setBoardArchived.mutate(
      { boardId: String(board.boardId), archived },
      {
        onSuccess: () => {
          setBoardEditor(null)
          showToast(archived ? 'Board archived' : 'Board restored', 'success')
        },
        onError: (error) => showError(`Failed to ${archived ? 'archive' : 'restore'} board: ${error}`),
      },
    )
  }

  function removeBoard() {
    const board = boardEditor?.config.board
    if (!board) return
    mutations.removeBoard.mutate(String(board.boardId), {
      onSuccess: () => {
        setBoardEditor(null)
        showToast('Board deleted', 'success')
      },
      onError: (error) => showError(`Failed to delete board: ${error}`),
    })
  }

  const boardSaving =
    mutations.saveBoard.isPending || mutations.setBoardArchived.isPending || mutations.removeBoard.isPending

  // The server settings list only the sections the user may open.
  const settingsSections: ServerSettingsSection[] = []
  if (access?.server.MANAGE_SERVER_PERMISSIONS && featuresQuery.data) {
    settingsSections.push({
      key: 'features',
      label: 'Features',
      content: <FeaturesSettings serverId={serverId} features={featuresQuery.data} />,
    })
  }
  if (access?.server.MANAGE_SERVER_PERMISSIONS) {
    settingsSections.push({
      key: 'notifications',
      label: 'Notifications',
      content: <ServerNotificationsSettings serverId={serverId} boards={boardsQuery.data ?? []} />,
    })
  }
  if (access?.server.MANAGE_SERVER_PERMISSIONS && features.PERMISSIONS) {
    settingsSections.push({
      key: 'permissions',
      label: 'Permissions',
      content: (
        <PermissionsSection
          canEditPermissions
          collapsible={false}
          permissionsCollapsed={false}
          permissionsLoading={permissionsQuery.isPending}
          permFilter={permFilter}
          filteredGroups={filteredGroups}
          expandedPermissionGroups={expandedGroups}
          actorRankWeight={rankWeight}
          openAddGroupKey={openAddGroupKey}
          newPermId={newPermId}
          newPermState={newPermState}
          addSaving={mutations.addRules.isPending}
          catalogEntries={catalogEntries}
          onToggleCollapsed={() => undefined}
          onPermFilterChange={setPermFilter}
          onOpenNewEntryModal={openAddModal}
          onToggleGroupExpansion={toggleGroup}
          onRequestDeleteGroup={setDeleteGroupTarget}
          onOpenAddPermission={openInlineAdd}
          onTogglePermissionState={toggleRuleState}
          onDeletePermission={removeRule}
          onSetNewPermId={setNewPermId}
          onSetNewPermState={setNewPermState}
          onAddPermission={addInline}
          onCancelAddPermission={cancelInlineAdd}
        />
      ),
    })
  }
  if (access?.server.VIEW_AUDIT_LOG) {
    settingsSections.push({
      key: 'audit',
      label: 'Audit log',
      content: <AuditLogSection serverId={serverId} boards={boardsQuery.data ?? []} members={serverMembers} roles={serverRoles} />,
    })
  }

  return (
    <>
      <ServerOverviewPanel
        selectedServer={server}
        boards={boardsQuery.data ?? []}
        boardsLoading={boardsQuery.isPending}
        canCreateBoard={Boolean(access?.server.CREATE_BOARD)}
        boardCapabilities={capabilities}
        onOpenSettings={settingsSections.length > 0 ? () => setShowSettings(true) : undefined}
        onOpenCreateBoard={() => void openCreateBoard()}
        onOpenBoard={(board) => navigate(`/boards/${board.boardId}?serverId=${encodeURIComponent(serverId)}`)}
        onOpenBoardSettings={openBoardSettings}
      />

      {showSettings && settingsSections.length > 0 && (
        <ServerSettingsDialog serverName={server.name} sections={settingsSections} onClose={() => setShowSettings(false)} />
      )}

      <DeleteGroupModal
        target={deleteGroupTarget}
        deleteGroupSaving={mutations.removeRules.isPending}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={removeGroup}
      />

      <AddEntryModal
        show={showAddModal}
        loading={rolesQuery.isPending || membersQuery.isPending || catalogQuery.isPending}
        saving={mutations.addRules.isPending}
        modalSearch={modalSearch}
        subjectType={modalSubject?.type ?? null}
        subjectDisplay={modalSubject?.display ?? null}
        modalPermStates={modalPermStates}
        filteredDiscordPerms={filteredDiscordPerms}
        filteredRoles={filteredRoles}
        filteredMembers={filteredMembers}
        grantableCatalogEntries={grantableCatalogEntries}
        onClose={() => setShowAddModal(false)}
        onSearchChange={setModalSearch}
        onSelectSubject={(type, id, display) => {
          setModalSubject({ type, id, display })
          setModalPermStates({})
        }}
        onClearSubject={() => {
          setModalSubject(null)
          setModalPermStates({})
          setModalSearch('')
        }}
        onCyclePermState={cyclePermState}
        onSave={saveAddModal}
      />

      {settingsBoardId && (
        <BoardSettingsDialog
          key={settingsBoardId}
          serverId={serverId}
          boardId={settingsBoardId}
          onClose={() => setSettingsBoardId(null)}
          onDeleted={() => setSettingsBoardId(null)}
          showToast={showToast}
          showError={showError}
        />
      )}

      {boardEditor && (
        <BoardModal
          key={`${boardEditor.config.mode}:${boardEditor.config.board?.boardId ?? 'new'}:${boardEditor.loading ? 'loading' : 'ready'}`}
          show
          mode={boardEditor.config.mode}
          board={boardEditor.config.board}
          initialName={boardEditor.config.board?.name ?? ''}
          initialDescription={boardEditor.config.board?.description ?? ''}
          initialPermissions={boardEditor.permissions}
          catalogEntries={catalogEntries}
          serverRoles={serverRoles}
          serverMembers={serverMembers}
          actorRankWeight={rankWeight}
          canEditDetails={boardEditor.config.canEditDetails}
          canEditPermissions={boardEditor.config.canEditPermissions}
          canArchive={boardEditor.config.canArchive}
          canDelete={boardEditor.config.canDelete}
          loading={boardEditor.loading}
          saving={boardSaving}
          onClose={closeBoardEditor}
          onSave={saveBoard}
          onArchive={setArchived}
          onDelete={removeBoard}
        />
      )}
    </>
  )
}
