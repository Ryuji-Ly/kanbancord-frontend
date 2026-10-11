import type { PermissionEntry, ServerRoleEntry } from '../../../services/permissionsService'

/**
 * One-step permission setups. They only write rules for @everyone and the chosen staff role, relying on
 * @everyone being a layer beneath the other roles (as in Discord): deny something to @everyone, allow it to
 * the staff role, and staff have it. Mirrors PermissionPresetService in the API.
 */
export type PermissionPreset = 'EVERYONE' | 'MEMBERS_VIEW' | 'STAFF_ONLY'

export const PERMISSION_PRESETS: PermissionPreset[] = ['EVERYONE', 'MEMBERS_VIEW', 'STAFF_ONLY']

/** Seeing a board and its tasks. */
export const PRESET_VIEW_KEYS = ['VIEW_BOARD', 'VIEW_TASK']

/** Working with tasks: everything a moderator may do with them by default. */
export const PRESET_TASK_KEYS = [
  'CREATE_TASK',
  'MOVE_TASK',
  'EDIT_TASK',
  'DELETE_TASK',
  'ARCHIVE_TASK',
  'CREATE_TASK_COMMENT',
  'DELETE_TASK_COMMENT',
  'APPLY_LABEL_TO_TASK',
  'REMOVE_LABEL_FROM_TASK',
  'ASSIGN_TASK_SELF',
  'ASSIGN_TASK_OTHERS',
]

/** The server's @everyone role: its id is the server's. */
export function everyoneRole(roles: ServerRoleEntry[]): ServerRoleEntry | undefined {
  return roles.find((role) => role.roleId === role.serverId)
}

/** The roles that can count as staff: every role but @everyone, highest first. */
export function staffRoleChoices(roles: ServerRoleEntry[]): ServerRoleEntry[] {
  return roles
    .filter((role) => role.roleId !== role.serverId)
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
}

/** What a preset sets for one role and permission: ALLOW or DENY, or null to remove the rule. */
export type PresetChange = { roleId: string; key: string; state: 'ALLOW' | 'DENY' | null }

export function presetChanges(preset: PermissionPreset, everyoneId: string, staffId: string | null): PresetChange[] {
  const changes: PresetChange[] = []
  const all = [...PRESET_VIEW_KEYS, ...PRESET_TASK_KEYS]
  const forStaff = () => {
    if (staffId) for (const key of all) changes.push({ roleId: staffId, key, state: 'ALLOW' })
  }
  switch (preset) {
    case 'EVERYONE':
      for (const key of all) changes.push({ roleId: everyoneId, key, state: null })
      break
    case 'MEMBERS_VIEW':
      for (const key of PRESET_VIEW_KEYS) changes.push({ roleId: everyoneId, key, state: null })
      for (const key of PRESET_TASK_KEYS) changes.push({ roleId: everyoneId, key, state: 'DENY' })
      forStaff()
      break
    case 'STAFF_ONLY':
      for (const key of PRESET_TASK_KEYS) changes.push({ roleId: everyoneId, key, state: null })
      for (const key of PRESET_VIEW_KEYS) changes.push({ roleId: everyoneId, key, state: 'DENY' })
      forStaff()
      break
  }
  return changes
}

/**
 * A board's permission draft with a preset applied. Saved like any other change to the draft. Removing a
 * rule that mirrors a server rule puts it back to what it inherits.
 */
export function applyPresetToDraft(
  drafts: PermissionEntry[],
  changes: PresetChange[],
  catalogIdByKey: Map<string, number>,
  scopeId: string,
): PermissionEntry[] {
  let next = drafts.map((draft) => ({ ...draft }))
  let nextId = next.reduce((lowest, draft) => Math.min(lowest, draft.id), 0) - 1
  for (const change of changes) {
    const index = next.findIndex(
      (draft) => draft.subjectType === 'ROLE' && draft.subjectId === change.roleId && draft.kanbanPermissionKey === change.key,
    )
    const draft = index >= 0 ? next[index] : undefined
    if (change.state === null) {
      if (!draft) continue
      if (draft.inheritedState !== undefined) {
        next[index] = { ...draft, state: draft.inheritedState }
      } else {
        next = next.filter((_, i) => i !== index)
      }
      continue
    }
    if (draft) {
      next[index] = { ...draft, state: change.state }
      continue
    }
    const kanbanPermissionId = catalogIdByKey.get(change.key)
    if (kanbanPermissionId === undefined) continue
    next.push({
      id: nextId--,
      scopeType: 'BOARD',
      scopeId,
      subjectType: 'ROLE',
      subjectId: change.roleId,
      kanbanPermissionId,
      kanbanPermissionKey: change.key,
      state: change.state,
      priority: 100,
      isImmutable: false,
    })
  }
  return next
}
