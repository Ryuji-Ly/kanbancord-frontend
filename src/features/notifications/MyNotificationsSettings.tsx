import { useQuery } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { useSession } from '../../api/session'
import { SwitchRow } from '../../components/SwitchRow'
import type { ApiServer } from '../../components/dashboard/types'
import { fetchMyServers } from '../../services/meService'
import type { DmMode, ServerMode } from '../../services/notificationsService'
import { useMyNotifications, useSaveMyNotifications } from './notificationQueries'

const DM_MODES: { value: DmMode; label: string; description: string }[] = [
  {
    value: 'UNLESS_PINGED',
    label: 'Only if I was not already mentioned',
    description: 'No direct message when a server update channel you can see already mentioned you for the same thing.',
  },
  { value: 'ALWAYS', label: 'Always', description: 'A direct message even if a channel mentioned you too.' },
  { value: 'NEVER', label: 'Never', description: 'No direct messages from the bot.' },
]

/** In your own settings, being assigned is about you, not "someone". */
const PERSONAL_LABELS: Record<string, string> = {
  USER_ASSIGNED: 'I am assigned',
  USER_UNASSIGNED: 'I am unassigned',
}

const SERVER_MODES: { value: ServerMode; label: string }[] = [
  { value: 'DEFAULT', label: 'As chosen above' },
  { value: 'ASSIGNMENTS', label: 'Only when I am assigned or unassigned' },
  { value: 'NONE', label: 'Nothing from this server' },
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
    return <p className="kc-muted">Loading notification settings…</p>
  }
  if (query.isError) {
    return <p className="kc-banner">{readableError(query.error, 'Failed to load notification settings')}</p>
  }
  const mine = query.data
  const off = mine.dmMode === 'NEVER'

  return (
    <div className="kc-features kc-notifications">
      <p className="kc-muted">
        The bot can send you direct messages about tasks you are assigned to or created. You are never told about
        your own changes, and only about boards you can see.
      </p>
      {save.isError && <p className="kc-banner">{readableError(save.error, 'The change could not be saved')}</p>}

      <section className="kc-appearance-section">
        <h4>Direct messages</h4>
        <div className="kc-radio-list" role="radiogroup" aria-label="When to send direct messages">
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
                <strong>{mode.label}</strong>
                <span className="kc-muted">{mode.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="kc-appearance-section">
        <h4>What to tell me about</h4>
        {mine.catalogue
          .map((category) => ({ ...category, events: category.events.filter((event) => event.canDm) }))
          .filter((category) => category.events.length > 0)
          .map((category) => (
            <fieldset key={category.key} className="kc-notification-group" disabled={off}>
              <legend>{category.label}</legend>
              {category.events.map((event) => (
                <label key={event.key} className="kc-check-row">
                  <input
                    type="checkbox"
                    className="kc-check"
                    checked={Boolean(mine.events[event.key])}
                    onChange={(change) => save.mutate({ events: { [event.key]: change.target.checked } })}
                  />
                  {PERSONAL_LABELS[event.key] ?? event.label}
                </label>
              ))}
            </fieldset>
          ))}
        <ul className="kc-features-list">
          <SwitchRow
            label="Also tasks I commented on"
            description="Hear about tasks you took part in, not only ones you are assigned to or created."
            on={mine.includeCommented}
            disabled={off}
            onToggle={(on) => save.mutate({ includeCommented: on })}
          />
        </ul>
      </section>

      <section className="kc-appearance-section">
        <h4>Per server</h4>
        {servers.isPending && <p className="kc-muted">Loading your servers…</p>}
        {servers.data?.length === 0 && <p className="kc-muted">You are not in any server with the bot yet.</p>}
        <ul className="kc-server-modes">
          {(servers.data ?? []).map((server) => {
            const id = String(server.serverId)
            return (
              <li key={id}>
                <span>{server.name}</span>
                <select
                  className="kc-input"
                  aria-label={`Direct messages from ${server.name}`}
                  value={mine.servers[id] ?? 'DEFAULT'}
                  disabled={off}
                  onChange={(event) => save.mutate({ servers: { [id]: event.target.value as ServerMode } })}
                >
                  {SERVER_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
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
