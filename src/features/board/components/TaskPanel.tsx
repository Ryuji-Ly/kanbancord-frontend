import { useState } from 'react'
import { FiBell, FiBellOff } from 'react-icons/fi'
import { formatLocale, t } from '../../../i18n'
import type { LabelEntry, PriorityEntry } from '../../../services/boardsService'
import type { ServerRoleEntry } from '../../../services/permissionsService'
import type { TaskEntry } from '../../../services/tasksService'
import type { MeResponse } from '../../../types/auth'
import { taskFieldsFromDraft, type TaskFields } from '../boardQueries'
import { draftFromTask, toggleTaskListItemByIndex, type AssigneeMember, type BoardAbilities, type TaskDraft } from '../boardModel'
import { AssigneePicker } from './AssigneePicker'
import { LabelChip, LabelPicker } from './LabelPicker'
import { PriorityBadge, PriorityPicker } from './PriorityPicker'
import { RolePicker } from './RolePicker'
import { hasPendingUploads } from '../../../services/mediaService'
import { Markdown } from './Markdown'
import { MarkdownEditor } from './MarkdownEditor'
import { TaskComments } from './TaskComments'

type TaskPanelProps = {
  serverId: string
  boardId: string
  task: TaskEntry
  me: MeResponse | null
  abilities: BoardAbilities
  assignees: AssigneeMember[]
  members: AssigneeMember[]
  priorities: PriorityEntry[]
  /** Every label of the board. */
  labels: LabelEntry[]
  /** The labels on this task. */
  taskLabels: { label: LabelEntry; taskLabelId: number }[]
  /** The server's roles, and those assigned to this task. */
  roles: ServerRoleEntry[]
  taskRoles: { role: ServerRoleEntry; assignmentId: number }[]
  saving: boolean
  /** Whether you follow this task, hearing about it by direct message. */
  following: boolean
  onToggleFollow: (following: boolean) => Promise<unknown>
  onClose: () => void
  onSave: (fields: TaskFields) => Promise<unknown>
  onRequestDelete: () => void
  onAssign: (userId: string) => Promise<unknown>
  onUnassign: (assignee: AssigneeMember) => Promise<unknown>
  onAssignRole: (roleId: string) => Promise<unknown>
  onUnassignRole: (assignmentId: number) => Promise<unknown>
  onAddLabel: (labelId: number) => Promise<unknown>
  onRemoveLabel: (taskLabelId: number) => Promise<unknown>
  onCreateLabel: (name: string) => Promise<LabelEntry>
  onCreatePriority: (name: string) => Promise<PriorityEntry>
}

/**
 * The side panel for one task: its fields (editable with EDIT_TASK), assignees and comments.
 * Render it with `key={task.taskId}` so opening another task starts from that task's values.
 */
