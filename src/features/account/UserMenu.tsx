import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiLogOut, FiSettings, FiSliders } from 'react-icons/fi'
import { t } from '../../i18n'
import type { HeaderUser } from '../../components/dashboard/types'
import { AccessibilitySettings } from '../preferences/AccessibilitySettings'
import { AppearanceSettings } from '../preferences/AppearanceSettings'
import { SimpleViewSettings } from '../preferences/SimpleViewSettings'
import { usePreferences, useSavePreferences } from '../preferences/usePreferences'
import { ServerSettingsDialog } from '../serverSettings/ServerSettingsDialog'
import { MyNotificationsSettings } from '../notifications/MyNotificationsSettings'
import { clearPendingAccountDialog, pendingAccountDialog } from './accountDialog'
import { SessionsSettings } from './SessionsSettings'

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
  const preferences = usePreferences()
  const save = useSavePreferences()
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
        <ServerSettingsDialog
          serverName={name}
          title={t('account.menu.dialogTitle')}
          initialKey={dialog}
          onClose={() => setDialog(null)}
          sections={[
            {
              key: 'appearance',
              group: t('account.menu.preferences'),
              label: t('account.menu.appearance'),
              content: <AppearanceSettings theme={preferences?.theme} onChange={(theme) => save.mutate({ theme })} />,
            },
            {
              key: 'accessibility',
              group: t('account.menu.preferences'),
              label: t('account.menu.accessibility'),
              content: (
                <AccessibilitySettings
                  accessibility={preferences?.accessibility}
                  onChange={(accessibility) => save.mutate({ accessibility })}
                />
              ),
            },
            {
              key: 'simple-view',
              group: t('account.menu.preferences'),
              label: t('account.menu.simpleView'),
              content: (
                <SimpleViewSettings simpleView={preferences?.simpleView} onChange={(simpleView) => save.mutate({ simpleView })} />
              ),
            },
            {
              key: 'notifications',
              group: t('account.menu.settings'),
              label: t('dashboard.settings.notifications'),
              content: <MyNotificationsSettings />,
            },
            {
              key: 'sessions',
              group: t('account.menu.settings'),
              label: t('account.menu.sessions'),
              content: <SessionsSettings />,
            },
          ]}
        />
      )}
    </div>
  )
}
