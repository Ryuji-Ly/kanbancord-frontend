import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import {
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
    onError: (err: unknown) => setError(readableError(err, 'The change could not be saved')),
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
        <h4>Notifications</h4>
        <p className="kc-muted">
          The update feeds that post about this board. Each follows its own settings from the server&apos;s
          notifications until you change something here, for this board only. Changes save straight away.
        </p>
      </div>
      {error && <p className="kc-banner">{error}</p>}
      {query.isPending && <p className="kc-muted">Loading…</p>}
      {data && data.feeds.length === 0 && (
        <p className="kc-muted">No feed posts about this board. Server managers add feeds in the server&apos;s settings.</p>
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
        <strong>#{feed.channelName ?? 'a channel that no longer exists'}</strong>
        <span className="kc-muted">
          {feed.everyBoard ? 'Every board' : 'Chosen boards'}
          {feed.interactive ? ' · with buttons' : ''}
        </span>
      </div>
      <div className="kc-board-feed-status">
        <span className="kc-muted">
          {feed.own.changes === 0
            ? "Follows the feed's settings."
            : `${feed.own.changes} change${feed.own.changes === 1 ? '' : 's'} for this board.`}
        </span>
        {feed.own.changes > 0 && (
          <button type="button" className="kc-btn kc-btn-ghost kc-btn-small" disabled={busy} onClick={onReset}>
            Use the feed&apos;s settings
          </button>
        )}
      </div>
      {catalogue.map((category) => (
        <fieldset key={category.key} className="kc-board-feed-category">
          <legend>{category.label}</legend>
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
                  {event.label}
                  {changed(event.key) && <span className="kc-board-feed-changed">changed</span>}
                </label>
                {event.canMention && (
                  <label className="kc-feed-mention">
                    <input
                      type="checkbox"
                      className="kc-check"
                      aria-label={`Mention people for ${event.label}`}
                      checked={mentions(event.key)}
                      disabled={busy || !posts(event.key)}
                      onChange={(change) => onChange({ mentions: { [event.key]: change.target.checked } })}
                    />
                    Mention
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
