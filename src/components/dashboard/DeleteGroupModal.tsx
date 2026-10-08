import { FiX } from 'react-icons/fi'
import { t } from '../../i18n'
import { Trans } from '../../i18n/Trans'
import { KANBAN_PERM_INFO } from '../../services/permissionsService'
import type { DeleteGroupTarget } from './types'

type DeleteGroupModalProps = {
  target: DeleteGroupTarget | null
  deleteGroupSaving: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DeleteGroupModal({ target, deleteGroupSaving, onClose, onConfirm }: DeleteGroupModalProps) {
  if (!target) return null

  return (
    <div
      className="kc-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('permissions.deleteGroup.confirmLabel')}
      onClick={() => {
        if (!deleteGroupSaving) onClose()
      }}
    >
      <div className="kc-modal kc-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title">{t('permissions.deleteGroup.title')}</h3>
          <button
            type="button"
            className="kc-modal-close"
            onClick={onClose}
            disabled={deleteGroupSaving}
            aria-label={t('common.close')}
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
        <div className="kc-modal-body">
          <p className="kc-modal-confirm-desc">
            <Trans
              k="permissions.deleteGroup.confirm"
              values={{ subject: target.subjectDisplay, count: target.permissions.length }}
            />
          </p>
          <div className="kc-modal-confirm-chips">
            {target.permissions.map((p) => (
              <span
                key={p.id}
                className={`kc-perm-button kc-perm-button--${p.state.toLowerCase()} kc-perm-button--preview`}
              >
                <span className="kc-perm-button-text">
                  {KANBAN_PERM_INFO[p.kanbanPermissionKey]?.name ?? p.kanbanPermissionKey}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="kc-modal-footer">
          <button type="button" className="kc-btn kc-btn-ghost" onClick={onClose} disabled={deleteGroupSaving}>
            {t('common.cancel')}
          </button>
          <button type="button" className="kc-btn kc-btn-danger" onClick={onConfirm} disabled={deleteGroupSaving}>
            {deleteGroupSaving ? t('common.deleting') : t('permissions.deleteGroup.deleteAll')}
          </button>
        </div>
      </div>
    </div>
  )
}
