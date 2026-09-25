import { parseServerTime } from '../../api/http'
import type { AuditEntry } from '../../services/auditLogService'
import { FEATURES } from '../../services/featuresService'
import { DISCORD_FLAG_NAMES, KANBAN_PERM_INFO } from '../../services/permissionsService'

/** The kinds of change the log can be filtered by, and the entity types each covers. */
export const AUDIT_CATEGORIES: { key: string; label: string; entityTypes: string[] }[] = [
  { key: 'boards', label: 'Boards', entityTypes: ['BOARD'] },
  { key: 'columns', label: 'Columns', entityTypes: ['BOARD_COLUMN'] },
  { key: 'tasks', label: 'Tasks', entityTypes: ['TASK'] },
  { key: 'assignments', label: 'Assignments', entityTypes: ['TASK_ASSIGNMENT'] },
  { key: 'comments', label: 'Comments', entityTypes: ['TASK_COMMENT'] },
  { key: 'labels', label: 'Labels', entityTypes: ['LABEL', 'TASK_LABEL'] },
  { key: 'priorities', label: 'Priorities', entityTypes: ['PRIORITY'] },
  { key: 'permissions', label: 'Permissions', entityTypes: ['PERMISSION'] },
  { key: 'settings', label: 'Server settings', entityTypes: ['SETTINGS'] },
]

/** Names for people and roles, to describe assignments and permission rules. */
export type AuditLookups = {
  members: Map<string, string>
  roles: Map<string, string>
}

export type AuditFieldChange = { field: string; from: string; to: string }

export type AuditDescription = {
  /** What happened, e.g. `edited task "Fix login"`. */
  summary: string
  /** Field by field, for edits. */
  fields: AuditFieldChange[]
}

const ENTITY_NOUNS: Record<string, string> = {
  BOARD: 'board',
  BOARD_COLUMN: 'column',
  TASK: 'task',
  TASK_COMMENT: 'comment',
  LABEL: 'label',
  PRIORITY: 'priority level',
}

/** Fields that change as a side effect and say nothing about what the person did. */
const HIDDEN_FIELDS = new Set([
  'position', 'updatedAt', 'createdAt', 'editedByUsers', '_subject', '_column', '_fromColumn', 'columnId',
])
/** Fields holding the id of something else; shown as "#id". */
const ID_FIELDS = new Set(['priorityId'])

const FEATURE_NAMES: Record<string, string> = Object.fromEntries(FEATURES.map((feature) => [feature.key, feature.label]))

