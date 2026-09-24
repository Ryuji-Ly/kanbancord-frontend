import { useState } from 'react'
import { FiArrowDown, FiArrowUp } from 'react-icons/fi'
import { readableError } from '../../api/http'
import type { PriorityEntry } from '../../services/boardsService'
import type { TaskEntry } from '../../services/tasksService'
import type { useBoardCatalogMutations } from '../board/boardQueries'
import { ColorField } from './ColorField'
import { ConfirmDialog } from '../board/components/ConfirmDialog'
import { PriorityBadge } from '../board/components/PriorityPicker'

const NEW_LEVEL_COLOR = '#64748b'

type PrioritiesSettingsProps = {
  /** Most urgent first. */
  priorities: PriorityEntry[]
  tasks: TaskEntry[]
  canManage: boolean
  mutations: ReturnType<typeof useBoardCatalogMutations>
}

/** The board's priority levels, most urgent first: add, rename, recolour, reorder and delete. */
export function PrioritiesSettings({ priorities, tasks, canManage, mutations }: PrioritiesSettingsProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(NEW_LEVEL_COLOR)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<PriorityEntry | null>(null)

  const usage = (priorityId: number) => tasks.filter((task) => task.priorityId === priorityId).length

  function run(action: Promise<unknown>) {
    setError('')
    action.catch((err: unknown) => setError(readableError(err, 'The change could not be saved')))
  }

  function add() {
    const name = newName.trim()
    if (!name) return
    run(
      mutations.addPriority.mutateAsync({ name, color: newColor }).then(() => {
        setNewName('')
        setNewColor(NEW_LEVEL_COLOR)
      }),
    )
  }

  function save(level: PriorityEntry, changes: { name?: string; color?: string }) {
    const name = (changes.name ?? level.name).trim()
    const color = changes.color ?? level.color ?? NEW_LEVEL_COLOR
    if (!name || (name === level.name && color === level.color)) return
    run(mutations.editPriority.mutateAsync({ priorityId: level.priorityId, name, color }))
  }

  function move(level: PriorityEntry, index: number) {
    run(mutations.reorderPriority.mutateAsync({ priorityId: level.priorityId, index }))
  }

  return (
    <section className="kc-board-modal-section">
      <div className="kc-board-modal-section-head">
        <h4>Priorities</h4>
        <p className="kc-muted">
          Priority levels, most urgent first. A task has at most one. Changes here apply immediately.
        </p>
      </div>
      {error && <p className="kc-banner">{error}</p>}

      {priorities.length === 0 ? (
        <p className="kc-muted">No priority levels. Tasks on this board have no priority.</p>
      ) : (
        <ol className="kc-settings-list">
          {priorities.map((level, index) => (
            <li key={level.priorityId} className="kc-settings-row">
              {canManage ? (
                <>
                  <span className="kc-settings-order">
                    <button
                      type="button"
                      className="kc-icon-btn"
                      aria-label={`Move ${level.name} up`}
                      disabled={index === 0}
                      onClick={() => move(level, index - 1)}
                    >
                      <FiArrowUp aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="kc-icon-btn"
                      aria-label={`Move ${level.name} down`}
                      disabled={index === priorities.length - 1}
                      onClick={() => move(level, index + 1)}
                    >
                      <FiArrowDown aria-hidden="true" />
                    </button>
                  </span>
                  <ColorField
                    key={level.color ?? NEW_LEVEL_COLOR}
                    value={level.color ?? NEW_LEVEL_COLOR}
                    label={`Colour of ${level.name}`}
                    onCommit={(color) => save(level, { color })}
                  />
                  <input
                    key={level.name}
                    className="kc-input kc-settings-name"
                    aria-label="Priority name"
                    maxLength={50}
                    defaultValue={level.name}
                    onBlur={(event) => save(level, { name: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                    }}
                  />
                </>
              ) : (
                <PriorityBadge priority={level} />
              )}
              <span className="kc-muted kc-settings-usage">
                {usage(level.priorityId)} task{usage(level.priorityId) === 1 ? '' : 's'}
              </span>
              {canManage && (
                <button type="button" className="kc-btn kc-btn-ghost kc-btn-small" onClick={() => setDeleting(level)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {canManage && (
        <div className="kc-settings-row kc-settings-add">
          <input
            type="color"
            className="kc-color-input"
            aria-label="Colour of the new level"
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
          />
          <input
            className="kc-input kc-settings-name"
            placeholder="New level, added at the bottom"
            maxLength={50}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') add()
            }}
          />
          <button
            type="button"
            className="kc-btn kc-btn-primary kc-btn-small"
            disabled={!newName.trim() || mutations.addPriority.isPending}
            onClick={add}
          >
            Add level
          </button>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete priority level"
          busy={mutations.removePriority.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            run(mutations.removePriority.mutateAsync(deleting.priorityId))
            setDeleting(null)
          }}
        >
          <p>
            Delete <strong>{deleting.name}</strong>?
            {usage(deleting.priorityId) > 0 &&
              ` The ${usage(deleting.priorityId)} task${usage(deleting.priorityId) === 1 ? '' : 's'} with this priority will have none.`}
          </p>
        </ConfirmDialog>
      )}
    </section>
  )
}
