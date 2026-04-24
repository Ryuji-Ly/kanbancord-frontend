import { FiX } from 'react-icons/fi'
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
      aria-label="Confirm Delete Permission Entry"
      onClick={() => {
        if (!deleteGroupSaving) onClose()
      }}
    >
      <div className="kc-modal kc-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title">Delete Permission Entry</h3>
          <button
            type="button"
            className="kc-modal-close"
            onClick={onClose}
            disabled={deleteGroupSaving}
            aria-label="Close"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
        <div className="kc-modal-body">
          <p className="kc-modal-confirm-desc">
            Are you sure you want to remove all Kanban permissions for <strong>{target.subjectDisplay}</strong>?
            This will delete the following {target.permissions.length} permission
            {target.permissions.length !== 1 ? 's' : ''}:
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
            Cancel
          </button>
          <button type="button" className="kc-btn kc-btn-danger" onClick={onConfirm} disabled={deleteGroupSaving}>
            {deleteGroupSaving ? 'Deleting…' : 'Delete All'}
          </button>
        </div>
      </div>
    </div>
  )
}
