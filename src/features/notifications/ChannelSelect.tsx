import { t } from '../../i18n'
import type { DiscordChannel } from '../../services/notificationsService'

type ChannelSelectProps = {
  channels: DiscordChannel[]
  value: string | null
  onChange: (channelId: string | null) => void
  /** Offer "None", for settings that can be switched off. */
  noneLabel?: string
  placeholder?: string
  disabled?: boolean
  label: string
}

/**
 * The server's text channels, grouped by category as in Discord. Channels the bot cannot post in
 * are listed but cannot be picked, so it is clear why a channel is missing.
 */
export function ChannelSelect({ channels, value, onChange, noneLabel, placeholder, disabled, label }: ChannelSelectProps) {
  const groups = new Map<string, DiscordChannel[]>()
  for (const channel of channels) {
    const category = channel.category ?? ''
    groups.set(category, [...(groups.get(category) ?? []), channel])
  }
  const known = value === null || channels.some((channel) => channel.channelId === value)

  const option = (channel: DiscordChannel) => (
    <option key={channel.channelId} value={channel.channelId} disabled={!channel.botCanPost}>
      #{channel.name}
      {channel.botCanPost ? '' : t('notifications.channel.botCannotPost')}
    </option>
  )

  return (
    <select
      className="kc-input"
      aria-label={label}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    >
      {noneLabel !== undefined ? <option value="">{noneLabel}</option> : <option value="" disabled>{placeholder ?? t('notifications.channel.pick')}</option>}
      {!known && <option value={value ?? ''}>{t('notifications.channel.gone')}</option>}
      {[...groups.entries()].map(([category, list]) =>
        category ? (
          <optgroup key={category} label={category}>
            {list.map(option)}
          </optgroup>
        ) : (
          list.map(option)
        ),
      )}
    </select>
  )
}
