import { useState } from 'react'
import { readableError } from '../../api/http'
import type { BoardEntry } from '../../services/boardsService'
import { ConfirmDialog } from '../board/components/ConfirmDialog'
import { ChannelSelect } from './ChannelSelect'
import { FeedCard } from './FeedCard'
import { useServerNotificationMutations, useServerNotifications } from './notificationQueries'

type ServerNotificationsSettingsProps = {
  serverId: string
  boards: BoardEntry[]
}

/**
 * Where the bot posts about this server: an audit log channel that mirrors every change, and update
 * feeds that announce chosen changes, optionally mentioning the people involved.
 */
export function ServerNotificationsSettings({ serverId, boards }: ServerNotificationsSettingsProps) {
  const query = useServerNotifications(serverId)
  const mutations = useServerNotificationMutations(serverId)
  const [newChannel, setNewChannel] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState('')

  const report = (fallback: string) => ({ onError: (err: unknown) => setError(readableError(err, fallback)) })

  if (query.isPending) {
    return <p className="kc-muted">Loading notification settings…</p>
  }
  if (query.isError) {
    return <p className="kc-banner">{readableError(query.error, 'Failed to load notification settings')}</p>
  }
  const settings = query.data
  const noChannels = settings.channels.length === 0

  return (
    <div className="kc-features kc-notifications">
      <p className="kc-muted">
        The bot can post about this server in Discord. People can also get direct messages about their own tasks;
        they choose that themselves in their settings, and are never messaged about something a feed already
        mentioned them for.
      </p>
      {error && <p className="kc-banner">{error}</p>}
      {noChannels && (
        <p className="kc-banner" role="status">
          The bot has not reported this server's channels yet. They appear once the bot is running an up-to-date
          version and can see the channels.
        </p>
      )}

      <section className="kc-appearance-section">
        <h4>Audit log channel</h4>
        <p className="kc-muted">Every change, as in the audit log here. Never mentions anyone.</p>
        <ChannelSelect
          label="Audit log channel"
          channels={settings.channels}
          value={settings.auditChannelId}
          noneLabel="None"
          disabled={noChannels}
          onChange={(channelId) => {
            setError('')
            mutations.setAuditChannel.mutate(channelId, report('The audit channel could not be saved'))
          }}
        />
      </section>

      <section className="kc-appearance-section">
        <h4>Update feeds</h4>
        <p className="kc-muted">
          Each feed posts chosen changes to a channel, for every board or only some. Changes to the same task within
          half a minute are posted together.
        </p>
        {settings.feeds.length === 0 && <p className="kc-muted">No feeds yet.</p>}
        <ul className="kc-feed-list">
          {settings.feeds.map((feed) => (
            <FeedCard
              key={feed.feedId}
              feed={feed}
              channels={settings.channels}
              boards={boards}
              catalogue={settings.catalogue}
              onChange={(changes) => {
                setError('')
                mutations.updateFeed.mutate({ feedId: feed.feedId, changes }, report('The feed could not be saved'))
              }}
              onDelete={() => setDeleting(feed.feedId)}
            />
          ))}
        </ul>
        <div className="kc-feed-add">
          <ChannelSelect
            label="Channel for a new feed"
            channels={settings.channels}
            value={newChannel}
            placeholder="Channel for a new feed…"
            disabled={noChannels}
            onChange={setNewChannel}
          />
          <button
            type="button"
            className="kc-btn kc-btn-primary"
            disabled={!newChannel || mutations.createFeed.isPending}
            onClick={() => {
              setError('')
              mutations.createFeed.mutate(
                { channelId: newChannel ?? undefined },
                { ...report('The feed could not be added'), onSuccess: () => setNewChannel(null) },
              )
            }}
          >
            Add feed
          </button>
        </div>
      </section>

      {deleting !== null && (
        <ConfirmDialog
          title="Delete this feed?"
          busy={mutations.deleteFeed.isPending}
          confirmLabel="Delete feed"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            setError('')
            mutations.deleteFeed.mutate(deleting, report('The feed could not be deleted'))
            setDeleting(null)
          }}
        >
          The bot stops posting these updates. Messages it already posted stay.
        </ConfirmDialog>
      )}
    </div>
  )
}
