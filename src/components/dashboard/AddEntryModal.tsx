import { FiX } from 'react-icons/fi'
import {
  CATEGORY_ORDER,
  KANBAN_PERM_INFO,
  type KanbanCatalogEntry,
  type ServerMemberEntry,
  type ServerRoleEntry,
} from '../../services/permissionsService'

type AddEntryModalProps = {
  show: boolean
  loading: boolean
  saving: boolean
  modalSearch: string
  subjectType: string | null
  subjectDisplay: string | null
  modalPermStates: Record<number, 'ALLOW' | 'DENY'>
  filteredDiscordPerms: Array<{ id: string; name: string }>
  filteredRoles: ServerRoleEntry[]
  filteredMembers: ServerMemberEntry[]
  grantableCatalogEntries: KanbanCatalogEntry[]
  onClose: () => void
  onSearchChange: (value: string) => void
  onSelectSubject: (subjectType: string, subjectId: string, display: string) => void
  onClearSubject: () => void
  onCyclePermState: (permissionId: number) => void
  onSave: () => void
}

export function AddEntryModal({
  show,
  loading,
  saving,
  modalSearch,
  subjectType,
  subjectDisplay,
  modalPermStates,
  filteredDiscordPerms,
  filteredRoles,
  filteredMembers,
  grantableCatalogEntries,
  onClose,
  onSearchChange,
  onSelectSubject,
  onClearSubject,
  onCyclePermState,
  onSave,
}: AddEntryModalProps) {
  if (!show) return null

  return (
    <div
      className="kc-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add Permission Entry"
      onClick={onClose}
    >
      <div className="kc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title">Add Permission Entry</h3>
          <button type="button" className="kc-modal-close" onClick={onClose} aria-label="Close modal">
            <FiX aria-hidden="true" />
          </button>
        </div>

        <div className="kc-modal-body">
          {loading ? (
            <div className="kc-loading-state">
              <span className="kc-spinner" aria-hidden="true" />
              <span className="kc-muted">Loading...</span>
            </div>
          ) : subjectType === null ? (
            <>
              <input
                className="kc-modal-search"
                type="text"
                placeholder="Search Discord permissions, roles, or members..."
                value={modalSearch}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus
                aria-label="Search subjects"
              />
              <div className="kc-modal-subject-list">
                {filteredDiscordPerms.length > 0 && (
                  <div className="kc-modal-subject-section">
                    <div className="kc-modal-subject-section-title">Discord Permissions</div>
                    {filteredDiscordPerms.map(({ id, name }) => (
                      <button
                        key={id}
                        type="button"
                        className="kc-modal-subject-item"
                        onClick={() => onSelectSubject('DISCORD_PERMISSION', id, `Discord: ${name}`)}
                      >
                        Discord: {name}
                      </button>
                    ))}
                  </div>
                )}
                {filteredRoles.length > 0 && (
                  <div className="kc-modal-subject-section">
                    <div className="kc-modal-subject-section-title">Roles</div>
                    {filteredRoles.map((role) => (
                      <button
                        key={role.roleId}
                        type="button"
                        className="kc-modal-subject-item"
                        onClick={() => onSelectSubject('ROLE', role.roleId, `Role: ${role.name}`)}
                      >
                        Role: {role.name}
                      </button>
                    ))}
                  </div>
                )}
                {filteredMembers.length > 0 && (
                  <div className="kc-modal-subject-section">
                    <div className="kc-modal-subject-section-title">Members</div>
                    {filteredMembers.map((member) => {
                      const name = member.displayName ?? member.nickname ?? member.userId
                      return (
                        <button
                          key={member.userId}
                          type="button"
                          className="kc-modal-subject-item"
                          onClick={() => onSelectSubject('USER', member.userId, `User: ${name}`)}
                        >
                          User: {name}
                        </button>
                      )
                    })}
                  </div>
                )}
                {filteredDiscordPerms.length === 0 && filteredRoles.length === 0 && filteredMembers.length === 0 && (
                  <p className="kc-muted kc-modal-empty">
                    {modalSearch ? `No results for "${modalSearch}"` : 'No subjects available.'}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="kc-modal-selected-subject">
                <span className="kc-modal-selected-label">{subjectDisplay}</span>
                <button type="button" className="kc-btn kc-btn-ghost kc-modal-subject-back" onClick={onClearSubject}>
                  Change
                </button>
              </div>
              <p className="kc-muted kc-modal-perm-hint">Click to cycle: grey = skip · green = allow · red = deny</p>
              <div className="kc-modal-perm-list">
                {grantableCatalogEntries.length === 0 ? (
                  <p className="kc-muted">No permissions available to grant for this target.</p>
                ) : (
                  CATEGORY_ORDER.map((cat) => {
                    const perms = grantableCatalogEntries.filter(
                      (c) => (KANBAN_PERM_INFO[c.key]?.category ?? 'OTHER') === cat,
                    )
                    if (perms.length === 0) return null
                    return (
                      <div key={cat} className="kc-modal-perm-section">
                        <div className="kc-modal-perm-section-title">{cat}</div>
                        <div className="kc-modal-perm-chips">
                          {perms.map((c) => {
                            const state = modalPermStates[c.permissionId] ?? null
                            return (
                              <button
                                key={c.permissionId}
                                type="button"
                                className={`kc-modal-perm-chip kc-modal-perm-chip--${state === 'ALLOW' ? 'allow' : state === 'DENY' ? 'deny' : 'none'}`}
                                onClick={() => onCyclePermState(c.permissionId)}
                                title={
                                  state === 'ALLOW'
                                    ? 'Allow - click for deny'
                                    : state === 'DENY'
                                      ? 'Deny - click to clear'
                                      : 'Not set - click for allow'
                                }
                              >
                                {c.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

        {subjectType !== null && (
          <div className="kc-modal-footer">
            <button type="button" className="kc-btn kc-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="kc-btn kc-btn-primary"
              onClick={onSave}
              disabled={saving || Object.keys(modalPermStates).length === 0}
            >
              {saving
                ? 'Saving…'
                : `Save${Object.keys(modalPermStates).length > 0 ? ` (${Object.keys(modalPermStates).length})` : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
