import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiChevronRight, FiTrash2 } from 'react-icons/fi'
import { SwitchRow } from '../../components/SwitchRow'
import type { BoardEntry } from '../../services/boardsService'
import type { DiscordChannel, FeedChanges, NotificationCategory, NotificationFeed } from '../../services/notificationsService'
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
        <strong>{channel ? `#${channel.name}` : 'A channel that no longer exists'}</strong>
        <span className="kc-muted">
          {feed.boardIds.length === 0
            ? 'Every board'
            : `${feed.boardIds.length} board${feed.boardIds.length === 1 ? '' : 's'}`}
        </span>
        <button type="button" className="kc-icon-btn" aria-label="Delete this feed" onClick={onDelete}>
          <FiTrash2 aria-hidden="true" />
        </button>
      </div>
      {channel && !channel.botCanPost && (
        <p className="kc-banner" role="status">
          The bot cannot post in #{channel.name}. Give it permission to view the channel and send messages there.
        </p>
      )}

      <label className="kc-field">
        <span className="kc-field-label">Channel</span>
        <ChannelSelect
          label="Feed channel"
          channels={channels}
          value={feed.channelId}
          onChange={(channelId) => channelId && onChange({ channelId })}
        />
      </label>

      <div className="kc-field">
        <span className="kc-field-label">Boards</span>
        <div className="kc-segmented" role="radiogroup" aria-label="Which boards">
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
            Every board
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={chosenBoards}
            className={`kc-segment${chosenBoards ? ' kc-segment--on' : ''}`}
            onClick={() => setChosenBoards(true)}
          >
            Chosen boards
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
                  {board.isArchived && <span className="kc-muted"> (archived)</span>}
                </label>
              </li>
            ))}
            {feed.boardIds.length === 0 && <li className="kc-muted">Pick at least one board; until then this feed covers every board.</li>}
          </ul>
        )}
      </div>

      <div className="kc-field">
        <span className="kc-field-label">What it announces</span>
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
                    label={category.label}
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
                    {category.label}
                    <span className="kc-muted">
                      {on.length}/{category.events.length}
                    </span>
                  </button>
                  {category.events.some((event) => event.canMention) && (
                    <label className="kc-feed-mention">
                      <TriStateCheckbox
                        label={`Mention people for ${category.label}`}
                        checked={mentionable.length > 0 && mentioning.length === mentionable.length}
                        mixed={mentioning.length > 0 && mentioning.length < mentionable.length}
                        onChange={(checked) => onChange({ mentions: { [category.key]: checked } })}
                      />
                      Mention people
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
                          {event.label}
                        </label>
                        {event.canMention && (
                          <label className="kc-feed-mention">
                            <input
                              type="checkbox"
                              className="kc-check"
                              aria-label={`Mention people for ${event.label}`}
                              checked={Boolean(feed.mentions[event.key])}
                              disabled={!feed.events[event.key]}
                              onChange={(change) => onChange({ mentions: { [event.key]: change.target.checked } })}
                            />
                            Mention
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
          label="Interactive posts"
          description="Each post shows the whole task with buttons to move it, assign people, edit or follow it, right there in Discord."
          on={feed.interactive}
          onToggle={(on) => onChange({ interactive: on })}
        />
        <SwitchRow
          label="Also mention assigned roles"
          description="Off by default: a role can be a lot of people. Mentioning people above only mentions individual people."
          on={feed.mentionRoles}
          onToggle={(on) => onChange({ mentionRoles: on })}
        />
      </ul>
    </li>
  )
}
