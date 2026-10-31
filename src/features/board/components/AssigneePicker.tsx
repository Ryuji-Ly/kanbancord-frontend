import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { t } from '../../../i18n'
import { mergeMembers } from '../../../services/serverMembersService'
import { rememberMember, useMemberSearch } from '../../server/serverQueries'
import { resolveAssigneeDisplayName, searchMembers, toAssigneeMembers, type AssigneeMember } from '../boardModel'
import { AssigneeAvatar } from './TaskCard'

type AssigneePickerProps = {
  assignees: AssigneeMember[]
  /** Members that can be searched and added; ignored unless `searchable`. */
  candidates: AssigneeMember[]
  /** Also searches everyone in this server, not only the people in `candidates`. */
  serverId?: string
  searchable: boolean
  canRemove: (assignee: AssigneeMember) => boolean
  onRemove: (assignee: AssigneeMember) => void
  onPick: (member: AssigneeMember) => void
  /** Rendered after the chips, e.g. an "Assign yourself" button. */
  extra?: ReactNode
}

/** Assignee chips with remove buttons, and a member search that adds the picked member. */
export function AssigneePicker({ assignees, candidates, serverId, searchable, canRemove, onRemove, onPick, extra }: AssigneePickerProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const queryClient = useQueryClient()
  const found = useMemberSearch(searchable ? (serverId ?? '') : '', deferredQuery).data
  const results = useMemo(
    () =>
      searchMembers(
        mergeMembers(candidates, found && toAssigneeMembers(found)),
        deferredQuery,
        new Set(assignees.map((assignee) => assignee.userId)),
      ),
    [candidates, found, deferredQuery, assignees],
  )

  const pick = (member: AssigneeMember) => {
    const entry = found?.find((candidate) => String(candidate.userId) === member.userId)
    if (serverId && entry) rememberMember(queryClient, serverId, entry)
    onPick(member)
    setQuery('')
  }

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
                aria-label={t('permissions.row.removeNamed', { name: resolveAssigneeDisplayName(assignee) })}
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
            placeholder={t('board.pickers.searchUser')}
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
                onClick={() => pick(member)}
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
