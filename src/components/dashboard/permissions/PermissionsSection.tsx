import { FiPlus } from 'react-icons/fi'
import type { GrantedToGroup, KanbanCatalogEntry } from '../../../services/permissionsService'
import type { DeleteGroupTarget } from '../types'
import { PermissionGroupRow } from './PermissionGroupRow'

type PermissionsSectionProps = {
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
}

export function PermissionsSection({
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
}: PermissionsSectionProps) {
  if (!canEditPermissions) return null

  return (
    <div className="kc-server-perms-section">
      <div className="kc-perms-header-row">
        <h3>Permissions</h3>
        <button
          type="button"
          className="kc-btn kc-btn-ghost kc-perms-toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!permissionsCollapsed}
        >
          {permissionsCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!permissionsCollapsed && permissionsLoading && (
        <div className="kc-loading-state" aria-live="polite" aria-busy="true">
          <span className="kc-spinner" aria-hidden="true" />
          <span className="kc-muted">Loading permissions...</span>
        </div>
      )}
      {!permissionsCollapsed && !permissionsLoading && (
        <>
          <div className="kc-perms-toolbar">
            <input
              className="kc-perms-filter"
              type="text"
              placeholder="Search entries..."
              value={permFilter}
              onChange={(e) => onPermFilterChange(e.target.value)}
              aria-label="Filter permissions"
            />
            <button
              type="button"
              className="kc-btn kc-btn-primary kc-perms-add-btn"
              onClick={onOpenNewEntryModal}
            >
              <FiPlus aria-hidden="true" /> Add Entry
            </button>
          </div>

          <div className="kc-perms-granted-to-list">
            {filteredGroups.map((group) => {
              const groupKey = `${group.subjectType}:${group.subjectId}`
              return (
                <PermissionGroupRow
                  key={groupKey}
                  group={group}
                  canEditPermissions={canEditPermissions}
                  isExpanded={expandedPermissionGroups.has(groupKey)}
                  actorRankWeight={actorRankWeight}
                  openAddGroupKey={openAddGroupKey}
                  newPermId={newPermId}
                  newPermState={newPermState}
                  addSaving={addSaving}
                  catalogEntries={catalogEntries}
                  onToggleGroup={onToggleGroupExpansion}
                  onRequestDeleteGroup={(target) => onRequestDeleteGroup(target)}
                  onOpenAddPermission={onOpenAddPermission}
                  onTogglePermissionState={onTogglePermissionState}
                  onDeletePermission={onDeletePermission}
                  onSetNewPermId={onSetNewPermId}
                  onSetNewPermState={onSetNewPermState}
                  onAddPermission={onAddPermission}
                  onCancelAddPermission={onCancelAddPermission}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
