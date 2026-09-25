import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiLogOut, FiSettings, FiSliders } from 'react-icons/fi'
import type { HeaderUser } from '../../components/dashboard/types'
import { AccessibilitySettings } from '../preferences/AccessibilitySettings'
import { AppearanceSettings } from '../preferences/AppearanceSettings'
import { SimpleViewSettings } from '../preferences/SimpleViewSettings'
import { usePreferences, useSavePreferences } from '../preferences/usePreferences'
import { ServerSettingsDialog } from '../serverSettings/ServerSettingsDialog'
import { MyNotificationsSettings } from '../notifications/MyNotificationsSettings'
import { SessionsSettings } from './SessionsSettings'

type UserMenuProps = {
  me: NonNullable<HeaderUser>
  onLogout: () => void
}

/** The signed-in user in the header; opens Preferences, Settings and Log out. */
export function UserMenu({ me, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'preferences' | 'settings' | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const preferences = usePreferences()
  const save = useSavePreferences()
  const name = me.globalName || me.username

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

  function openDialog(which: 'preferences' | 'settings') {
    setOpen(false)
    setDialog(which)
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
        <div className="kc-user-menu-list" role="menu" aria-label="Account">
          <button type="button" role="menuitem" onClick={() => openDialog('preferences')}>
            <FiSliders aria-hidden="true" /> Preferences
          </button>
          <button type="button" role="menuitem" onClick={() => openDialog('settings')}>
            <FiSettings aria-hidden="true" /> Settings
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
            <FiLogOut aria-hidden="true" /> Log out
          </button>
        </div>
      )}

      {dialog === 'preferences' && (
        <ServerSettingsDialog
          serverName={name}
          title="Preferences"
          onClose={() => setDialog(null)}
          sections={[
            {
              key: 'appearance',
              label: 'Appearance',
              content: <AppearanceSettings theme={preferences?.theme} onChange={(theme) => save.mutate({ theme })} />,
            },
            {
              key: 'accessibility',
              label: 'Accessibility',
              content: (
                <AccessibilitySettings
                  accessibility={preferences?.accessibility}
                  onChange={(accessibility) => save.mutate({ accessibility })}
                />
              ),
            },
            {
              key: 'simple-view',
              label: 'Simple view',
              content: (
                <SimpleViewSettings simpleView={preferences?.simpleView} onChange={(simpleView) => save.mutate({ simpleView })} />
              ),
            },
          ]}
        />
      )}

      {dialog === 'settings' && (
        <ServerSettingsDialog
          serverName={name}
          title="Settings"
          onClose={() => setDialog(null)}
          sections={[
            { key: 'notifications', label: 'Notifications', content: <MyNotificationsSettings /> },
            { key: 'sessions', label: 'Sessions', content: <SessionsSettings /> },
          ]}
        />
      )}
    </div>
  )
}
