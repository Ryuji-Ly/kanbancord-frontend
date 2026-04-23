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

export type KanbanCatalogEntry = {
  permissionId: number
  key: string
  name: string
  description: string
  category: string
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

// Importance order for Kanban permissions (higher index = less important)
const KANBAN_PERM_IMPORTANCE: Record<string, number> = {
  ADMIN: 0,
  MANAGE_SERVER_PERMISSIONS: 1,
  VIEW_AUDIT_LOG: 2,
  CREATE_BOARD: 3,
  DELETE_BOARD: 4,
  EDIT_BOARD_DETAILS: 5,
  ARCHIVE_BOARD: 6,
  EDIT_BOARD_PERMISSIONS: 7,
  CREATE_COLUMN: 8,
  EDIT_COLUMN: 9,
  DELETE_COLUMN: 10,
  MOVE_COLUMN: 11,
  CREATE_TASK: 12,
  EDIT_TASK: 13,
  DELETE_TASK: 14,
  MOVE_TASK: 15,
  ARCHIVE_TASK: 16,
  ASSIGN_TASK_OTHERS: 17,
  ASSIGN_TASK_SELF: 18,
  CREATE_TASK_COMMENT: 19,
  EDIT_TASK_COMMENT: 20,
  DELETE_TASK_COMMENT: 21,
  CREATE_LABEL: 22,
  EDIT_LABEL: 23,
  DELETE_LABEL: 24,
  APPLY_LABEL_TO_TASK: 25,
  REMOVE_LABEL_FROM_TASK: 26,
  VIEW_BOARD: 27,
  VIEW_TASK: 28,
  VIEW_SERVER: 29,
}

// Discord permission importance (lower bit = higher importance in some cases, so we map explicitly)
const DISCORD_PERM_IMPORTANCE: Record<string, number> = {
  '8': 0,        // Administrator
  '32': 1,       // Manage Guild
  '16': 2,       // Manage Channels
  '128': 3,      // View Audit Log
  '8192': 4,     // Manage Messages
  '2048': 5,     // Send Messages
  '1024': 6,     // View Channel
}

function getKanbanPermImportance(key: string): number {
  return KANBAN_PERM_IMPORTANCE[key] ?? 999
}

function getDiscordPermImportance(discordId: string): number {
  return DISCORD_PERM_IMPORTANCE[discordId] ?? 999
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
  
  const groups = Array.from(map.entries()).map(([key, permissions]) => {
    const [subjectType, subjectId] = key.split(':')
    return {
      subjectType,
      subjectId,
      subjectDisplay: subjectMap.get(key)!,
      // Sort permissions by importance (more important first)
      permissions: permissions.sort((a, b) => {
        const importanceA = getKanbanPermImportance(a.kanbanPermissionKey)
        const importanceB = getKanbanPermImportance(b.kanbanPermissionKey)
        return importanceA - importanceB
      }),
    }
  })
  
  // Sort groups by Discord permission importance (more important first)
  return groups.sort((a, b) => {
    if (a.subjectType === 'DISCORD_PERMISSION' && b.subjectType === 'DISCORD_PERMISSION') {
      const impA = getDiscordPermImportance(a.subjectId)
      const impB = getDiscordPermImportance(b.subjectId)
      return impA - impB
    }
    // Non-Discord permissions come after Discord permissions
    if (a.subjectType === 'DISCORD_PERMISSION') return -1
    if (b.subjectType === 'DISCORD_PERMISSION') return 1
    // Sort other types by subject type, then by ID
    if (a.subjectType !== b.subjectType) {
      return a.subjectType.localeCompare(b.subjectType)
    }
    return a.subjectId.localeCompare(b.subjectId)
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
  userId: string,
  permissionId: number,
  newState: 'ALLOW' | 'DENY',
): Promise<void> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions/${permissionId}/state?${params.toString()}`),
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
  userId: string,
  permissionId: number,
): Promise<void> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions/${permissionId}?${params.toString()}`),
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
}

export async function fetchPermissionCatalog(
  token: string,
  serverId: string,
  userId: string,
): Promise<KanbanCatalogEntry[]> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions/catalog?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<KanbanCatalogEntry[]>
}

export async function createPermission(
  token: string,
  serverId: string,
  userId: string,
  input: {
    scopeType: 'SERVER' | 'BOARD'
    scopeId: string
    subjectType: string
    subjectId: string
    kanbanPermissionId: number
    state: 'ALLOW' | 'DENY'
    priority: number
    isImmutable?: boolean
  },
): Promise<void> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions?${params.toString()}`),
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        kanbanPermissionId: input.kanbanPermissionId,
        state: input.state,
        priority: input.priority,
        isImmutable: Boolean(input.isImmutable),
      }),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
}
