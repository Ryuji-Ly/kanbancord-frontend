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

export type PermissionDecisionMap = Record<string, PermissionDecision>

export type KanbanCatalogEntry = {
  permissionId: number
  key: string
  name: string
  description: string
  category: string
}

export type PermissionScopeType = 'SERVER' | 'BOARD'

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
  boardId?: string,
): Promise<PermissionDecision> {
  const params = new URLSearchParams({
    userId,
    targetUserId: userId,
    permissionKey,
  })
  if (boardId) {
    params.set('boardId', boardId)
  }
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions/evaluate?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PermissionDecision>
}

export async function evaluatePermissions(
  token: string,
  serverId: string,
  userId: string,
  permissionKeys: string[],
  boardId?: string,
): Promise<PermissionDecisionMap> {
  const params = new URLSearchParams({
    userId,
    targetUserId: userId,
  })
  for (const permissionKey of permissionKeys) {
    params.append('permissionKey', permissionKey)
  }
  if (boardId) {
    params.set('boardId', boardId)
  }
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions/evaluate-batch?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PermissionDecisionMap>
}

// Human-readable names for Discord permission bit values used by the bootstrap.
export const DISCORD_FLAG_NAMES: Record<string, string> = {
  '1': 'Create Invite',
  '2': 'Kick Members',
  '4': 'Ban Members',
  '8': 'Administrator',
  '16': 'Manage Channels',
  '32': 'Manage Server',
  '64': 'Add Reactions',
  '128': 'View Audit Log',
  '256': 'Priority Speaker',
  '512': 'Video',
  '1024': 'View Channel',
  '2048': 'Send Messages',
  '4096': 'Send TTS Messages',
  '8192': 'Manage Messages',
  '16384': 'Embed Links',
  '32768': 'Attach Files',
  '65536': 'Read Message History',
  '131072': 'Mention Everyone',
  '262144': 'Use External Emojis',
  '524288': 'View Server Insights',
  '1048576': 'Connect',
  '2097152': 'Speak',
  '4194304': 'Mute Members',
  '8388608': 'Deafen Members',
  '16777216': 'Move Members',
  '33554432': 'Use Voice Activity',
  '67108864': 'Change Nickname',
  '134217728': 'Manage Nicknames',
  '268435456': 'Manage Roles',
  '536870912': 'Manage Webhooks',
  '1073741824': 'Manage Expressions',
  '2147483648': 'Use Application Commands',
  '4294967296': 'Request to Speak',
  '8589934592': 'Manage Events',
  '17179869184': 'Manage Threads',
  '34359738368': 'Create Public Threads',
  '68719476736': 'Create Private Threads',
  '137438953472': 'Use External Stickers',
  '274877906944': 'Send Messages in Threads',
  '549755813888': 'Use Embedded Activities',
  '1099511627776': 'Moderate Members',
  '2199023255552': 'View Creator Monetization Analytics',
  '4398046511104': 'Use Soundboard',
  '8796093022208': 'Create Expressions',
  '17592186044416': 'Create Events',
  '35184372088832': 'Use External Sounds',
  '70368744177664': 'Send Voice Messages',
  '1125899906842624': 'Send Polls',
  '2251799813685248': 'Use External Apps',
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

export const CATEGORY_ORDER = ['SERVER', 'BOARD', 'COLUMN', 'TASK', 'COMMENT', 'LABEL']

export const BOARD_SCOPE_PERMISSION_KEYS = new Set<string>([
  'ADMIN',
  'VIEW_BOARD',
  'EDIT_BOARD_DETAILS',
  'EDIT_BOARD_PERMISSIONS',
  'ARCHIVE_BOARD',
  'DELETE_BOARD',
  'CREATE_COLUMN',
  'EDIT_COLUMN',
  'DELETE_COLUMN',
  'MOVE_COLUMN',
  'CREATE_TASK',
  'VIEW_TASK',
  'EDIT_TASK',
  'MOVE_TASK',
  'DELETE_TASK',
  'ARCHIVE_TASK',
  'ASSIGN_TASK_SELF',
  'ASSIGN_TASK_OTHERS',
  'CREATE_TASK_COMMENT',
  'EDIT_TASK_COMMENT',
  'DELETE_TASK_COMMENT',
  'CREATE_LABEL',
  'EDIT_LABEL',
  'DELETE_LABEL',
  'APPLY_LABEL_TO_TASK',
  'REMOVE_LABEL_FROM_TASK',
])

export function isBoardScopePermissionKey(key: string): boolean {
  return BOARD_SCOPE_PERMISSION_KEYS.has(key)
}

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
export const KANBAN_PERM_IMPORTANCE: Record<string, number> = {
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

// Discord permission importance (lower number = shown first)
export const DISCORD_PERM_IMPORTANCE: Record<string, number> = {
  '8': 0,              // Administrator
  '32': 1,             // Manage Server
  '2': 2,              // Kick Members
  '4': 3,              // Ban Members
  '1099511627776': 4,  // Moderate Members
  '268435456': 5,      // Manage Roles
  '16': 6,             // Manage Channels
  '128': 7,            // View Audit Log
  '536870912': 8,      // Manage Webhooks
  '1073741824': 9,     // Manage Expressions
  '8589934592': 10,    // Manage Events
  '8192': 11,          // Manage Messages
  '17179869184': 12,   // Manage Threads
  '4194304': 13,       // Mute Members
  '8388608': 14,       // Deafen Members
  '16777216': 15,      // Move Members
  '134217728': 16,     // Manage Nicknames
  '1024': 17,          // View Channel
  '65536': 18,         // Read Message History
  '2048': 19,          // Send Messages
  '131072': 20,        // Mention Everyone
  '64': 21,            // Add Reactions
  '16384': 22,         // Embed Links
  '32768': 23,         // Attach Files
  '4096': 24,          // Send TTS Messages
  '262144': 25,        // Use External Emojis
  '137438953472': 26,  // Use External Stickers
  '35184372088832': 27,// Use External Sounds
  '274877906944': 28,  // Send Messages in Threads
  '34359738368': 29,   // Create Public Threads
  '68719476736': 30,   // Create Private Threads
  '1048576': 31,       // Connect
  '2097152': 32,       // Speak
  '256': 33,           // Priority Speaker
  '512': 34,           // Video
  '33554432': 35,      // Use Voice Activity
  '4294967296': 36,    // Request to Speak
  '549755813888': 37,  // Use Embedded Activities
  '4398046511104': 38, // Use Soundboard
  '70368744177664': 39,// Send Voice Messages
  '2147483648': 40,    // Use Application Commands
  '1': 41,             // Create Invite
  '67108864': 42,      // Change Nickname
  '524288': 43,        // View Server Insights
  '2199023255552': 44, // View Creator Monetization Analytics
  '8796093022208': 45, // Create Expressions
  '17592186044416': 46,// Create Events
  '1125899906842624': 47, // Send Polls
  '2251799813685248': 48, // Use External Apps
}

function getKanbanPermImportance(key: string): number {
  return KANBAN_PERM_IMPORTANCE[key] ?? 999
}

function getDiscordPermImportance(discordId: string): number {
  return DISCORD_PERM_IMPORTANCE[discordId] ?? 999
}

export function groupPermissionsByGrantedTo(entries: PermissionEntry[], lookups?: SubjectLookups): GrantedToGroup[] {
  const map = new Map<string, PermissionEntry[]>()
  const subjectMap = new Map<string, string>()
  
  for (const entry of entries) {
    const key = `${entry.subjectType}:${entry.subjectId}`
    const group = map.get(key) ?? []
    group.push(entry)
    map.set(key, group)
    
    // Store display name if not already stored
    if (!subjectMap.has(key)) {
      subjectMap.set(key, getSubjectDisplay(entry.subjectType, entry.subjectId, lookups))
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

export type SubjectLookups = {
  roles?: Map<string, string>   // roleId (string) -> name
  members?: Map<string, string> // userId (string) -> displayName
}

function getSubjectDisplay(subjectType: string, subjectId: string, lookups?: SubjectLookups): string {
  if (subjectType === 'DISCORD_PERMISSION') {
    return `Discord: ${DISCORD_FLAG_NAMES[subjectId] ?? `flag ${subjectId}`}`
  }
  if (subjectType === 'ROLE') {
    const name = lookups?.roles?.get(subjectId)
    return `Role: ${name ?? subjectId}`
  }
  if (subjectType === 'USER') {
    const name = lookups?.members?.get(subjectId)
    return `User: ${name ?? subjectId}`
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

export async function fetchScopedPermissions(
  token: string,
  serverId: string,
  userId: string,
  scopeType: PermissionScopeType,
  scopeId: string,
): Promise<PermissionEntry[]> {
  const params = new URLSearchParams({
    userId,
    scopeType,
    scopeId,
  })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/permissions?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PermissionEntry[]>
}

export async function createPermission(  token: string,
  serverId: string,
  userId: string,
  input: {
    scopeType: PermissionScopeType
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

export type ServerRoleEntry = {
  roleId: string
  serverId: string
  name: string
  color: number | null
  position: number | null
}

export type ServerMemberEntry = {
  userId: string
  serverId: string
  nickname: string | null
  displayName: string | null
  username: string | null
}

export async function fetchServerRoles(
  token: string,
  serverId: string,
  userId: string,
): Promise<ServerRoleEntry[]> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/roles?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerRoleEntry[]>
}

export async function fetchServerMembers(
  token: string,
  serverId: string,
  userId: string,
): Promise<ServerMemberEntry[]> {
  const params = new URLSearchParams({ userId })
  const response = await fetch(
    apiUrl(`/api/servers/${serverId}/members?${params.toString()}`),
    { headers: authHeaders(token) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerMemberEntry[]>
}
