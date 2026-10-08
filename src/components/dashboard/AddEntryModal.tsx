import { FiX } from 'react-icons/fi'
import { t, type MessageKey } from '../../i18n'
import {
  CATEGORY_ORDER,
  KANBAN_PERM_INFO,
  type KanbanCatalogEntry,
  type ServerMemberEntry,
  type ServerRoleEntry,
} from '../../services/permissionsService'

type AddEntryModalProps = {
  show: boolean
  title?: string
  ariaLabel?: string
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
  title = t('permissions.addEntry.title'),
  ariaLabel = t('permissions.addEntry.title'),
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
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <div className="kc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title">{title}</h3>
          <button type="button" className="kc-modal-close" onClick={onClose} aria-label={t('common.closeModal')}>
            <FiX aria-hidden="true" />
          </button>
        </div>

        <div className="kc-modal-body">
          {loading ? (
            <div className="kc-loading-state">
              <span className="kc-spinner" aria-hidden="true" />
              <span className="kc-muted">{t('common.loading')}</span>
            </div>
          ) : subjectType === null ? (
            <>
              <input
                className="kc-modal-search"
                type="text"
                placeholder={t('permissions.addEntry.searchPlaceholder')}
                value={modalSearch}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus
                aria-label={t('permissions.addEntry.searchLabel')}
              />
              <div className="kc-modal-subject-list">
                {filteredDiscordPerms.length > 0 && (
                  <div className="kc-modal-subject-section">
                    <div className="kc-modal-subject-section-title">{t('permissions.addEntry.discordPermissions')}</div>
                    {filteredDiscordPerms.map(({ id, name }) => (
                      <button
                        key={id}
                        type="button"
                        className="kc-modal-subject-item"
                        onClick={() => onSelectSubject('DISCORD_PERMISSION', id, t('permissions.subject.discord', { name }))}
                      >
                        {t('permissions.subject.discord', { name })}
                      </button>
                    ))}
                  </div>
                )}
                {filteredRoles.length > 0 && (
                  <div className="kc-modal-subject-section">
                    <div className="kc-modal-subject-section-title">{t('permissions.addEntry.roles')}</div>
                    {filteredRoles.map((role) => (
                      <button
                        key={role.roleId}
                        type="button"
                        className="kc-modal-subject-item"
                        onClick={() => onSelectSubject('ROLE', role.roleId, t('permissions.subject.role', { name: role.name }))}
                      >
                        {t('permissions.subject.role', { name: role.name })}
                      </button>
                    ))}
                  </div>
                )}
                {filteredMembers.length > 0 && (
                  <div className="kc-modal-subject-section">
                    <div className="kc-modal-subject-section-title">{t('permissions.addEntry.members')}</div>
                    {filteredMembers.map((member) => {
                      const name = member.displayName ?? member.nickname ?? member.userId
                      return (
                        <button
                          key={member.userId}
                          type="button"
                          className="kc-modal-subject-item"
                          onClick={() => onSelectSubject('USER', member.userId, t('permissions.subject.user', { name }))}
                        >
                          {t('permissions.subject.user', { name })}
                        </button>
                      )
                    })}
                  </div>
                )}
                {filteredDiscordPerms.length === 0 && filteredRoles.length === 0 && filteredMembers.length === 0 && (
                  <p className="kc-muted kc-modal-empty">
                    {modalSearch
                      ? t('permissions.addEntry.noResults', { search: modalSearch })
                      : t('permissions.addEntry.noSubjects')}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="kc-modal-selected-subject">
                <span className="kc-modal-selected-label">{subjectDisplay}</span>
                <button type="button" className="kc-btn kc-btn-ghost kc-modal-subject-back" onClick={onClearSubject}>
                  {t('common.change')}
                </button>
              </div>
              <p className="kc-muted kc-modal-perm-hint">{t('permissions.addEntry.cycleHint')}</p>
              <div className="kc-modal-perm-list">
                {grantableCatalogEntries.length === 0 ? (
                  <p className="kc-muted">{t('permissions.addEntry.nothingToGrant')}</p>
                ) : (
                  CATEGORY_ORDER.map((cat) => {
                    const perms = grantableCatalogEntries.filter(
                      (c) => (KANBAN_PERM_INFO[c.key]?.category ?? 'OTHER') === cat,
                    )
                    if (perms.length === 0) return null
                    return (
                      <div key={cat} className="kc-modal-perm-section">
                        <div className="kc-modal-perm-section-title">{t(`permissions.category.${cat}` as MessageKey)}</div>
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
                                    ? t('permissions.addEntry.allowHint')
                                    : state === 'DENY'
                                      ? t('permissions.addEntry.denyHint')
                                      : t('permissions.addEntry.unsetHint')
                                }
                              >
                                {KANBAN_PERM_INFO[c.key]?.name ?? c.name}
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
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="kc-btn kc-btn-primary"
              onClick={onSave}
              disabled={saving || Object.keys(modalPermStates).length === 0}
            >
              {saving
                ? t('common.saving')
                : Object.keys(modalPermStates).length > 0
                  ? t('permissions.addEntry.saveCount', { count: Object.keys(modalPermStates).length })
                  : t('common.save')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
