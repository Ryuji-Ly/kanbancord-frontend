import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { resolveAssigneeDisplayName, searchMembers, type AssigneeMember } from '../boardModel'
import { AssigneeAvatar } from './TaskCard'

type AssigneePickerProps = {
  assignees: AssigneeMember[]
  /** Members that can be searched and added; ignored unless `searchable`. */
  candidates: AssigneeMember[]
  searchable: boolean
  canRemove: (assignee: AssigneeMember) => boolean
  onRemove: (assignee: AssigneeMember) => void
  onPick: (member: AssigneeMember) => void
  /** Rendered after the chips, e.g. an "Assign yourself" button. */
  extra?: ReactNode
}

/** Assignee chips with remove buttons, and a member search that adds the picked member. */
export function AssigneePicker({ assignees, candidates, searchable, canRemove, onRemove, onPick, extra }: AssigneePickerProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () => searchMembers(candidates, deferredQuery, new Set(assignees.map((assignee) => assignee.userId))),
    [candidates, deferredQuery, assignees],
  )

  return (
    <>
      <div className="kc-task-assignee-chip-list">
        {assignees.map((assignee) => (
          <span key={assignee.userId} className="kc-task-assignee-chip">
            <AssigneeAvatar assignee={assignee} className="kc-task-assignee-chip-avatar" />
            <span className="kc-task-assignee-chip-label">{resolveAssigneeDisplayName(assignee)}</span>
            {canRemove(assignee) && (
              <button
                type="button"
                className="kc-task-assignee-chip-remove"
                aria-label={`Remove ${resolveAssigneeDisplayName(assignee)}`}
                onClick={() => onRemove(assignee)}
              >
                ×
              </button>
            )}
          </span>
        ))}

        {searchable && (
          <input
            className="kc-task-assignee-input"
            value={query}
            placeholder="Search user"
            onChange={(event) => setQuery(event.target.value)}
          />
        )}

        {extra}
      </div>

      {searchable && query.trim() && results.length > 0 && (
        <ul className="kc-task-assignee-results" role="listbox">
          {results.map((member) => (
            <li key={member.userId}>
              <button
                type="button"
                className="kc-task-assignee-result"
                onClick={() => {
                  onPick(member)
                  setQuery('')
                }}
              >
                <AssigneeAvatar assignee={member} className="kc-task-assignee-chip-avatar" />
                <span className="kc-task-assignee-result-main">
                  <strong>{resolveAssigneeDisplayName(member)}</strong>
                  <small>@{member.username}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
