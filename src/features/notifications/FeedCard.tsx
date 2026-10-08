import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiChevronRight, FiTrash2 } from 'react-icons/fi'
import { SwitchRow } from '../../components/SwitchRow'
import { t } from '../../i18n'
import type { BoardEntry } from '../../services/boardsService'
import {
  categoryLabel,
  eventLabel,
  type DiscordChannel,
  type FeedChanges,
  type NotificationCategory,
  type NotificationFeed,
} from '../../services/notificationsService'
import { ChannelSelect } from './ChannelSelect'

type FeedCardProps = {
  feed: NotificationFeed
  channels: DiscordChannel[]
  boards: BoardEntry[]
  catalogue: NotificationCategory[]
  onChange: (changes: FeedChanges) => void
  onDelete: () => void
}

/** A checkbox that can also show "some of these". */
function TriStateCheckbox({ checked, mixed, label, onChange }: { checked: boolean; mixed: boolean; label: string; onChange: (on: boolean) => void }) {
  const ref = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed
  }, [mixed])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="kc-check"
      aria-label={label}
      checked={checked}
      aria-checked={mixed ? 'mixed' : checked}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}

/**
 * One update feed: where it posts, which boards it covers, what it announces and whom it mentions.
 * Every change is saved straight away.
 */
export function FeedCard({ feed, channels, boards, catalogue, onChange, onDelete }: FeedCardProps) {
  const [chosenBoards, setChosenBoards] = useState(feed.boardIds.length > 0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const channel = channels.find((entry) => entry.channelId === feed.channelId)

  function toggleBoard(boardId: number, on: boolean) {
    const next = on ? [...feed.boardIds, boardId] : feed.boardIds.filter((id) => id !== boardId)
    // A feed for chosen boards needs at least one; with none it would cover the whole server.
    if (next.length > 0) onChange({ boardIds: next })
  }

  return (
    <li className="kc-feed-card">
      <div className="kc-feed-card-head">
        <strong>{channel ? `#${channel.name}` : t('notifications.channel.gone')}</strong>
        <span className="kc-muted">
          {feed.boardIds.length === 0
            ? t('notifications.feed.everyBoard')
            : t('notifications.feed.boardCount', { count: feed.boardIds.length })}
        </span>
        <button type="button" className="kc-icon-btn" aria-label={t('notifications.feed.delete')} onClick={onDelete}>
          <FiTrash2 aria-hidden="true" />
        </button>
      </div>
      {channel && !channel.botCanPost && (
        <p className="kc-banner" role="status">
          {t('notifications.feed.botCannotPost', { channel: channel.name })}
        </p>
      )}

      <label className="kc-field">
        <span className="kc-field-label">{t('settings.threads.channel')}</span>
        <ChannelSelect
          label={t('notifications.feed.channel')}
          channels={channels}
          value={feed.channelId}
          onChange={(channelId) => channelId && onChange({ channelId })}
        />
      </label>

      <div className="kc-field">
        <span className="kc-field-label">{t('dashboard.boards.title')}</span>
        <div className="kc-segmented" role="radiogroup" aria-label={t('notifications.feed.whichBoards')}>
          <button
            type="button"
            role="radio"
            aria-checked={!chosenBoards}
            className={`kc-segment${!chosenBoards ? ' kc-segment--on' : ''}`}
            onClick={() => {
              setChosenBoards(false)
              if (feed.boardIds.length > 0) onChange({ boardIds: [] })
            }}
          >
            {t('notifications.feed.everyBoard')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={chosenBoards}
            className={`kc-segment${chosenBoards ? ' kc-segment--on' : ''}`}
            onClick={() => setChosenBoards(true)}
          >
            {t('notifications.feed.chosenBoards')}
          </button>
        </div>
        {chosenBoards && (
          <ul className="kc-feed-boards">
            {boards.map((board) => (
              <li key={board.boardId}>
                <label>
                  <input
                    type="checkbox"
                    className="kc-check"
                    checked={feed.boardIds.includes(board.boardId)}
                    onChange={(event) => toggleBoard(board.boardId, event.target.checked)}
                  />
                  {board.name}
                  {board.isArchived && <span className="kc-muted">{t('notifications.feed.archived')}</span>}
                </label>
              </li>
            ))}
            {feed.boardIds.length === 0 && <li className="kc-muted">{t('notifications.feed.pickOne')}</li>}
          </ul>
        )}
      </div>

      {Object.keys(feed.boardOverrides ?? {}).length > 0 && (
        <p className="kc-muted kc-feed-overrides">
          {t('notifications.feed.overrides', {
            boards: Object.entries(feed.boardOverrides ?? {})
              .map(([boardId, own]) => {
                const name = boards.find((board) => String(board.boardId) === boardId)?.name ?? t('notifications.feed.aBoard')
                return t('notifications.feed.override', { name, count: own.changes })
              })
              .join(', '),
          })}
        </p>
      )}

      <div className="kc-field">
        <span className="kc-field-label">{t('notifications.feed.announces')}</span>
        <ul className="kc-feed-categories">
          {catalogue.map((category) => {
            const on = category.events.filter((event) => feed.events[event.key])
            const open = expanded === category.key
            // Mentions are per event; the category's switch shows (and sets) those of its posted events.
            const mentionable = on.filter((event) => event.canMention)
            const mentioning = mentionable.filter((event) => feed.mentions[event.key])
            return (
              <li key={category.key} className="kc-feed-category">
                <div className="kc-feed-category-row">
                  <TriStateCheckbox
                    label={categoryLabel(category)}
                    checked={on.length === category.events.length}
                    mixed={on.length > 0 && on.length < category.events.length}
                    onChange={(checked) =>
                      onChange({ events: Object.fromEntries(category.events.map((event) => [event.key, checked])) })
                    }
                  />
                  <button
                    type="button"
                    className="kc-feed-category-toggle"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : category.key)}
                  >
                    {open ? <FiChevronDown aria-hidden="true" /> : <FiChevronRight aria-hidden="true" />}
                    {categoryLabel(category)}
                    <span className="kc-muted">
                      {on.length}/{category.events.length}
                    </span>
                  </button>
                  {category.events.some((event) => event.canMention) && (
                    <label className="kc-feed-mention">
                      <TriStateCheckbox
                        label={t('notifications.mentionFor', { name: categoryLabel(category) })}
                        checked={mentionable.length > 0 && mentioning.length === mentionable.length}
                        mixed={mentioning.length > 0 && mentioning.length < mentionable.length}
                        onChange={(checked) => onChange({ mentions: { [category.key]: checked } })}
                      />
                      {t('notifications.mentionPeople')}
                    </label>
                  )}
                </div>
                {open && (
                  <ul className="kc-feed-events">
                    {category.events.map((event) => (
                      <li key={event.key} className="kc-feed-event">
                        <label>
                          <input
                            type="checkbox"
                            className="kc-check"
                            checked={Boolean(feed.events[event.key])}
                            onChange={(change) => onChange({ events: { [event.key]: change.target.checked } })}
                          />
                          {eventLabel(event)}
                        </label>
                        {event.canMention && (
                          <label className="kc-feed-mention">
                            <input
                              type="checkbox"
                              className="kc-check"
                              aria-label={t('notifications.mentionFor', { name: eventLabel(event) })}
                              checked={Boolean(feed.mentions[event.key])}
                              disabled={!feed.events[event.key]}
                              onChange={(change) => onChange({ mentions: { [event.key]: change.target.checked } })}
                            />
                            {t('notifications.mention')}
                          </label>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <ul className="kc-features-list">
        <SwitchRow
          label={t('notifications.feed.interactive')}
          description={t('notifications.feed.interactiveHint')}
          on={feed.interactive}
          onToggle={(on) => onChange({ interactive: on })}
        />
        <SwitchRow
          label={t('notifications.feed.mentionRoles')}
          description={t('notifications.feed.mentionRolesHint')}
          on={feed.mentionRoles}
          onToggle={(on) => onChange({ mentionRoles: on })}
        />
      </ul>
    </li>
  )
}
