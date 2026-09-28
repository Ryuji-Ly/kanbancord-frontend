import { useLayoutEffect, useRef } from 'react'
import { FiLock, FiPlus, FiX } from 'react-icons/fi'
import {
  KANBAN_PERM_INFO,
  type GrantedToGroup,
  type KanbanCatalogEntry,
  type PermissionEntry,
} from '../../../services/permissionsService'
import { permissionRankWeight } from '../permissionRank'

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

  // A collapsed row that has more permissions than fit fades out at the bottom, so the edge of the
  // next line reads as "more, click to expand" rather than as cut off.
  const chipsRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const element = chipsRef.current
    if (!element) return
    const check = () =>
      element.classList.toggle('kc-perm-chip-wrap--overflowing', element.scrollHeight > element.clientHeight + 1)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(element)
    return () => observer.disconnect()
  }, [isExpanded, group.permissions.length])

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
      {canEditPermissions && !group.permissions.every((p) => p.isImmutable || p.inheritedState !== undefined) && (
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
            ref={chipsRef}
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
              const isInherited = perm.inheritedState !== undefined
              const inheritanceNote = !isInherited
                ? ''
                : perm.state === perm.inheritedState
                  ? ' (inherited from server)'
                  : ` (overrides server: ${perm.inheritedState})`

              return (
                <div
                  key={perm.id}
                  className={`kc-perm-button kc-perm-button--${perm.state.toLowerCase()}${isLocked ? ` ${perm.isImmutable ? 'kc-perm-button--immutable' : 'kc-perm-button--locked'}` : ''}`}
                  title={`${permName} — ${perm.state}${isLocked ? ' (locked)' : ''}${inheritanceNote}`}
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
                  ) : isInherited ? null : (
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
