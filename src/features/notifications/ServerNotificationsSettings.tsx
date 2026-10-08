import { useState } from 'react'
import { readableError } from '../../api/http'
import { t } from '../../i18n'
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
    return <p className="kc-muted">{t('notifications.loading')}</p>
  }
  if (query.isError) {
    return <p className="kc-banner">{readableError(query.error, t('notifications.loadFailed'))}</p>
  }
  const settings = query.data
  const noChannels = settings.channels.length === 0
  const auditChannel = settings.channels.find((channel) => channel.channelId === settings.auditChannelId)

  return (
    <div className="kc-features kc-notifications">
      <p className="kc-muted">{t('notifications.server.intro')}</p>
      {error && <p className="kc-banner">{error}</p>}
      {noChannels && (
        <p className="kc-banner" role="status">
          {t('notifications.server.noChannels')}
        </p>
      )}

      <section className="kc-appearance-section">
        <h4>{t('notifications.server.audit')}</h4>
        <p className="kc-muted">{t('notifications.server.auditHint')}</p>
        <ChannelSelect
          label={t('notifications.server.audit')}
          channels={settings.channels}
          value={settings.auditChannelId}
          noneLabel={t('board.priority.none')}
          disabled={noChannels}
          onChange={(channelId) => {
            setError('')
            mutations.setAuditChannel.mutate(channelId, report(t('notifications.server.auditSaveFailed')))
          }}
        />
        {auditChannel && !auditChannel.botCanPost && (
          <p className="kc-banner" role="status">
            {t('notifications.server.auditCannotPost', { channel: auditChannel.name })}
          </p>
        )}
      </section>

      <section className="kc-appearance-section">
        <h4>{t('notifications.server.feeds')}</h4>
        <p className="kc-muted">{t('notifications.server.feedsHint')}</p>
        {settings.feeds.length === 0 && <p className="kc-muted">{t('notifications.server.noFeeds')}</p>}
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
                mutations.updateFeed.mutate({ feedId: feed.feedId, changes }, report(t('notifications.server.feedSaveFailed')))
              }}
              onDelete={() => setDeleting(feed.feedId)}
            />
          ))}
        </ul>
        <div className="kc-feed-add">
          <ChannelSelect
            label={t('notifications.server.newFeedChannel')}
            channels={settings.channels}
            value={newChannel}
            placeholder={t('notifications.server.newFeedPlaceholder')}
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
                { ...report(t('notifications.server.feedAddFailed')), onSuccess: () => setNewChannel(null) },
              )
            }}
          >
            {t('notifications.server.addFeed')}
          </button>
        </div>
      </section>

      {deleting !== null && (
        <ConfirmDialog
          title={t('notifications.server.deleteTitle')}
          busy={mutations.deleteFeed.isPending}
          confirmLabel={t('notifications.server.deleteFeed')}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            setError('')
            mutations.deleteFeed.mutate(deleting, report(t('notifications.server.feedDeleteFailed')))
            setDeleting(null)
          }}
        >
          {t('notifications.server.deleteConfirm')}
        </ConfirmDialog>
      )}
    </div>
  )
}
