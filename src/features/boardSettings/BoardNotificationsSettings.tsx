import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { t } from '../../i18n'
import {
  categoryLabel,
  eventLabel,
  fetchBoardNotifications,
  resetBoardFeed,
  updateBoardFeed,
  type BoardFeed,
  type BoardNotifications,
} from '../../services/notificationsService'
import { boardKeys } from '../board/boardQueries'

type BoardNotificationsSettingsProps = {
  serverId: string
  boardId: string
}

/**
 * How the server's update feeds treat this board. Each feed's settings apply until the board changes
 * one: what it posts, and which of those posts mention people. The same changes show on the feed in
 * the server's settings. Feeds themselves (their channel and boards) are set there.
 */
export function BoardNotificationsSettings({ serverId, boardId }: BoardNotificationsSettingsProps) {
  const queryClient = useQueryClient()
  const queryKey = [...boardKeys.all(serverId, boardId), 'notifications']
  const [error, setError] = useState('')
  const query = useQuery({ queryKey, queryFn: () => fetchBoardNotifications(serverId, boardId) })

  const settle = {
    onMutate: () => setError(''),
    onSuccess: (data: BoardNotifications) => queryClient.setQueryData(queryKey, data),
    onError: (err: unknown) => setError(readableError(err, t('common.changeNotSaved'))),
    // The server's view of its feeds shows the board's changes too.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['server', serverId] }),
  }
  const update = useMutation({
    mutationFn: ({ feedId, changes }: { feedId: number; changes: { events?: Record<string, boolean>; mentions?: Record<string, boolean> } }) =>
      updateBoardFeed(serverId, boardId, feedId, changes),
    ...settle,
  })
  const reset = useMutation({ mutationFn: (feedId: number) => resetBoardFeed(serverId, boardId, feedId), ...settle })

  const data = query.data
  return (
    <section className="kc-board-modal-section">
      <div className="kc-board-modal-section-head">
        <h4>{t('dashboard.settings.notifications')}</h4>
        <p className="kc-muted">{t('settings.boardNotifications.intro')}</p>
      </div>
      {error && <p className="kc-banner">{error}</p>}
      {query.isPending && <p className="kc-muted">{t('common.loadingEllipsis')}</p>}
      {data && data.feeds.length === 0 && (
        <p className="kc-muted">{t('settings.boardNotifications.noFeeds')}</p>
      )}
      <ul className="kc-feed-list">
        {data?.feeds.map((feed) => (
          <BoardFeedCard
            key={feed.feedId}
            feed={feed}
            catalogue={data.catalogue}
            busy={update.isPending || reset.isPending}
            onChange={(changes) => update.mutate({ feedId: feed.feedId, changes })}
            onReset={() => reset.mutate(feed.feedId)}
          />
        ))}
      </ul>
    </section>
  )
}

function BoardFeedCard({
  feed,
  catalogue,
  busy,
  onChange,
  onReset,
}: {
  feed: BoardFeed
  catalogue: BoardNotifications['catalogue']
  busy: boolean
  onChange: (changes: { events?: Record<string, boolean>; mentions?: Record<string, boolean> }) => void
  onReset: () => void
}) {
  const posts = (key: string) => feed.own.events[key] ?? Boolean(feed.feedEvents[key])
  const mentions = (key: string) => feed.own.mentions[key] ?? Boolean(feed.feedMentions[key])
  const changed = (key: string) => key in feed.own.events || key in feed.own.mentions

  return (
    <li className="kc-feed-card">
      <div className="kc-feed-card-head">
        <strong>#{feed.channelName ?? t('notifications.feed.goneChannel')}</strong>
        <span className="kc-muted">
          {feed.everyBoard ? t('notifications.feed.everyBoard') : t('notifications.feed.chosenBoards')}
          {feed.interactive ? t('notifications.feed.withButtons') : ''}
        </span>
      </div>
      <div className="kc-board-feed-status">
        <span className="kc-muted">
          {feed.own.changes === 0
            ? t('settings.boardNotifications.followsFeed')
            : t('settings.boardNotifications.changes', { count: feed.own.changes })}
        </span>
        {feed.own.changes > 0 && (
          <button type="button" className="kc-btn kc-btn-ghost kc-btn-small" disabled={busy} onClick={onReset}>
            {t('settings.boardNotifications.useFeed')}
          </button>
        )}
      </div>
      {catalogue.map((category) => (
        <fieldset key={category.key} className="kc-board-feed-category">
          <legend>{categoryLabel(category)}</legend>
          <ul className="kc-feed-events">
            {category.events.map((event) => (
              <li key={event.key} className="kc-feed-event">
                <label>
                  <input
                    type="checkbox"
                    className="kc-check"
                    checked={posts(event.key)}
                    disabled={busy}
                    onChange={(change) => onChange({ events: { [event.key]: change.target.checked } })}
                  />
                  {eventLabel(event)}
                  {changed(event.key) && <span className="kc-board-feed-changed">{t('settings.boardNotifications.changed')}</span>}
                </label>
                {event.canMention && (
                  <label className="kc-feed-mention">
                    <input
                      type="checkbox"
                      className="kc-check"
                      aria-label={t('notifications.mentionFor', { name: eventLabel(event) })}
                      checked={mentions(event.key)}
                      disabled={busy || !posts(event.key)}
                      onChange={(change) => onChange({ mentions: { [event.key]: change.target.checked } })}
                    />
                    {t('notifications.mention')}
                  </label>
                )}
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
    </li>
  )
}
