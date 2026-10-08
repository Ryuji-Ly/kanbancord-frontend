import { useQuery } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { useSession } from '../../api/session'
import { SwitchRow } from '../../components/SwitchRow'
import { t, type MessageKey } from '../../i18n'
import type { ApiServer } from '../../components/dashboard/types'
import { fetchMyServers } from '../../services/meService'
import { categoryLabel, eventLabel, type DmMode, type ServerMode } from '../../services/notificationsService'
import { useMyNotifications, useSaveMyNotifications } from './notificationQueries'

const DM_MODES: { value: DmMode; label: MessageKey; description: MessageKey }[] = [
  { value: 'UNLESS_PINGED', label: 'notifications.mine.unlessPinged', description: 'notifications.mine.unlessPingedHint' },
  { value: 'ALWAYS', label: 'notifications.mine.always', description: 'notifications.mine.alwaysHint' },
  { value: 'NEVER', label: 'notifications.mine.never', description: 'notifications.mine.neverHint' },
]

/** In your own settings, being assigned is about you, not "someone". */
const PERSONAL_LABELS: Record<string, MessageKey> = {
  USER_ASSIGNED: 'notifications.mine.iAmAssigned',
  USER_UNASSIGNED: 'notifications.mine.iAmUnassigned',
}

const SERVER_MODES: { value: ServerMode; label: MessageKey }[] = [
  { value: 'DEFAULT', label: 'notifications.mine.serverDefault' },
  { value: 'ASSIGNMENTS', label: 'notifications.mine.serverAssignments' },
  { value: 'NONE', label: 'notifications.mine.serverNone' },
]

/**
 * What the bot tells you by direct message: about tasks you are assigned to or created (and, if you
 * like, ones you commented on). Servers can each be narrowed down.
 */
export function MyNotificationsSettings() {
  const session = useSession()
  const userId = session.status === 'signedIn' ? String(session.user.userId) : ''
  const query = useMyNotifications(Boolean(userId))
  const save = useSaveMyNotifications()
  const servers = useQuery({
    queryKey: ['me', 'servers', userId],
    queryFn: async () => {
      const list = await fetchMyServers()
      return Array.isArray(list) ? (list as ApiServer[]) : []
    },
    enabled: Boolean(userId),
  })

  if (query.isPending) {
    return <p className="kc-muted">{t('notifications.loading')}</p>
  }
  if (query.isError) {
    return <p className="kc-banner">{readableError(query.error, t('notifications.loadFailed'))}</p>
  }
  const mine = query.data
  const off = mine.dmMode === 'NEVER'

  return (
    <div className="kc-features kc-notifications">
      <p className="kc-muted">{t('notifications.mine.intro')}</p>
      {save.isError && <p className="kc-banner">{readableError(save.error, t('common.changeNotSaved'))}</p>}

      <section className="kc-appearance-section">
        <h4>{t('notifications.mine.dms')}</h4>
        <div className="kc-radio-list" role="radiogroup" aria-label={t('notifications.mine.when')}>
          {DM_MODES.map((mode) => (
            <label key={mode.value} className="kc-radio-row">
              <input
                type="radio"
                name="dm-mode"
                className="kc-check"
                checked={mine.dmMode === mode.value}
                onChange={() => save.mutate({ dmMode: mode.value })}
              />
              <span>
                <strong>{t(mode.label)}</strong>
                <span className="kc-muted">{t(mode.description)}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="kc-appearance-section">
        <h4>{t('notifications.mine.what')}</h4>
        {mine.catalogue
          .map((category) => ({ ...category, events: category.events.filter((event) => event.canDm) }))
          .filter((category) => category.events.length > 0)
          .map((category) => (
            <fieldset key={category.key} className="kc-notification-group" disabled={off}>
              <legend>{categoryLabel(category)}</legend>
              {category.events.map((event) => (
                <label key={event.key} className="kc-check-row">
                  <input
                    type="checkbox"
                    className="kc-check"
                    checked={Boolean(mine.events[event.key])}
                    onChange={(change) => save.mutate({ events: { [event.key]: change.target.checked } })}
                  />
                  {PERSONAL_LABELS[event.key] ? t(PERSONAL_LABELS[event.key]) : eventLabel(event)}
                </label>
              ))}
            </fieldset>
          ))}
        <ul className="kc-features-list">
          <SwitchRow
            label={t('notifications.mine.followed')}
            description={t('notifications.mine.followedHint')}
            on={mine.includeFollowed}
            disabled={off}
            onToggle={(on) => save.mutate({ includeFollowed: on })}
          />
          <SwitchRow
            label={t('notifications.mine.commented')}
            description={t('notifications.mine.commentedHint')}
            on={mine.includeCommented}
            disabled={off}
            onToggle={(on) => save.mutate({ includeCommented: on })}
          />
        </ul>
      </section>

      <section className="kc-appearance-section">
        <h4>{t('notifications.mine.perServer')}</h4>
        {servers.isPending && <p className="kc-muted">{t('notifications.mine.loadingServers')}</p>}
        {servers.data?.length === 0 && <p className="kc-muted">{t('notifications.mine.noServers')}</p>}
        <ul className="kc-server-modes">
          {(servers.data ?? []).map((server) => {
            const id = String(server.serverId)
            return (
              <li key={id}>
                <span>{server.name}</span>
                <select
                  className="kc-input"
                  aria-label={t('notifications.mine.from', { name: server.name })}
                  value={mine.servers[id] ?? 'DEFAULT'}
                  disabled={off}
                  onChange={(event) => save.mutate({ servers: { [id]: event.target.value as ServerMode } })}
                >
                  {SERVER_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {t(mode.label)}
                    </option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
