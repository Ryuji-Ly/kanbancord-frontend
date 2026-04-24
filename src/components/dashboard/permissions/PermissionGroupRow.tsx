import { FiLock, FiPlus, FiX } from 'react-icons/fi'
import {
  KANBAN_PERM_INFO,
  type GrantedToGroup,
  type KanbanCatalogEntry,
  type PermissionEntry,
} from '../../../services/permissionsService'

type PermissionGroupRowProps = {
  group: GrantedToGroup
  canEditPermissions: boolean
  isExpanded: boolean
  actorRankWeight: number
  openAddGroupKey: string
  newPermId: number | ''
  newPermState: 'ALLOW' | 'DENY'
  addSaving: boolean
  catalogEntries: KanbanCatalogEntry[]
  onToggleGroup: (groupKey: string) => void
  onRequestDeleteGroup: (group: GrantedToGroup) => void
  onOpenAddPermission: (subjectType: string, subjectId: string, existingKeys: string[]) => void
  onTogglePermissionState: (permissionId: number, currentState: 'ALLOW' | 'DENY') => void
  onDeletePermission: (permissionId: number) => void
  onSetNewPermId: (value: number | '') => void
  onSetNewPermState: (value: 'ALLOW' | 'DENY') => void
  onAddPermission: (subjectType: string, subjectId: string, defaultPriority: number) => void
  onCancelAddPermission: () => void
}

function permissionRankWeight(key: string): number {
  const weightMap: Record<string, number> = {
    ADMIN: 1000,
    MANAGE_SERVER_PERMISSIONS: 800,
    CREATE_BOARD: 600,
    EDIT_BOARD_DETAILS: 600,
    EDIT_BOARD_PERMISSIONS: 600,
    ARCHIVE_BOARD: 600,
    DELETE_BOARD: 600,
    CREATE_COLUMN: 600,
    EDIT_COLUMN: 600,
    DELETE_COLUMN: 600,
    MOVE_COLUMN: 600,
    CREATE_LABEL: 600,
    EDIT_LABEL: 600,
    DELETE_LABEL: 600,
    CREATE_TASK: 400,
    EDIT_TASK: 400,
    MOVE_TASK: 400,
    DELETE_TASK: 400,
    ARCHIVE_TASK: 400,
    ASSIGN_TASK_SELF: 400,
    ASSIGN_TASK_OTHERS: 400,
    CREATE_TASK_COMMENT: 400,
    EDIT_TASK_COMMENT: 400,
    DELETE_TASK_COMMENT: 400,
    APPLY_LABEL_TO_TASK: 400,
    REMOVE_LABEL_FROM_TASK: 400,
    VIEW_SERVER: 200,
    VIEW_AUDIT_LOG: 200,
    VIEW_BOARD: 200,
    VIEW_TASK: 200,
  }
  return weightMap[key] ?? 200
}

function groupHighestAllowedRankWeight(entries: PermissionEntry[]): number {
  let best = 200
  for (const entry of entries) {
    if (entry.state !== 'ALLOW') continue
    const weight = permissionRankWeight(entry.kanbanPermissionKey)
    if (weight > best) best = weight
  }
  return best
}

function isInteractiveTarget(target: HTMLElement): boolean {
  return Boolean(
    target.closest('.kc-perm-button') ||
      target.closest('.kc-perm-button-add') ||
      target.closest('.kc-perm-button-remove') ||
      target.closest('.kc-perm-add-editor') ||
      target.closest('select') ||
      target.closest('button'),
  )
}

