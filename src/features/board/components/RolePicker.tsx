import { useState } from 'react'
import { t } from '../../../i18n'
import type { ServerRoleEntry } from '../../../services/permissionsService'
import { roleColor } from '../boardModel'

/** A Discord role, shown the way Discord shows a mention: "@Name" in the role's colour. */
export function RoleChip({ role, onRemove }: { role: Pick<ServerRoleEntry, 'name' | 'color'>; onRemove?: () => void }) {
  const color = roleColor(role.color)
  return (
    <span className="kc-role-chip" style={color ? { color, borderColor: color } : undefined}>
      <span className="kc-role-chip-name">@{role.name}</span>
      {onRemove && (
        <button type="button" className="kc-label-chip-remove" aria-label={t('board.pickers.removeRole', { name: role.name })} onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  )
}

type RolePickerProps = {
  /** The server's roles, as they can be picked. */
  roles: ServerRoleEntry[]
  selectedIds: string[]
  editable: boolean
  onAdd: (roleId: string) => void
  onRemove: (roleId: string) => void
}

/** The roles assigned to a task, and a search that assigns another of the server's roles. */
export function RolePicker({ roles, selectedIds, editable, onAdd, onRemove }: RolePickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = selectedIds
    .map((id) => roles.find((role) => role.roleId === id))
    .filter((role): role is ServerRoleEntry => Boolean(role))
  const needle = query.trim().toLowerCase()
  // @everyone has the server's id; assigning it would mean "anyone", which is what no role means.
  const options = roles
    .filter((role) => role.roleId !== role.serverId && role.name !== '@everyone')
    .filter((role) => !selectedIds.includes(role.roleId) && role.name.toLowerCase().includes(needle))
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
    .slice(0, 50)

  function pick(roleId: string) {
    onAdd(roleId)
    setQuery('')
  }

  return (
    <div className="kc-picker">
      <div className="kc-task-assignee-chip-list">
        {selected.map((role) => (
          <RoleChip key={role.roleId} role={role} onRemove={editable ? () => onRemove(role.roleId) : undefined} />
        ))}
        {editable && (
          <input
            className="kc-task-assignee-input"
            value={query}
            placeholder={t('board.pickers.assignRole')}
            aria-label={t('board.pickers.searchRoles')}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              event.stopPropagation()
              const exact = options.find((role) => role.name.toLowerCase() === needle)
              if (exact) pick(exact.roleId)
              else if (options.length === 1) pick(options[0].roleId)
            }}
          />
        )}
        {!editable && selected.length === 0 && <span className="kc-muted">{t('board.pickers.noRoles')}</span>}
      </div>

      {editable && open && options.length > 0 && (
        <ul className="kc-task-assignee-results" role="listbox" aria-label={t('board.pickers.roles')}>
          {options.map((role) => (
            <li key={role.roleId}>
              <button
                type="button"
                className="kc-task-assignee-result"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(role.roleId)}
              >
                <RoleChip role={role} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
