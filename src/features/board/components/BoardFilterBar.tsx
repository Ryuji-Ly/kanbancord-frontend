import { useEffect, useRef, useState } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'
import type { LabelEntry, PriorityEntry } from '../../../services/boardsService'
import type { ServerFeatures } from '../../../services/featuresService'
import type { AssigneeMember } from '../boardModel'
import { isFiltering, NO_FILTERS, type BoardFilters } from '../boardFilters'

type BoardFilterBarProps = {
  filters: BoardFilters
  onChange: (filters: BoardFilters) => void
  /** Features shown on this board; filters for the others are left out. */
  features: ServerFeatures
  /** People assigned to tasks on this board. */
  people: AssigneeMember[]
  labels: LabelEntry[]
  priorities: PriorityEntry[]
  shownCount: number
  totalCount: number
}

/** How many filters besides the search are set, for the summary while they are tucked away. */
function activeFilterCount(filters: BoardFilters): number {
  return [filters.assignee, filters.label, filters.priority, filters.due].filter(Boolean).length
}

/**
 * Search and filters in the board's title bar. Only the search shows until you use it; the other
 * filters open beside it while it has focus, and tuck away again afterwards. While any filter is
 * set, a summary and a clear button stay visible. Press "/" anywhere on the board to search.
 */
export function BoardFilterBar({ filters, onChange, features, people, labels, priorities, shownCount, totalCount }: BoardFilterBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const filtering = isFiltering(filters)
  const others = activeFilterCount(filters)
  const set = (changes: Partial<BoardFilters>) => onChange({ ...filters, ...changes })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing = target.closest('input, textarea, select, [contenteditable="true"]')
      if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      ref={rootRef}
      className={`kc-task-filters${open ? ' kc-task-filters--open' : ''}`}
      role="search"
      aria-label="Search and filter tasks"
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <label className="kc-task-search">
        <FiSearch aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          className="kc-input"
          placeholder="Search tasks  /"
          aria-label="Search tasks by title or description"
          value={filters.query}
          onChange={(event) => set({ query: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              set({ query: '' })
              event.currentTarget.blur()
            }
          }}
        />
      </label>

      {open && (
        <>
          {features.ASSIGNEES && (
            <select className="kc-input" aria-label="Filter by assignee" value={filters.assignee} onChange={(event) => set({ assignee: event.target.value })}>
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="none">Unassigned</option>
              {people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.nickname ?? person.displayName}
                </option>
              ))}
            </select>
          )}
          {features.LABELS && labels.length > 0 && (
            <select className="kc-input" aria-label="Filter by label" value={filters.label} onChange={(event) => set({ label: event.target.value })}>
              <option value="">Any label</option>
              {labels.map((label) => (
                <option key={label.labelId} value={String(label.labelId)}>
                  {label.name}
                </option>
              ))}
            </select>
          )}
          {features.PRIORITIES && priorities.length > 0 && (
            <select className="kc-input" aria-label="Filter by priority" value={filters.priority} onChange={(event) => set({ priority: event.target.value })}>
              <option value="">Any priority</option>
              {priorities.map((level) => (
                <option key={level.priorityId} value={String(level.priorityId)}>
                  {level.name}
                </option>
              ))}
              <option value="none">No priority</option>
            </select>
          )}
          {features.DUE_DATES && (
            <select
              className="kc-input"
              aria-label="Filter by due date"
              value={filters.due}
              onChange={(event) => set({ due: event.target.value as BoardFilters['due'] })}
            >
              <option value="">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="week">Due in the next 7 days</option>
              <option value="none">No due date</option>
            </select>
          )}
        </>
      )}

      {filtering && (
        <>
          <span className="kc-muted kc-task-filter-count" aria-live="polite" title="Dragging tasks waits until filters are cleared">
            {shownCount}/{totalCount}
            {!open && others > 0 && ` · ${others} filter${others === 1 ? '' : 's'}`}
          </span>
          <button
            type="button"
            className="kc-icon-btn kc-task-filter-clear"
            aria-label="Clear search and filters"
            title="Clear search and filters"
            onClick={() => onChange(NO_FILTERS)}
          >
            <FiX aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}