export function TaskPanel({
  serverId,
  boardId,
  task,
  me,
  abilities,
  assignees,
  members,
  priorities,
  labels,
  taskLabels,
  roles,
  taskRoles,
  saving,
  following,
  onToggleFollow,
  onClose,
  onSave,
  onRequestDelete,
  onAssign,
  onUnassign,
  onAssignRole,
  onUnassignRole,
  onAddLabel,
  onRemoveLabel,
  onCreateLabel,
  onCreatePriority,
}: TaskPanelProps) {
  const [draft, setDraft] = useState<TaskDraft>(() => draftFromTask(task))
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [togglingChecklist, setTogglingChecklist] = useState(false)

  const assigneeIds = new Set(assignees.map((assignee) => assignee.userId))
  const uploading = hasPendingUploads(draft.description)
  const features = abilities.features
  const priority = features.PRIORITIES ? (priorities.find((level) => level.priorityId === task.priorityId) ?? null) : null
  const shownDueDate = features.DUE_DATES ? task.dueDate : null
  const canManageAssignee = (userId: string) =>
    me !== null && (abilities.assignOthers || (abilities.assignSelf && String(me.userId) === userId))

  async function save() {
    if (!draft.title.trim()) {
      setError(t('board.createTask.titleRequired'))
      return
    }
    setError('')
    try {
      await onSave(taskFieldsFromDraft(draft))
    } catch (err) {
      setError(String(err))
    }
  }

  /** Ticking a checklist item in the description saves straight away. */
  async function toggleDescriptionChecklist(itemIndex: number, checked: boolean) {
    if (!abilities.editTask || togglingChecklist) return
    const previous = draft.description
    const next = toggleTaskListItemByIndex(previous, itemIndex, checked)
    if (next === previous) return

    setDraft((prev) => ({ ...prev, description: next }))
    setError('')
    setTogglingChecklist(true)
    try {
      await onSave(taskFieldsFromDraft({ ...draft, description: next }, task.title))
    } catch (err) {
      setDraft((prev) => ({ ...prev, description: previous }))
      setError(String(err))
    } finally {
      setTogglingChecklist(false)
    }
  }

  function reportError(action: Promise<unknown>) {
    action.catch((err) => setError(String(err)))
  }

  const saveOnEnter = (event: { key: string }) => {
    if (event.key === 'Enter') void save()
  }

  return (
    <aside
      className={`kc-task-panel${expanded ? ' kc-task-panel--expanded' : ''}`}
      aria-label={t('board.panel.title')}
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target === event.currentTarget && abilities.editTask) {
          void save()
        }
      }}
    >
      <div className="kc-task-panel-header">
        <h3 className="kc-task-panel-title">{t('board.panel.title')}</h3>
        <div className="kc-task-panel-header-actions">
          <button
            type="button"
            className={`kc-btn kc-btn-small ${following ? 'kc-btn-primary' : 'kc-btn-ghost'} kc-follow-btn`}
            aria-pressed={following}
            title={following ? t('board.panel.followingHint') : t('board.panel.followHint')}
            onClick={() => {
              setError('')
              onToggleFollow(!following).catch((reason: unknown) =>
                setError(reason instanceof Error ? reason.message : t('board.panel.followFailed')),
              )
            }}
          >
            {following ? <FiBellOff aria-hidden="true" /> : <FiBell aria-hidden="true" />}
            {following ? t('board.panel.following') : t('board.panel.follow')}
          </button>
          <button
            type="button"
            className="kc-modal-close"
            aria-label={expanded ? t('board.panel.collapsePanel') : t('board.panel.expandPanel')}
            title={expanded ? t('permissions.collapse') : t('permissions.expand')}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? '⊡' : '⊞'}
          </button>
          <button type="button" className="kc-modal-close" aria-label={t('board.panel.close')} onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      <div
        className="kc-task-panel-body"
        onClick={(event) => {
          const target = event.target as Element
          if (!target.closest('input, textarea, button, select, a, [role="button"]')) {
            setExpanded((prev) => !prev)
          }
        }}
      >
        {error && <p className="kc-banner">{error}</p>}

        {abilities.editTask ? (
          <>
            <label className="kc-field">
              <span className="kc-field-label">{t('board.fields.title')}</span>
              <input
                className="kc-input"
                value={draft.title}
                maxLength={200}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                onKeyDown={saveOnEnter}
              />
            </label>

            {(features.PRIORITIES || features.DUE_DATES) && (
              <div className="kc-task-modal-grid">
                {features.PRIORITIES && (
                  <div className="kc-field">
                    <span className="kc-field-label">{t('board.fields.priority')}</span>
                    <PriorityPicker
                      priorities={priorities}
                      value={draft.priorityId}
                      canCreate={abilities.managePriorities}
                      onChange={(priorityId) => setDraft((prev) => ({ ...prev, priorityId }))}
                      onCreate={onCreatePriority}
                    />
                  </div>
                )}

                {features.DUE_DATES && (
                  <label className="kc-field">
                    <span className="kc-field-label">{t('board.fields.dueDateTitle')}</span>
                    <input
                      className="kc-input"
                      type="datetime-local"
                      value={draft.dueDate}
                      onChange={(event) => setDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
                      onKeyDown={saveOnEnter}
                    />
                  </label>
                )}
              </div>
            )}

            <div className="kc-field">
              <span className="kc-field-label">{t('common.description')}</span>
              {editingDescription ? (
                <MarkdownEditor
                  autoFocus
                  value={draft.description}
                  onChange={(description) => setDraft((prev) => ({ ...prev, description }))}
                  upload={{ serverId, boardId }}
                  onBlur={() => setEditingDescription(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      setEditingDescription(false)
                    }
                  }}
                />
              ) : (
                <div
                  className={`kc-task-description-preview kc-markdown${!draft.description ? ' kc-task-description-preview--empty' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation()
                    setEditingDescription(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setEditingDescription(true)
                  }}
                  title={t('board.panel.editDescription')}
                >
                  {draft.description ? (
                    <Markdown
                      editable={!togglingChecklist}
                      onToggle={(itemIndex, checked) => void toggleDescriptionChecklist(itemIndex, checked)}
                    >
                      {draft.description}
                    </Markdown>
                  ) : (
                    <span className="kc-task-description-preview__placeholder">{t('board.panel.addDescription')}</span>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="kc-task-panel-field">
              <span className="kc-field-label">{t('board.fields.title')}</span>
              <p className="kc-task-panel-value">{task.title}</p>
            </div>
            {(priority || shownDueDate) && (
              <div className="kc-task-modal-grid">
                {priority && (
                  <div className="kc-task-panel-field">
                    <span className="kc-field-label">{t('board.fields.priority')}</span>
                    <p className="kc-task-panel-value">
                      <PriorityBadge priority={priority} />
                    </p>
                  </div>
                )}
                {shownDueDate && (
                  <div className="kc-task-panel-field">
                    <span className="kc-field-label">{t('board.fields.dueDateTitle')}</span>
                    <p className="kc-task-panel-value">{new Date(shownDueDate).toLocaleString(formatLocale())}</p>
                  </div>
                )}
              </div>
            )}
            {task.description && (
              <div className="kc-task-panel-field">
                <span className="kc-field-label">{t('common.description')}</span>
                <div className="kc-task-panel-value kc-task-panel-value--description kc-markdown">
                  <Markdown>{task.description}</Markdown>
                </div>
              </div>
            )}
          </>
        )}

        {(taskLabels.length > 0 || abilities.applyLabel) && (
          <div className="kc-task-panel-field">
            <span className="kc-field-label">{t('board.fields.labels')}</span>
            {abilities.applyLabel || abilities.removeLabel ? (
              <LabelPicker
                labels={labels}
                selectedIds={taskLabels.map((entry) => entry.label.labelId)}
                canApply={abilities.applyLabel}
                canRemove={abilities.removeLabel}
                canCreate={abilities.createLabel}
                onAdd={(labelId) => reportError(onAddLabel(labelId))}
                onRemove={(labelId) => {
                  const entry = taskLabels.find((candidate) => candidate.label.labelId === labelId)
                  if (entry) reportError(onRemoveLabel(entry.taskLabelId))
                }}
                onCreate={onCreateLabel}
              />
            ) : (
              <div className="kc-label-row">
                {taskLabels.map((entry) => (
                  <LabelChip key={entry.taskLabelId} label={entry.label} />
                ))}
              </div>
            )}
          </div>
        )}

        {(assignees.length > 0 || abilities.assignSelf || abilities.assignOthers) && (
          <div className="kc-task-panel-field">
            <span className="kc-field-label">{t('board.fields.assignees')}</span>
            <AssigneePicker
              assignees={assignees}
              candidates={members}
              searchable={abilities.assignOthers}
              canRemove={(assignee) => canManageAssignee(assignee.userId)}
              onRemove={(assignee) => reportError(onUnassign(assignee))}
              onPick={(member) => reportError(onAssign(member.userId))}
              extra={
                abilities.assignSelf &&
                !abilities.assignOthers &&
                me &&
                !assigneeIds.has(String(me.userId)) && (
                  <button
                    type="button"
                    className="kc-btn kc-btn-ghost"
                    onClick={() => reportError(onAssign(String(me.userId)))}
                  >
                    {t('board.panel.assignYourself')}
                  </button>
                )
              }
            />
            {assignees.length === 0 && <p className="kc-task-panel-value">{t('board.panel.noAssignees')}</p>}
          </div>
        )}

        {(taskRoles.length > 0 || (abilities.assignOthers && roles.length > 0)) && (
          <div className="kc-task-panel-field">
            <span className="kc-field-label">{t('board.fields.roles')}</span>
            <RolePicker
              roles={roles}
              selectedIds={taskRoles.map((entry) => entry.role.roleId)}
              editable={abilities.assignOthers}
              onAdd={(roleId) => reportError(onAssignRole(roleId))}
              onRemove={(roleId) => {
                const entry = taskRoles.find((candidate) => candidate.role.roleId === roleId)
                if (entry) reportError(onUnassignRole(entry.assignmentId))
              }}
            />
          </div>
        )}

        {features.COMMENTS && (
          <TaskComments serverId={serverId} boardId={boardId} taskId={task.taskId} me={me} abilities={abilities} />
        )}
      </div>

      {(abilities.editTask || abilities.deleteTask) && (
        <div className="kc-task-panel-footer">
          {abilities.deleteTask && (
            <button type="button" className="kc-btn kc-btn-danger" onClick={onRequestDelete} disabled={saving}>
              {t('common.delete')}
            </button>
          )}
          {abilities.editTask && (
            <div className="kc-task-panel-footer-actions">
              <button type="button" className="kc-btn kc-btn-ghost" onClick={onClose} disabled={saving}>
                {t('board.panel.discard')}
              </button>
              <button
                type="button"
                className="kc-btn kc-btn-primary"
                onClick={() => void save()}
                disabled={saving || uploading}
                title={uploading ? t('board.panel.waitForUploads') : undefined}
              >
                {saving ? t('common.savingDots') : uploading ? t('board.panel.uploading') : t('common.save')}
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
