import {
  groupPermissionsByGrantedTo,
  isBoardScopePermissionKey,
  type KanbanCatalogEntry,
  type PermissionEntry,
} from '../../../services/permissionsService'

const TEMP_SCOPE_ID = '__draft_board__'

export function buildInheritedBoardPermissionDrafts(serverPermissions: PermissionEntry[]): PermissionEntry[] {
  return serverPermissions
    .filter((permission) => permission.scopeType === 'SERVER')
    .filter((permission) => isBoardScopePermissionKey(permission.kanbanPermissionKey))
    .map((permission, index) => ({
      ...permission,
      id: -(index + 1),
      scopeType: 'BOARD',
      scopeId: TEMP_SCOPE_ID,
    }))
}

export function cloneBoardPermissionDrafts(permissions: PermissionEntry[]): PermissionEntry[] {
  return permissions.map((permission) => ({ ...permission }))
}

export function nextDraftPermissionId(permissions: PermissionEntry[]): number {
  const minId = permissions.reduce((lowest, permission) => Math.min(lowest, permission.id), 0)
  return minId - 1
}

export function toggleDraftPermissionState(
  permissions: PermissionEntry[],
  permissionId: number,
  currentState: 'ALLOW' | 'DENY',
): PermissionEntry[] {
  const newState = currentState === 'ALLOW' ? 'DENY' : 'ALLOW'
  return permissions.map((permission) =>
    permission.id === permissionId ? { ...permission, state: newState } : permission,
  )
}

export function removeDraftPermission(
  permissions: PermissionEntry[],
  permissionId: number,
): PermissionEntry[] {
  return permissions.filter((permission) => permission.id !== permissionId)
}

export function addDraftPermissions(
  permissions: PermissionEntry[],
  additions: Array<{
    subjectType: string
    subjectId: string
    kanbanPermissionId: number
    kanbanPermissionKey: string
    state: 'ALLOW' | 'DENY'
  }>,
): PermissionEntry[] {
  let nextId = nextDraftPermissionId(permissions)
  const created = additions.map((addition) => ({
    id: nextId--,
    scopeType: 'BOARD',
    scopeId: TEMP_SCOPE_ID,
    subjectType: addition.subjectType,
    subjectId: addition.subjectId,
    kanbanPermissionId: addition.kanbanPermissionId,
    kanbanPermissionKey: addition.kanbanPermissionKey,
    state: addition.state,
    priority: 100,
    isImmutable: false,
  }))
  return [...permissions, ...created]
}

export function boardPermissionGroups(
  permissions: PermissionEntry[],
  roles: Map<string, string>,
  members: Map<string, string>,
) {
  return groupPermissionsByGrantedTo(permissions, { roles, members })
}

export function boardPermissionCatalogEntries(catalogEntries: KanbanCatalogEntry[]): KanbanCatalogEntry[] {
  return catalogEntries.filter((entry) => isBoardScopePermissionKey(entry.key))
}

export function boardPermissionKey(permission: Pick<PermissionEntry, 'subjectType' | 'subjectId' | 'kanbanPermissionKey'>): string {
  return `${permission.subjectType}:${permission.subjectId}:${permission.kanbanPermissionKey}`
}

export function diffBoardPermissions(
  existingPermissions: PermissionEntry[],
  desiredPermissions: PermissionEntry[],
) {
  const existingMap = new Map(existingPermissions.map((permission) => [boardPermissionKey(permission), permission]))
  const desiredMap = new Map(desiredPermissions.map((permission) => [boardPermissionKey(permission), permission]))

  const toDelete = existingPermissions.filter(
    (permission) => !permission.isImmutable && !desiredMap.has(boardPermissionKey(permission)),
  )

  const toToggle = existingPermissions
    .map((permission) => {
      const desired = desiredMap.get(boardPermissionKey(permission))
      if (!desired || desired.state === permission.state || permission.isImmutable) {
        return null
      }
      return { permissionId: permission.id, newState: desired.state }
    })
    .filter((entry): entry is { permissionId: number; newState: 'ALLOW' | 'DENY' } => entry !== null)

  const toCreate = desiredPermissions
    .filter((permission) => !existingMap.has(boardPermissionKey(permission)))
    .map((permission) => ({
      subjectType: permission.subjectType,
      subjectId: permission.subjectId,
      kanbanPermissionId: permission.kanbanPermissionId,
      state: permission.state,
      priority: permission.priority,
      isImmutable: permission.isImmutable,
    }))

  return { toDelete, toToggle, toCreate }
}
