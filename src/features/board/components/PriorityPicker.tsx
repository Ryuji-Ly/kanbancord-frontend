import { useState } from 'react'
import type { PriorityEntry } from '../../../services/boardsService'
import { FiFlag } from 'react-icons/fi'
import { priorityStyle } from '../boardModel'

/**
 * A priority level: an outlined pill with a flag, so it reads differently from labels, which are
 * solid, square-cornered tags.
 */
export function PriorityBadge({
  priority,
  className = '',
}: {
  priority: Pick<PriorityEntry, 'name' | 'color'> & { position?: number }
  className?: string
}) {
  return (
    <span
      className={`kc-priority-badge ${className}`}
      style={priorityStyle(priority.color)}
    >
      <FiFlag className="kc-priority-flag" aria-hidden="true" />
      {priority.position !== undefined && <span className="kc-priority-rank">P{priority.position}</span>}
      {priority.name}
    </span>
  )
}

type PriorityPickerProps = {
  /** The board's levels, most urgent first. */
  priorities: PriorityEntry[]
  value: number | null
  /** Typing a name that does not exist offers to add it as a new level, at the bottom of the list. */
  canCreate: boolean
  onChange: (priorityId: number | null) => void
  onCreate: (name: string) => Promise<PriorityEntry>
}

/** Picks one of the board's priority levels, or none; can add a new level by typing its name. */
export function PriorityPicker({ priorities, value, canCreate, onChange, onCreate }: PriorityPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const current = priorities.find((level) => level.priorityId === value) ?? null
  const needle = query.trim().toLowerCase()
  const options = priorities.filter((level) => level.name.toLowerCase().includes(needle))
  const offerCreate = canCreate && needle.length > 0 && !priorities.some((level) => level.name.toLowerCase() === needle)

  function choose(priorityId: number | null) {
    onChange(priorityId)
    setQuery('')
    setOpen(false)
  }

  async function create() {
    const name = query.trim()
    if (!name || creating) return
    setCreating(true)
    setError('')
    try {
      const created = await onCreate(name)
      choose(created.priorityId)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="kc-picker">
      <div className="kc-priority-picker-field">
        {current && !open && !query && <PriorityBadge priority={current} className="kc-priority-picker-current" />}
        <input
          className="kc-input kc-priority-picker-input"
          value={query}
          placeholder={open ? (canCreate ? 'Search or add a level' : 'Search') : current ? '' : 'None'}
          aria-label="Priority"
          role="combobox"
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() =>
            window.setTimeout(() => {
              setOpen(false)
              setQuery('')
            }, 150)
          }
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              return
            }
            if (event.key !== 'Enter') return
            event.preventDefault()
            event.stopPropagation()
            const exact = options.find((level) => level.name.toLowerCase() === needle)
            if (exact) choose(exact.priorityId)
            else if (offerCreate) void create()
            else if (options.length === 1) choose(options[0].priorityId)
          }}
        />
      </div>

      {open && (
        <ul className="kc-task-assignee-results kc-priority-picker-options" role="listbox" aria-label="Priority levels">
          {!needle && (
            <li>
              <button type="button" className="kc-task-assignee-result" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(null)}>
                <span className="kc-muted">None</span>
              </button>
            </li>
          )}
          {options.map((level) => (
            <li key={level.priorityId}>
              <button
                type="button"
                className={`kc-task-assignee-result${level.priorityId === value ? ' kc-task-assignee-result--selected' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(level.priorityId)}
              >
                <PriorityBadge priority={level} />
              </button>
            </li>
          ))}
          {offerCreate && (
            <li>
              <button type="button" className="kc-task-assignee-result" disabled={creating} onMouseDown={(e) => e.preventDefault()} onClick={() => void create()}>
                {creating ? 'Adding…' : `Add priority "${query.trim()}"`}
              </button>
            </li>
          )}
        </ul>
      )}
      {error && <p className="kc-field-error">{error}</p>}
    </div>
  )
}