const FIELD_NAMES: Record<string, string> = {
  columnId: 'column',
  priorityId: 'priority',
  dueDate: 'due date',
  isArchived: 'archived',
  wipLimit: 'WIP limit',
  kanbanPermissionKey: 'permission',
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function text(value: unknown, max = 60): string {
  if (value === null || value === undefined || value === '') return 'none'
  const shown = typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return shown.length > max ? `${shown.slice(0, max - 1)}…` : shown
}

/** The entity as it was created or deleted, if the entry recorded it whole. */
function snapshotOf(entry: AuditEntry): Record<string, unknown> | null {
  return record(entry.changes?.created) ?? record(entry.changes?.deleted)
}

function entityName(entry: AuditEntry): string | null {
  const snapshot = snapshotOf(entry)
  const candidate = snapshot?.title ?? snapshot?.name ?? entry.changes?._subject
  if (typeof candidate === 'string' && candidate.trim()) return candidate
  const content = snapshot?.content
  return typeof content === 'string' && content.trim() ? text(content, 40) : null
}

function subjectLabel(subjectType: unknown, subjectId: unknown, lookups: AuditLookups): string {
  const id = String(subjectId ?? '')
  if (subjectType === 'ROLE') return `role ${lookups.roles.get(id) ?? `#${id}`}`
  if (subjectType === 'USER') return lookups.members.get(id) ?? `user #${id}`
  return `everyone with ${DISCORD_FLAG_NAMES[id] ?? 'a Discord permission'}`
}

function describeRule(verb: string, rule: Record<string, unknown> | null, lookups: AuditLookups): string {
  if (!rule) return `${verb} a permission rule`
  const key = String(rule.kanbanPermissionKey ?? '')
  const name = KANBAN_PERM_INFO[key]?.name ?? key
  const state = rule.state === 'DENY' ? 'deny' : 'allow'
  // The board, if any, is named after the sentence.
  return `${verb} rule: ${state} ${name} for ${subjectLabel(rule.subjectType, rule.subjectId, lookups)}`
}

function fieldChanges(entry: AuditEntry): AuditFieldChange[] {
  if (!entry.changes || snapshotOf(entry)) return []
  return Object.entries(entry.changes)
    .filter(([field]) => !HIDDEN_FIELDS.has(field))
    .map(([field, change]) => {
      const pair = record(change)
      const show = (value: unknown) => (ID_FIELDS.has(field) && value !== null && value !== undefined ? `#${value}` : text(value))
      return { field: FIELD_NAMES[field] ?? field, from: show(pair?.from), to: show(pair?.to) }
    })
}

/** A sentence for the entry, without the actor: "created task "X"", "moved column "Y"". */
export function describeAuditEntry(entry: AuditEntry, lookups: AuditLookups): AuditDescription {
  const fields = fieldChanges(entry)
  const snapshot = snapshotOf(entry)
  const name = entityName(entry)
  const named = (noun: string) => (name ? `${noun} "${name}"` : `${noun} #${entry.entityId ?? '?'}`)

  switch (entry.action) {
    case 'TASK_ASSIGNMENT_CREATED':
    case 'TASK_ASSIGNMENT_DELETED': {
      const assignee = lookups.members.get(String(snapshot?.userId ?? '')) ?? 'someone'
      const onTask = `task #${snapshot?.taskId ?? '?'}`
      return {
        summary: entry.action.endsWith('CREATED') ? `assigned ${assignee} to ${onTask}` : `unassigned ${assignee} from ${onTask}`,
        fields,
      }
    }
    case 'TASK_LABEL_ADDED':
      return { summary: `added a label to task #${snapshot?.taskId ?? '?'}`, fields }
    case 'TASK_LABEL_REMOVED':
      return { summary: `removed a label from task #${snapshot?.taskId ?? '?'}`, fields }
    case 'PERMISSION_CREATED':
      return { summary: describeRule('added', snapshot, lookups), fields }
    case 'PERMISSION_DELETED':
      return { summary: describeRule('removed', snapshot, lookups), fields }
    case 'PERMISSION_UPDATED':
      return { summary: 'changed a permission rule', fields }
    case 'TASK_MOVED':
    case 'TASK_UPDATED': {
      // Column names are recorded from this version on; older entries fall back to the plain wording.
      const column = entry.changes?._column
      const fromColumn = entry.changes?._fromColumn
      if (typeof fromColumn === 'string' && typeof column === 'string') {
        const moved = `moved ${named('task')} from ${fromColumn} to ${column}`
        return { summary: entry.action === 'TASK_UPDATED' && fields.length > 0 ? `edited and ${moved}` : moved, fields }
      }
      if (entry.action === 'TASK_MOVED' && typeof column === 'string') {
        return { summary: `reordered ${named('task')} in ${column}`, fields }
      }
      break
    }
    case 'SERVER_FEATURES_UPDATED': {
      const turned = (on: boolean) =>
        Object.entries(entry.changes ?? {})
          .filter(([key, change]) => !key.startsWith('_') && record(change)?.to === on)
          .map(([key]) => FEATURE_NAMES[key] ?? key)
      const parts = [
        turned(true).length > 0 ? `turned on ${turned(true).join(', ')}` : '',
        turned(false).length > 0 ? `turned off ${turned(false).join(', ')}` : '',
      ].filter(Boolean)
      return { summary: parts.length > 0 ? parts.join(' and ') : 'changed the server features', fields: [] }
    }
    case 'COLUMN_MOVED':
      return { summary: `reordered ${named('column')}`, fields }
  }

  const noun = ENTITY_NOUNS[entry.entityType] ?? entry.entityType.toLowerCase()
  const verb = entry.action.slice(entry.action.lastIndexOf('_') + 1)
  const verbs: Record<string, string> = {
    CREATED: 'created',
    UPDATED: 'edited',
    DELETED: 'deleted',
    MOVED: 'moved',
    ARCHIVED: 'archived',
    RESTORED: 'restored',
  }
  return { summary: `${verbs[verb] ?? verb.toLowerCase()} ${named(noun)}`, fields }
}

/** "just now", "5 min ago", "3 h ago", then the date. */
export function relativeTime(iso: string, now = Date.now()): string {
  const time = parseServerTime(iso).getTime()
  if (Number.isNaN(time)) return ''
  const seconds = Math.round((now - time) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)} d ago`
  return new Date(time).toLocaleDateString()
}