export function PermissionGroupRow({
  group,
  canEditPermissions,
  isExpanded,
  actorRankWeight,
  openAddGroupKey,
  newPermId,
  newPermState,
  addSaving,
  catalogEntries,
  onToggleGroup,
  onRequestDeleteGroup,
  onOpenAddPermission,
  onTogglePermissionState,
  onDeletePermission,
  onSetNewPermId,
  onSetNewPermState,
  onAddPermission,
  onCancelAddPermission,
}: PermissionGroupRowProps) {
  const groupKey = `${group.subjectType}:${group.subjectId}`
  const addDisabled =
    (group.subjectType === 'USER' || group.subjectType === 'ROLE') &&
    actorRankWeight !== 1000 &&
    actorRankWeight <= groupHighestAllowedRankWeight(group.permissions)
  const hasAdd = !(group.subjectType === 'DISCORD_PERMISSION' && String(group.subjectId) === '8')

  return (
    <div
      className="kc-perms-granted-to-row"
      role="button"
      tabIndex={0}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (isInteractiveTarget(target)) {
          return
        }
        onToggleGroup(groupKey)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const target = e.target as HTMLElement
          if (isInteractiveTarget(target)) {
            return
          }
          e.preventDefault()
          onToggleGroup(groupKey)
        }
      }}
    >
      {canEditPermissions && !group.permissions.every((p) => p.isImmutable) && (
        <button
          type="button"
          className="kc-perms-group-delete-btn"
          title={`Delete all permissions for ${group.subjectDisplay}`}
          aria-label={`Delete all permissions for ${group.subjectDisplay}`}
          onClick={(e) => {
            e.stopPropagation()
            onRequestDeleteGroup(group)
          }}
        >
          <FiX aria-hidden="true" />
        </button>
      )}
      <div className="kc-perms-granted-to-label">
        <span className="kc-muted">{group.subjectDisplay}</span>
      </div>
      <div className="kc-perms-granted-to-perms">
        <>
          <div
            className={`kc-perm-chip-wrap ${isExpanded ? 'kc-perm-chip-wrap--expanded' : 'kc-perm-chip-wrap--clamped'}`}
          >
            {hasAdd && (
              <button
                type="button"
                className="kc-perm-button-add"
                title="Add permission"
                aria-label="Add permission"
                disabled={addDisabled}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenAddPermission(
                    group.subjectType,
                    group.subjectId,
                    group.permissions.map((p) => p.kanbanPermissionKey),
                  )
                }}
              >
                <FiPlus aria-hidden="true" />
              </button>
            )}

            {group.permissions.map((perm) => {
              const permName = KANBAN_PERM_INFO[perm.kanbanPermissionKey]?.name ?? perm.kanbanPermissionKey
              const isLocked = perm.isImmutable

              return (
                <div
                  key={perm.id}
                  className={`kc-perm-button kc-perm-button--${perm.state.toLowerCase()}${isLocked ? ` ${perm.isImmutable ? 'kc-perm-button--immutable' : 'kc-perm-button--locked'}` : ''}`}
                  title={`${permName} — ${perm.state}${isLocked ? ' (locked)' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isLocked) {
                      onTogglePermissionState(perm.id, perm.state)
                    }
                  }}
                  role="button"
                  tabIndex={isLocked ? -1 : 0}
                  onKeyDown={(e) => {
                    if (!isLocked && (e.key === 'Enter' || e.key === ' ')) {
                      e.stopPropagation()
                      onTogglePermissionState(perm.id, perm.state)
                    }
                  }}
                >
                  <span className="kc-perm-button-text">{permName}</span>
                  {isLocked ? (
                    <FiLock className="kc-perm-lock" aria-hidden="true" />
                  ) : (
                    <button
                      className="kc-perm-button-remove"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeletePermission(perm.id)
                      }}
                      title="Remove permission"
                      aria-label={`Remove ${permName}`}
                    >
                      <FiX aria-hidden="true" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="kc-perm-row-actions">
            {openAddGroupKey === groupKey && (
              <div className="kc-perm-add-editor">
                <select
                  className="kc-perm-add-select"
                  value={newPermId}
                  onChange={(e) => onSetNewPermId(e.target.value ? Number(e.target.value) : '')}
                >
                  {catalogEntries
                    .filter((c) => !group.permissions.some((p) => p.kanbanPermissionKey === c.key))
                    .map((c) => (
                      <option key={c.permissionId} value={c.permissionId}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <select
                  className="kc-perm-add-state"
                  value={newPermState}
                  onChange={(e) => onSetNewPermState(e.target.value as 'ALLOW' | 'DENY')}
                >
                  <option value="ALLOW">ALLOW</option>
                  <option value="DENY">DENY</option>
                </select>
                <button
                  type="button"
                  className="kc-btn kc-btn-primary kc-perm-add-save"
                  disabled={addSaving || !newPermId}
                  onClick={() =>
                    onAddPermission(
                      group.subjectType,
                      group.subjectId,
                      Math.max(...group.permissions.map((p) => p.priority), 100),
                    )
                  }
                >
                  Add
                </button>
                <button
                  type="button"
                  className="kc-btn kc-btn-ghost kc-perm-add-cancel"
                  disabled={addSaving}
                  onClick={onCancelAddPermission}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      </div>
    </div>
  )
}
