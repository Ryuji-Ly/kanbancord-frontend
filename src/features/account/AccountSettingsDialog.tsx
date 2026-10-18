import { t } from '../../i18n'
import { AccessibilitySettings } from '../preferences/AccessibilitySettings'
import { AppearanceSettings } from '../preferences/AppearanceSettings'
import { SimpleViewSettings } from '../preferences/SimpleViewSettings'
import { usePreferences, useSavePreferences } from '../preferences/usePreferences'
import { ServerSettingsDialog } from '../serverSettings/ServerSettingsDialog'
import { MyNotificationsSettings } from '../notifications/MyNotificationsSettings'
import { SessionsSettings } from './SessionsSettings'

/** The signed-in user's preferences and settings, opened from the user menu on {@code section}. */
export function AccountSettingsDialog({ name, section, onClose }: { name: string; section: string; onClose: () => void }) {
  const preferences = usePreferences()
  const save = useSavePreferences()
  return (
    <ServerSettingsDialog
      serverName={name}
      title={t('account.menu.dialogTitle')}
      initialKey={section}
      onClose={onClose}
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
  )
}
