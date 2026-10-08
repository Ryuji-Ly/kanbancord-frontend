import { parseError } from '../api/http'
import { apiFetch } from '../api/session'
import { t, type MessageKey } from '../i18n'

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
  /**
   * Board permission drafts only: the state inherited from the matching server rule. Present when the
   * entry mirrors a server rule; the entry is then a board override only if its state differs.
   */
  inheritedState?: 'ALLOW' | 'DENY'
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
  serverId: string,
): Promise<PermissionEntry[]> {
  const params = new URLSearchParams({
    scopeType: 'SERVER',
    scopeId: serverId,
  })
  const response = await apiFetch(`/api/servers/${serverId}/permissions?${params.toString()}`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PermissionEntry[]>
}

/** Every server-scope key, and the board-scope keys of each board the caller can view, with whether each is allowed. */
export type ServerAccess = {
  server: Record<string, boolean>
  boards: Record<string, Record<string, boolean>>
}

export async function fetchMyAccess(serverId: string): Promise<ServerAccess> {
  const response = await apiFetch(`/api/servers/${serverId}/permissions/mine`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerAccess>
}

export async function evaluatePermissions(
  serverId: string,
  permissionKeys: string[],
  boardId?: string,
): Promise<PermissionDecisionMap> {
  const params = new URLSearchParams({
  })
  for (const permissionKey of permissionKeys) {
    params.append('permissionKey', permissionKey)
  }
  if (boardId) {
    params.set('boardId', boardId)
  }
  const response = await apiFetch(`/api/servers/${serverId}/permissions/evaluate-batch?${params.toString()}`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PermissionDecisionMap>
}

// Human-readable names for Discord permission bit values used by the bootstrap.
/** The Discord permission bits KanbanCord knows by name (the names are in permissions.json). */
const DISCORD_FLAG_BITS = [
  '1',
  '2',
  '4',
  '8',
  '16',
  '32',
  '64',
  '128',
  '256',
  '512',
  '1024',
  '2048',
  '4096',
  '8192',
  '16384',
  '32768',
  '65536',
  '131072',
  '262144',
  '524288',
  '1048576',
  '2097152',
  '4194304',
  '8388608',
  '16777216',
  '33554432',
  '67108864',
  '134217728',
  '268435456',
  '536870912',
  '1073741824',
  '2147483648',
  '4294967296',
  '8589934592',
  '17179869184',
  '34359738368',
  '68719476736',
  '137438953472',
  '274877906944',
  '549755813888',
  '1099511627776',
  '2199023255552',
  '4398046511104',
  '8796093022208',
  '17592186044416',
  '35184372088832',
  '70368744177664',
  '1125899906842624',
  '2251799813685248',
]

/** Each Discord permission's name, by bit value, in the reader's language (read when looked up). */
export const DISCORD_FLAG_NAMES: Record<string, string> = Object.defineProperties(
  {},
  Object.fromEntries(
    DISCORD_FLAG_BITS.map((bit) => [
      bit,
      { enumerable: true, get: () => t(`permissions.discord.${bit}` as MessageKey) },
    ]),
  ),
)

export type KanbanPermInfo = { readonly name: string; category: string }

// Static catalog matching KanbanPermissionCatalog.java (system permissions only).
const KANBAN_PERM_CATEGORIES: Record<string, string> = {
  ADMIN: 'SERVER',
  VIEW_SERVER: 'SERVER',
  MANAGE_SERVER_PERMISSIONS: 'SERVER',
  VIEW_AUDIT_LOG: 'SERVER',
  CREATE_BOARD: 'BOARD',
  VIEW_BOARD: 'BOARD',
  EDIT_BOARD_DETAILS: 'BOARD',
  EDIT_BOARD_PERMISSIONS: 'BOARD',
  ARCHIVE_BOARD: 'BOARD',
  DELETE_BOARD: 'BOARD',
  CREATE_COLUMN: 'COLUMN',
  EDIT_COLUMN: 'COLUMN',
  DELETE_COLUMN: 'COLUMN',
  MOVE_COLUMN: 'COLUMN',
  CREATE_TASK: 'TASK',
  VIEW_TASK: 'TASK',
  EDIT_TASK: 'TASK',
  MOVE_TASK: 'TASK',
  DELETE_TASK: 'TASK',
  ARCHIVE_TASK: 'TASK',
  ASSIGN_TASK_SELF: 'TASK',
  ASSIGN_TASK_OTHERS: 'TASK',
  CREATE_TASK_COMMENT: 'COMMENT',
  DELETE_TASK_COMMENT: 'COMMENT',
  CREATE_LABEL: 'LABEL',
  EDIT_LABEL: 'LABEL',
  DELETE_LABEL: 'LABEL',
  APPLY_LABEL_TO_TASK: 'LABEL',
  REMOVE_LABEL_FROM_TASK: 'LABEL',
  MANAGE_PRIORITIES: 'LABEL',
}

/** Each KanbanCord permission's name (in the reader's language, read when shown) and category. */
export const KANBAN_PERM_INFO: Record<string, KanbanPermInfo> = Object.fromEntries(
  Object.entries(KANBAN_PERM_CATEGORIES).map(([key, category]) => [
    key,
    {
      category,
      get name() {
        return t(`permissions.kanban.${key}` as MessageKey)
      },
    },
  ]),
)

export const CATEGORY_ORDER = ['SERVER', 'BOARD', 'COLUMN', 'TASK', 'COMMENT', 'LABEL']

// Must match KanbanPermissionCatalog.isBoardScopeAllowed (ADMIN is server-scope only).
export const BOARD_SCOPE_PERMISSION_KEYS = new Set<string>([
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
  DELETE_TASK_COMMENT: 21,
  CREATE_LABEL: 22,
  EDIT_LABEL: 23,
  DELETE_LABEL: 24,
  APPLY_LABEL_TO_TASK: 25,
  REMOVE_LABEL_FROM_TASK: 26,
  MANAGE_PRIORITIES: 26.5,
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
    return t('permissions.subject.discord', {
      name: DISCORD_FLAG_NAMES[subjectId] ?? t('permissions.subject.flag', { id: subjectId }),
    })
  }
  if (subjectType === 'ROLE') {
    const name = lookups?.roles?.get(subjectId)
    return t('permissions.subject.role', { name: name ?? subjectId })
  }
  if (subjectType === 'USER') {
    const name = lookups?.members?.get(subjectId)
    return t('permissions.subject.user', { name: name ?? subjectId })
  }
  return `${subjectType} #${subjectId}`
}

export async function updatePermissionState(
  serverId: string,
  permissionId: number,
  newState: 'ALLOW' | 'DENY',
): Promise<void> {
  const response = await apiFetch(`/api/servers/${serverId}/permissions/${permissionId}/state`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state: newState }),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

export async function deletePermission(
  serverId: string,
  permissionId: number,
): Promise<void> {
  const response = await apiFetch(`/api/servers/${serverId}/permissions/${permissionId}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(await parseError(response))
}

export async function fetchPermissionCatalog(
  serverId: string,
): Promise<KanbanCatalogEntry[]> {
  const response = await apiFetch(`/api/servers/${serverId}/permissions/catalog`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<KanbanCatalogEntry[]>
}

export async function fetchScopedPermissions(
  serverId: string,
  scopeType: PermissionScopeType,
  scopeId: string,
): Promise<PermissionEntry[]> {
  const params = new URLSearchParams({
    scopeType,
    scopeId,
  })
  const response = await apiFetch(`/api/servers/${serverId}/permissions?${params.toString()}`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<PermissionEntry[]>
}

export async function createPermission(
  serverId: string,
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
  const response = await apiFetch(`/api/servers/${serverId}/permissions`, {
    method: 'POST',
    headers: {
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
  })
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
  serverId: string,
): Promise<ServerRoleEntry[]> {
  const response = await apiFetch(`/api/servers/${serverId}/roles`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerRoleEntry[]>
}

export async function fetchServerMembers(
  serverId: string,
): Promise<ServerMemberEntry[]> {
  const response = await apiFetch(`/api/servers/${serverId}/members`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerMemberEntry[]>
}

/** A rule as it took part in a check. `builtIn` for the defaults that apply while custom permissions are off. */
export type CheckedRule = {
  ruleId: number | null
  scope: 'SERVER' | 'BOARD'
  subjectType: 'DISCORD_PERMISSION' | 'ROLE' | 'USER'
  subjectId: string
  /** A role's or person's name, or a Discord permission such as SEND_MESSAGES. */
  subjectName: string
  state: 'ALLOW' | 'DENY'
  builtIn: boolean
}

export type KeyCheck = {
  key: string
  name: string
  category: string
  allowed: boolean
  /** ADMIN: an administrator; OPEN: open permissions; RULE: a rule decided; NONE: no rule matched. */
  reason: 'ADMIN' | 'OPEN' | 'RULE' | 'NONE'
  decidedBy: CheckedRule | null
  /** Rules that matched too, but were outweighed. */
  overridden: CheckedRule[]
}

export type AccessCheck = {
  subject: {
    userId: string | null
    name: string | null
    member: boolean
    owner: boolean
    rolesChanged: boolean
    roles: { roleId: string; name: string; color: number | null; everyone: boolean }[]
    /** The Discord permissions held that some rule mentions. */
    discordPermissions: string[]
    administrator: boolean
    administratorRule: CheckedRule | null
  }
  customPermissions: boolean
  openPermissions: boolean
  boardId: string | null
  boardName: string | null
  results: KeyCheck[]
}

/**
 * What someone may do, and why. Without a user or roles, the caller themselves; with `roleIds`, those
 * roles instead of the member's own (or, without a member, anyone with them).
 */
export async function fetchAccessCheck(
  serverId: string,
  options: { userId?: string; roleIds?: string[]; boardId?: string },
): Promise<AccessCheck> {
  const params = new URLSearchParams()
  if (options.userId) params.set('userId', options.userId)
  if (options.roleIds) {
    params.set('withRoles', 'true')
    if (options.roleIds.length > 0) params.set('roleIds', options.roleIds.join(','))
  }
  if (options.boardId) params.set('boardId', options.boardId)
  const response = await apiFetch(`/api/servers/${serverId}/permissions/check?${params.toString()}`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<AccessCheck>
}
