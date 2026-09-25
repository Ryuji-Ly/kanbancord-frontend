import { useEffect, useRef } from 'react'
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
  /** Dragging is paused while filtering; the bar says so when the user could otherwise drag. */
  canMoveTasks: boolean
}

/** Search and filters above the board. Press "/" anywhere on the board to jump to the search. */
export function BoardFilterBar({
  filters,
  onChange,
  features,
  people,
  labels,
  priorities,
  shownCount,
  totalCount,
  canMoveTasks,
}: BoardFilterBarProps) {
  const searchRef = useRef<HTMLInputElement | null>(null)
  const filtering = isFiltering(filters)
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
    <div className="kc-board-filters" role="search" aria-label="Search and filter tasks">
      <label className="kc-board-search">
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

      {filtering && (
        <>
          <span className="kc-muted kc-board-filter-count" aria-live="polite">
            {shownCount} of {totalCount} tasks
            {canMoveTasks && ' · clear filters to drag tasks'}
          </span>
          <button type="button" className="kc-btn kc-btn-ghost kc-board-filter-clear" onClick={() => onChange(NO_FILTERS)}>
            <FiX aria-hidden="true" /> Clear
          </button>
        </>
      )}
    </div>
  )
}
