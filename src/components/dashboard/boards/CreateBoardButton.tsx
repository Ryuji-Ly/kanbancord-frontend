import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiPlus, FiUpload } from 'react-icons/fi'
import { t } from '../../../i18n'

type CreateBoardButtonProps = {
  onCreate: () => void
  onImport: () => void
}

/**
 * Create board as a split button: the main part creates a board, the arrow beside it opens the
 * other ways to make one, for now importing a board file.
 */
export function CreateBoardButton({ onCreate, onImport }: CreateBoardButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  // Close on a click elsewhere or on Escape.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="kc-split-btn" ref={ref}>
      <button type="button" className="kc-btn kc-btn-primary kc-split-btn-main" onClick={onCreate}>
        <FiPlus aria-hidden="true" /> {t('dashboard.boards.create')}
      </button>
      <button
        type="button"
        className="kc-btn kc-btn-primary kc-split-btn-more"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('dashboard.boards.moreWays')}
        title={t('dashboard.boards.moreWays')}
        onClick={() => setOpen((prev) => !prev)}
      >
        <FiChevronDown aria-hidden="true" />
      </button>
      {open && (
        <div className="kc-user-menu-list" role="menu" aria-label={t('dashboard.boards.moreWays')}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onImport()
            }}
          >
            <FiUpload aria-hidden="true" /> {t('settings.transfer.importTitle')}
          </button>
        </div>
      )}
    </div>
  )
}
