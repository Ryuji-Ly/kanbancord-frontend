import { apiUrl, parseError } from '../api/http'

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export type PermissionEntry = {
  id: number
  scopeType: string
  scopeId: string
  subjectType: string
  subjectId: string
  kanbanPermissionId: number
  kanbanPermissionKey: string
  state: 'ALLOW' | 'DENY'
  priority: number
  isImmutable: boolean
}

export type PermissionDecision = {
  allowed: boolean
  sourceTier?: string
  sourceScopeType?: string
  sourceScopeId?: string
  sourcePermissionId?: number
}

export async function fetchServerPermissions(
  token: string,
  serverId: string,
  userId: string,
): Promise<PermissionEntry[]> {
  const params = new URLSearchParams({
    userId,
    scopeType: 'SERVER',
    scopeId: serverId,
  })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PermissionEntry[]>
}

export async function evaluatePermission(
  token: string,
  serverId: string,
  userId: string,
  permissionKey: string,
): Promise<PermissionDecision> {
  const params = new URLSearchParams({
    userId,
    targetUserId: userId,
    permissionKey,
  })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions/evaluate?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PermissionDecision>
}

// Human-readable names for Discord permission bit values used by the bootstrap.
export const DISCORD_FLAG_NAMES: Record<string, string> = {
  '8': 'Administrator',
  '16': 'Manage Channels',
  '32': 'Manage Server',
  '128': 'View Audit Log',
  '1024': 'View Channel',
  '2048': 'Send Messages',
  '8192': 'Manage Messages',
  '268435456': 'Manage Roles',
  '1099511627776': 'Moderate Members',
}

export type KanbanPermInfo = { name: string; category: string }

// Static catalog matching KanbanPermissionCatalog.java (system permissions only).
export const KANBAN_PERM_INFO: Record<string, KanbanPermInfo> = {
  ADMIN: { name: 'Administrator', category: 'SERVER' },
  VIEW_SERVER: { name: 'View Server', category: 'SERVER' },
  MANAGE_SERVER_PERMISSIONS: { name: 'Manage Server Permissions', category: 'SERVER' },
  VIEW_AUDIT_LOG: { name: 'View Audit Log', category: 'SERVER' },
  CREATE_BOARD: { name: 'Create Board', category: 'BOARD' },
  VIEW_BOARD: { name: 'View Board', category: 'BOARD' },
  EDIT_BOARD_DETAILS: { name: 'Edit Board Details', category: 'BOARD' },
  EDIT_BOARD_PERMISSIONS: { name: 'Edit Board Permissions', category: 'BOARD' },
  ARCHIVE_BOARD: { name: 'Archive Board', category: 'BOARD' },
  DELETE_BOARD: { name: 'Delete Board', category: 'BOARD' },
  CREATE_COLUMN: { name: 'Create Columns', category: 'COLUMN' },
  EDIT_COLUMN: { name: 'Edit Columns', category: 'COLUMN' },
  DELETE_COLUMN: { name: 'Delete Columns', category: 'COLUMN' },
  MOVE_COLUMN: { name: 'Move Columns', category: 'COLUMN' },
  CREATE_TASK: { name: 'Create Tasks', category: 'TASK' },
  VIEW_TASK: { name: 'View Tasks', category: 'TASK' },
  EDIT_TASK: { name: 'Edit Tasks', category: 'TASK' },
  MOVE_TASK: { name: 'Move Tasks', category: 'TASK' },
  DELETE_TASK: { name: 'Delete Tasks', category: 'TASK' },
  ARCHIVE_TASK: { name: 'Archive Tasks', category: 'TASK' },
  ASSIGN_TASK_SELF: { name: 'Assign Tasks to Self', category: 'TASK' },
  ASSIGN_TASK_OTHERS: { name: 'Assign Tasks to Others', category: 'TASK' },
  CREATE_TASK_COMMENT: { name: 'Create Task Comments', category: 'COMMENT' },
  EDIT_TASK_COMMENT: { name: 'Edit Task Comments', category: 'COMMENT' },
  DELETE_TASK_COMMENT: { name: 'Delete Task Comments', category: 'COMMENT' },
  CREATE_LABEL: { name: 'Create Labels', category: 'LABEL' },
  EDIT_LABEL: { name: 'Edit Labels', category: 'LABEL' },
  DELETE_LABEL: { name: 'Delete Labels', category: 'LABEL' },
  APPLY_LABEL_TO_TASK: { name: 'Apply Labels to Tasks', category: 'LABEL' },
  REMOVE_LABEL_FROM_TASK: { name: 'Remove Labels from Tasks', category: 'LABEL' },
}

const CATEGORY_ORDER = ['SERVER', 'BOARD', 'COLUMN', 'TASK', 'COMMENT', 'LABEL']

export function groupPermissionsByCategory(
  entries: PermissionEntry[],
): Array<{ category: string; entries: PermissionEntry[] }> {
  const map = new Map<string, PermissionEntry[]>()
  for (const entry of entries) {
    const cat = KANBAN_PERM_INFO[entry.kanbanPermissionKey]?.category ?? 'OTHER'
    const group = map.get(cat) ?? []
    group.push(entry)
    map.set(cat, group)
  }
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
    category: c,
    entries: map.get(c)!,
  }))
}

export type GrantedToGroup = {
  subjectType: string
  subjectId: string
  subjectDisplay: string
  permissions: PermissionEntry[]
}

export function groupPermissionsByGrantedTo(entries: PermissionEntry[]): GrantedToGroup[] {
  const map = new Map<string, PermissionEntry[]>()
  const subjectMap = new Map<string, string>()
  
  for (const entry of entries) {
    const key = `${entry.subjectType}:${entry.subjectId}`
    const group = map.get(key) ?? []
    group.push(entry)
    map.set(key, group)
    
    // Store display name if not already stored
    if (!subjectMap.has(key)) {
      subjectMap.set(key, getSubjectDisplay(entry.subjectType, entry.subjectId))
    }
  }
  
  return Array.from(map.entries()).map(([key, permissions]) => {
    const [subjectType, subjectId] = key.split(':')
    return {
      subjectType,
      subjectId,
      subjectDisplay: subjectMap.get(key)!,
      permissions: permissions.sort((a, b) => a.kanbanPermissionKey.localeCompare(b.kanbanPermissionKey)),
    }
  })
}

function getSubjectDisplay(subjectType: string, subjectId: string): string {
  if (subjectType === 'DISCORD_PERMISSION') {
    return `Discord: ${DISCORD_FLAG_NAMES[subjectId] ?? `flag ${subjectId}`}`
  }
  return `${subjectType} #${subjectId}`
}

export async function updatePermissionState(
  token: string,
  serverId: string,
  permissionId: number,
  newState: 'ALLOW' | 'DENY',
): Promise<void> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions/${permissionId}/state`),
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: newState }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
}

export async function deletePermission(
  token: string,
  serverId: string,
  permissionId: number,
): Promise<void> {
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions/${permissionId}`),
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
}
