import { parseServerTime } from '../../api/http'
import { formatLocale, t, tOr, type MessageKey } from '../../i18n'
import type { AuditEntry } from '../../services/auditLogService'
import { FEATURES } from '../../services/featuresService'
import { DISCORD_FLAG_NAMES, KANBAN_PERM_INFO } from '../../services/permissionsService'

/** The kinds of change the log can be filtered by, and the entity types each covers. */
export const AUDIT_CATEGORIES: { key: string; label: MessageKey; entityTypes: string[] }[] = [
  { key: 'boards', label: 'audit.categories.boards', entityTypes: ['BOARD'] },
  { key: 'columns', label: 'audit.categories.columns', entityTypes: ['BOARD_COLUMN'] },
  { key: 'tasks', label: 'audit.categories.tasks', entityTypes: ['TASK'] },
  { key: 'assignments', label: 'audit.categories.assignments', entityTypes: ['TASK_ASSIGNMENT'] },
  { key: 'comments', label: 'audit.categories.comments', entityTypes: ['TASK_COMMENT'] },
  { key: 'labels', label: 'audit.categories.labels', entityTypes: ['LABEL', 'TASK_LABEL'] },
  { key: 'priorities', label: 'audit.categories.priorities', entityTypes: ['PRIORITY'] },
  { key: 'permissions', label: 'audit.categories.permissions', entityTypes: ['PERMISSION'] },
  { key: 'settings', label: 'audit.categories.settings', entityTypes: ['SETTINGS'] },
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

/** Fields that change as a side effect and say nothing about what the person did. */
const HIDDEN_FIELDS = new Set([
  'position', 'updatedAt', 'createdAt', 'editedByUsers', '_subject', '_column', '_fromColumn', 'columnId',
])
/** Fields holding the id of something else; shown as "#id". */
const ID_FIELDS = new Set(['priorityId'])

/** The name of an entity type (audit.nouns), or the type itself in lower case for one without. */
function noun(entityType: string): string {
  return tOr(`audit.nouns.${entityType}`, entityType.toLowerCase())
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function text(value: unknown, max = 60): string {
  if (value === null || value === undefined || value === '') return t('audit.none')
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
  if (subjectType === 'ROLE') return t('audit.role', { name: lookups.roles.get(id) ?? `#${id}` })
  if (subjectType === 'USER') return lookups.members.get(id) ?? t('audit.userNumber', { id })
  return t('audit.everyoneWith', { permission: DISCORD_FLAG_NAMES[id] ?? t('audit.aDiscordPermission') })
}

function describeRule(added: boolean, rule: Record<string, unknown> | null, lookups: AuditLookups): string {
  if (!rule) return t(added ? 'audit.ruleAddedUnknown' : 'audit.ruleRemovedUnknown')
  const key = String(rule.kanbanPermissionKey ?? '')
  // The board, if any, is named after the sentence.
  return t(added ? 'audit.ruleAdded' : 'audit.ruleRemoved', {
    state: t(rule.state === 'DENY' ? 'audit.deny' : 'audit.allow'),
    permission: KANBAN_PERM_INFO[key]?.name ?? key,
    subject: subjectLabel(rule.subjectType, rule.subjectId, lookups),
  })
}

function fieldChanges(entry: AuditEntry): AuditFieldChange[] {
  if (!entry.changes || snapshotOf(entry)) return []
  return Object.entries(entry.changes)
    .filter(([field]) => !HIDDEN_FIELDS.has(field))
    .map(([field, change]) => {
      const pair = record(change)
      const show = (value: unknown) => (ID_FIELDS.has(field) && value !== null && value !== undefined ? `#${value}` : text(value))
      return { field: tOr(`audit.fields.${field}`, field), from: show(pair?.from), to: show(pair?.to) }
    })
}

/** A sentence for the entry, without the actor: "created task "X"", "moved column "Y"". */
export function describeAuditEntry(entry: AuditEntry, lookups: AuditLookups): AuditDescription {
  const fields = fieldChanges(entry)
  const snapshot = snapshotOf(entry)
  const name = entityName(entry)
  const named = (thing: string) =>
    name ? t('audit.named', { noun: thing, name }) : t('audit.numbered', { noun: thing, id: entry.entityId ?? '?' })
  const taskNumber = () => t('audit.taskNumber', { id: String(snapshot?.taskId ?? '?') })

  switch (entry.action) {
    case 'TASK_ASSIGNMENT_CREATED':
    case 'TASK_ASSIGNMENT_DELETED': {
      const values = { assignee: lookups.members.get(String(snapshot?.userId ?? '')) ?? t('audit.someone'), task: taskNumber() }
      return { summary: t(entry.action.endsWith('CREATED') ? 'audit.assigned' : 'audit.unassigned', values), fields }
    }
    case 'TASK_ROLE_ASSIGNED':
    case 'TASK_ROLE_UNASSIGNED': {
      const roleId = String(snapshot?.roleId ?? '')
      const values = {
        assignee: t('audit.role', { name: lookups.roles.get(roleId) ?? `#${snapshot?.roleId ?? '?'}` }),
        task: taskNumber(),
      }
      return { summary: t(entry.action === 'TASK_ROLE_ASSIGNED' ? 'audit.assigned' : 'audit.unassigned', values), fields }
    }
    case 'TASK_LABEL_ADDED':
      return { summary: t('audit.labelAdded', { task: taskNumber() }), fields }
    case 'TASK_LABEL_REMOVED':
      return { summary: t('audit.labelRemoved', { task: taskNumber() }), fields }
    case 'PERMISSION_CREATED':
      return { summary: describeRule(true, snapshot, lookups), fields }
    case 'PERMISSION_DELETED':
      return { summary: describeRule(false, snapshot, lookups), fields }
    case 'PERMISSION_UPDATED':
      return { summary: t('audit.ruleChanged'), fields }
    case 'TASK_MOVED':
    case 'TASK_UPDATED': {
      // Column names are recorded from this version on; older entries fall back to the plain wording.
      const column = entry.changes?._column
      const fromColumn = entry.changes?._fromColumn
      if (typeof fromColumn === 'string' && typeof column === 'string') {
        const values = { task: named(noun('TASK')), from: fromColumn, to: column }
        const edited = entry.action === 'TASK_UPDATED' && fields.length > 0
        return { summary: t(edited ? 'audit.editedAndMoved' : 'audit.moved', values), fields }
      }
      if (entry.action === 'TASK_MOVED' && typeof column === 'string') {
        return { summary: t('audit.reorderedIn', { task: named(noun('TASK')), column }), fields }
      }
      break
    }
    case 'SERVER_FEATURES_UPDATED':
    case 'BOARD_FEATURES_UPDATED': {
      const featureNames: Record<string, string> = Object.fromEntries(FEATURES.map((feature) => [feature.key, feature.label]))
      const turned = (on: boolean) =>
        Object.entries(entry.changes ?? {})
          .filter(([key, change]) => !key.startsWith('_') && record(change)?.to === on)
          .map(([key]) => featureNames[key] ?? key)
      const on = turned(true)
      const off = turned(false)
      const changes =
        on.length > 0 && off.length > 0
          ? t('audit.turnedOnAndOff', { on: on.join(', '), off: off.join(', ') })
          : on.length > 0
            ? t('audit.turnedOn', { features: on.join(', ') })
            : off.length > 0
              ? t('audit.turnedOff', { features: off.join(', ') })
              : ''
      if (entry.action === 'SERVER_FEATURES_UPDATED') {
        return { summary: changes || t('audit.serverFeaturesChanged'), fields: [] }
      }
      const board = entry.boardName
        ? t('audit.named', { noun: noun('BOARD'), name: entry.boardName })
        : t('audit.numbered', { noun: noun('BOARD'), id: entry.boardId ?? '?' })
      return {
        summary: changes ? t('audit.onBoard', { changes, board }) : t('audit.boardFeaturesChanged', { board }),
        fields: [],
      }
    }
    case 'COLUMN_MOVED':
      return { summary: t('audit.reordered', { thing: named(noun('BOARD_COLUMN')) }), fields }
  }

  const verb = entry.action.slice(entry.action.lastIndexOf('_') + 1)
  const thing = named(noun(entry.entityType))
  return { summary: tOr(`audit.actions.${verb}`, `${verb.toLowerCase()} ${thing}`, { thing }), fields }
}

/** "just now", "5 min ago", "3 h ago", then the date. */
export function relativeTime(iso: string, now = Date.now()): string {
  const time = parseServerTime(iso).getTime()
  if (Number.isNaN(time)) return ''
  const seconds = Math.round((now - time) / 1000)
  if (seconds < 60) return t('audit.time.justNow')
  if (seconds < 3600) return t('audit.time.minutes', { count: Math.floor(seconds / 60) })
  if (seconds < 86_400) return t('audit.time.hours', { count: Math.floor(seconds / 3600) })
  if (seconds < 7 * 86_400) return t('audit.time.days', { count: Math.floor(seconds / 86_400) })
  return new Date(time).toLocaleDateString(formatLocale())
}
