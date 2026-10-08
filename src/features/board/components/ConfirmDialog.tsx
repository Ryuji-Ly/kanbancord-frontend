import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../../../i18n'

type ConfirmDialogProps = {
  title: string
  children: ReactNode
  error?: string
  busy: boolean
  confirmLabel?: string
  busyLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

/**
 * A "Delete X? This cannot be undone." dialog. Clicking outside cancels unless the action is running.
 * Rendered into the document body, so it covers the page wherever it is used.
 */
export function ConfirmDialog({
  title,
  children,
  error,
  busy,
  confirmLabel = t('common.delete'),
  busyLabel = t('common.deletingDots'),
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return createPortal(
    <div
      className="kc-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('common.confirmNamed', { title })}
      onClick={(event) => {
        // React events bubble through portals; keep clicks from reaching whatever rendered the dialog.
        event.stopPropagation()
        if (!busy) onCancel()
      }}
    >
      <div className="kc-modal kc-modal--confirm" onClick={(event) => event.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title">{title}</h3>
        </div>
        <div className="kc-modal-body">
          {children}
          {error && <p className="kc-banner">{error}</p>}
        </div>
        <div className="kc-modal-footer">
          <button type="button" className="kc-btn kc-btn-ghost" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" className="kc-btn kc-btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
