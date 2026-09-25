import { useState } from 'react'
import type { BoardColumnEntry } from '../../../services/boardColumnsService'
import type { LabelEntry, PriorityEntry } from '../../../services/boardsService'
import type { ServerFeatures } from '../../../services/featuresService'
import type { ServerRoleEntry } from '../../../services/permissionsService'
import type { MeResponse } from '../../../types/auth'
import { EMPTY_TASK_DRAFT, resolveAssignee, type AssigneeMember, type TaskDraft } from '../boardModel'
import { hasPendingUploads } from '../../../services/mediaService'
import { AssigneePicker } from './AssigneePicker'
import { LabelPicker } from './LabelPicker'
import { MarkdownEditor } from './MarkdownEditor'
import { PriorityPicker } from './PriorityPicker'
import { RolePicker } from './RolePicker'

type CreateTaskModalProps = {
  /** The board, for uploading images and videos into the description. */
  serverId: string
  boardId: string
  column: BoardColumnEntry
  me: MeResponse | null
  canAssignSelf: boolean
  canAssignOthers: boolean
  members: AssigneeMember[]
  directory: Map<string, AssigneeMember>
  priorities: PriorityEntry[]
  labels: LabelEntry[]
  canApplyLabels: boolean
  canCreateLabels: boolean
  canCreatePriorities: boolean
  features: ServerFeatures
  /** The server's roles, which can be assigned with ASSIGN_TASK_OTHERS. */
  roles: ServerRoleEntry[]
  creating: boolean
  error: string
  onClose: () => void
  onCreate: (draft: TaskDraft, assigneeIds: string[], roleIds: string[], labelIds: number[]) => void
  onCreateLabel: (name: string) => Promise<LabelEntry>
  onCreatePriority: (name: string) => Promise<PriorityEntry>
}

export function CreateTaskModal({
  serverId,
  boardId,
  column,
  me,
  canAssignSelf,
  canAssignOthers,
  members,
  directory,
  priorities,
  labels,
  canApplyLabels,
  canCreateLabels,
  canCreatePriorities,
  features,
  roles,
  creating,
  error,
  onClose,
  onCreate,
  onCreateLabel,
  onCreatePriority,
}: CreateTaskModalProps) {
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_TASK_DRAFT)
  // Someone who may only assign themselves starts out assigned.
  const [assigneeIds, setAssigneeIds] = useState<string[]>(() =>
    canAssignSelf && !canAssignOthers && me ? [String(me.userId)] : [],
  )
  const [labelIds, setLabelIds] = useState<number[]>([])
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [validationError, setValidationError] = useState('')
  const canAssign = canAssignSelf || canAssignOthers

  function close() {
    if (!creating) onClose()
  }

  function submit() {
    if (!draft.title.trim()) {
      setValidationError('Task title is required.')
      return
    }
    setValidationError('')
    onCreate(draft, canAssign ? assigneeIds : [], canAssignOthers ? roleIds : [], canApplyLabels ? labelIds : [])
  }

  const shownError = validationError || error

  return (
    <div className="kc-modal-overlay" role="dialog" aria-modal="true" aria-label="Create Task" onClick={close}>
      <div className="kc-modal kc-task-modal" onClick={(event) => event.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title">Create task</h3>
          <button type="button" className="kc-modal-close" aria-label="Close create task modal" onClick={close}>
            ×
          </button>
        </div>
        <div className="kc-modal-body kc-task-modal-body">
          <p className="kc-muted">
            New tasks in <strong>{column.name}</strong> are added to the end of the column.
          </p>
          {shownError && <p className="kc-banner">{shownError}</p>}

          <label className="kc-field">
            <span className="kc-field-label">Title</span>
            <input
              className="kc-input"
              value={draft.title}
              maxLength={200}
              autoFocus
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>

          {(features.PRIORITIES || features.DUE_DATES) && (
            <div className="kc-task-modal-grid">
              {features.PRIORITIES && (
                <div className="kc-field">
                  <span className="kc-field-label">Priority</span>
                  <PriorityPicker
                    priorities={priorities}
                    value={draft.priorityId}
                    canCreate={canCreatePriorities}
                    onChange={(priorityId) => setDraft((prev) => ({ ...prev, priorityId }))}
                    onCreate={onCreatePriority}
                  />
                </div>
              )}

              {features.DUE_DATES && (
                <label className="kc-field">
                  <span className="kc-field-label">Due Date</span>
                  <input
                    className="kc-input"
                    type="datetime-local"
                    value={draft.dueDate}
                    onChange={(event) => setDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
                  />
                </label>
              )}
            </div>
          )}

          {canApplyLabels && (
            <div className="kc-field">
              <span className="kc-field-label">Labels</span>
              <LabelPicker
                labels={labels}
                selectedIds={labelIds}
                canApply
                canRemove
                canCreate={canCreateLabels}
                onAdd={(labelId) => setLabelIds((prev) => (prev.includes(labelId) ? prev : [...prev, labelId]))}
                onRemove={(labelId) => setLabelIds((prev) => prev.filter((id) => id !== labelId))}
                onCreate={onCreateLabel}
              />
            </div>
          )}

          <div className="kc-field">
            <span className="kc-field-label">Description</span>
            <MarkdownEditor
              value={draft.description}
              onChange={(description) => setDraft((prev) => ({ ...prev, description }))}
              upload={{ serverId, boardId }}
            />
          </div>

          {canAssign && (
            <div className="kc-field">
              <span className="kc-field-label">Assignees</span>
              <div className="kc-task-assignee-picker">
                <AssigneePicker
                  assignees={assigneeIds.map((id) => resolveAssignee(directory, id))}
                  candidates={members}
                  searchable={canAssignOthers}
                  canRemove={() => canAssignOthers}
                  onRemove={(assignee) => setAssigneeIds((prev) => prev.filter((id) => id !== assignee.userId))}
                  onPick={(member) => setAssigneeIds((prev) => [...prev, member.userId])}
                />
              </div>
            </div>
          )}

          {canAssignOthers && roles.length > 0 && (
            <div className="kc-field">
              <span className="kc-field-label">Roles</span>
              <RolePicker
                roles={roles}
                selectedIds={roleIds}
                editable
                onAdd={(roleId) => setRoleIds((prev) => (prev.includes(roleId) ? prev : [...prev, roleId]))}
                onRemove={(roleId) => setRoleIds((prev) => prev.filter((id) => id !== roleId))}
              />
            </div>
          )}
        </div>
        <div className="kc-task-modal-actions">
          <button type="button" className="kc-btn kc-btn-ghost" onClick={close} disabled={creating}>
            Cancel
          </button>
          <button
            type="button"
            className="kc-btn kc-btn-primary"
            onClick={submit}
            disabled={creating || hasPendingUploads(draft.description)}
          >
            {creating ? 'Creating...' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  )
}
