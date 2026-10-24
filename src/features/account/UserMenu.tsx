import { Suspense, useEffect, useRef, useState } from 'react'
import { lazyNamed } from '../../components/lazyNamed'
import { FiChevronDown, FiLogOut, FiMap, FiSettings, FiSliders, FiZap } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { t } from '../../i18n'
import type { HeaderUser } from '../../components/dashboard/types'
import { clearPendingAccountDialog, pendingAccountDialog } from './accountDialog'

// Opens on a click: loaded then, not with every page.
const AccountSettingsDialog = lazyNamed(() => import('./AccountSettingsDialog'), 'AccountSettingsDialog')

type UserMenuProps = {
  me: NonNullable<HeaderUser>
  onLogout: () => void
}

/** The signed-in user in the header; opens Preferences, Settings and Log out. */
export function UserMenu({ me, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  // The section the dialog opens on, or null while it is closed.
  const [dialog, setDialog] = useState<string | null>(pendingAccountDialog)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const name = me.globalName || me.username

  useEffect(() => clearPendingAccountDialog(), [])

  // Close on a click elsewhere or on Escape.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
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

  function openDialog(section: string) {
    setOpen(false)
    setDialog(section)
  }

  return (
    <div className="kc-user-menu" ref={menuRef}>
      <button
        type="button"
        className="kc-user-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="kc-user-meta">
          <span className="kc-user-name">{name}</span>
          <span className="kc-user-handle">@{me.username}</span>
        </span>
        {me.avatarUrl ? (
          <img src={me.avatarUrl} alt="" className="kc-avatar" />
        ) : (
          <span className="kc-avatar-fallback" aria-hidden="true">
            {me.username.charAt(0).toUpperCase()}
          </span>
        )}
        <FiChevronDown aria-hidden="true" />
      </button>

      {open && (
        <div className="kc-user-menu-list" role="menu" aria-label={t('account.menu.label')}>
          <button type="button" role="menuitem" onClick={() => openDialog('appearance')}>
            <FiSliders aria-hidden="true" /> {t('account.menu.preferences')}
          </button>
          <button type="button" role="menuitem" onClick={() => openDialog('notifications')}>
            <FiSettings aria-hidden="true" /> {t('account.menu.settings')}
          </button>
          {/* On narrow screens the header has no room for these, so they are here too. */}
          <Link to="/updates" role="menuitem" className="kc-user-menu-narrow" onClick={() => setOpen(false)}>
            <FiZap aria-hidden="true" /> {t('site.nav.updates')}
          </Link>
          <Link to="/roadmap" role="menuitem" className="kc-user-menu-narrow" onClick={() => setOpen(false)}>
            <FiMap aria-hidden="true" /> {t('site.nav.roadmap')}
          </Link>
          <button
            type="button"
            role="menuitem"
            className="kc-user-menu-danger"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
          >
            <FiLogOut aria-hidden="true" /> {t('account.menu.logOut')}
          </button>
        </div>
      )}

      {dialog && (
        <Suspense fallback={null}>
          <AccountSettingsDialog name={name} section={dialog} onClose={() => setDialog(null)} />
        </Suspense>
      )}
    </div>
  )
}
