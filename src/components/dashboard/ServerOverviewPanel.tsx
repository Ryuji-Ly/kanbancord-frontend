import type { DiscordGuild } from '../../types/auth'
import type { DeleteGroupTarget } from './types'
import { PermissionsSection } from './permissions/PermissionsSection'
import type { GrantedToGroup, KanbanCatalogEntry } from '../../services/permissionsService'
import type { BoardEntry } from '../../services/boardsService'
import type { BoardCapability } from './types'
import { BoardsSection } from './boards/BoardsSection'

type ServerOverviewPanelProps = {
  selectedServer: DiscordGuild | null
  boards: BoardEntry[]
  boardsLoading: boolean
  canCreateBoard: boolean
  boardCapabilities: Record<string, BoardCapability>
  canEditPermissions: boolean
  permissionsCollapsed: boolean
  permissionsLoading: boolean
  permFilter: string
  filteredGroups: GrantedToGroup[]
  expandedPermissionGroups: Set<string>
  actorRankWeight: number
  openAddGroupKey: string
  newPermId: number | ''
  newPermState: 'ALLOW' | 'DENY'
  addSaving: boolean
  catalogEntries: KanbanCatalogEntry[]
  onToggleCollapsed: () => void
  onPermFilterChange: (value: string) => void
  onOpenNewEntryModal: () => void
  onToggleGroupExpansion: (groupKey: string) => void
  onRequestDeleteGroup: (group: DeleteGroupTarget) => void
  onOpenAddPermission: (subjectType: string, subjectId: string, existingKeys: string[]) => void
  onTogglePermissionState: (permissionId: number, currentState: 'ALLOW' | 'DENY') => void
  onDeletePermission: (permissionId: number) => void
  onSetNewPermId: (value: number | '') => void
  onSetNewPermState: (value: 'ALLOW' | 'DENY') => void
  onAddPermission: (subjectType: string, subjectId: string, defaultPriority: number) => void
  onCancelAddPermission: () => void
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
  canEditPermissions,
  permissionsCollapsed,
  permissionsLoading,
  permFilter,
  filteredGroups,
  expandedPermissionGroups,
  actorRankWeight,
  openAddGroupKey,
  newPermId,
  newPermState,
  addSaving,
  catalogEntries,
  onToggleCollapsed,
  onPermFilterChange,
  onOpenNewEntryModal,
  onToggleGroupExpansion,
  onRequestDeleteGroup,
  onOpenAddPermission,
  onTogglePermissionState,
  onDeletePermission,
  onSetNewPermId,
  onSetNewPermState,
  onAddPermission,
  onCancelAddPermission,
  onOpenCreateBoard,
  onOpenBoard,
  onOpenBoardSettings,
}: ServerOverviewPanelProps) {
  if (!selectedServer) return null

  return (
    <section className="kc-panel">
      <h2>{selectedServer.name}</h2>
      <p className="kc-muted">Server overview and permissions.</p>

      <BoardsSection
        boards={boards}
        loading={boardsLoading}
        canCreateBoard={canCreateBoard}
        boardCapabilities={boardCapabilities}
        onOpenCreate={onOpenCreateBoard}
        onOpenBoard={onOpenBoard}
        onOpenSettings={onOpenBoardSettings}
      />

      <PermissionsSection
        canEditPermissions={canEditPermissions}
        permissionsCollapsed={permissionsCollapsed}
        permissionsLoading={permissionsLoading}
        permFilter={permFilter}
        filteredGroups={filteredGroups}
        expandedPermissionGroups={expandedPermissionGroups}
        actorRankWeight={actorRankWeight}
        openAddGroupKey={openAddGroupKey}
        newPermId={newPermId}
        newPermState={newPermState}
        addSaving={addSaving}
        catalogEntries={catalogEntries}
        onToggleCollapsed={onToggleCollapsed}
        onPermFilterChange={onPermFilterChange}
        onOpenNewEntryModal={onOpenNewEntryModal}
        onToggleGroupExpansion={onToggleGroupExpansion}
        onRequestDeleteGroup={onRequestDeleteGroup}
        onOpenAddPermission={onOpenAddPermission}
        onTogglePermissionState={onTogglePermissionState}
        onDeletePermission={onDeletePermission}
        onSetNewPermId={onSetNewPermId}
        onSetNewPermState={onSetNewPermState}
        onAddPermission={onAddPermission}
        onCancelAddPermission={onCancelAddPermission}
      />
    </section>
  )
}
