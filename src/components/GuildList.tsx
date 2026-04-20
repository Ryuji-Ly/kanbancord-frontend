import type { DiscordGuild } from '../types/auth'
import { guildIconUrl } from '../services/discordGuildsService'

type GuildListProps = {
  title: string
  guilds: DiscordGuild[]
  emptyMessage?: string
}

export function GuildList({ title, guilds, emptyMessage = 'None found.' }: GuildListProps) {
  return (
    <section className="kc-panel">
      <h2>{title}</h2>
      {guilds.length === 0 ? (
        <p className="kc-muted">{emptyMessage}</p>
      ) : (
        <ul className="kc-guild-list">
          {guilds.map((guild) => {
            const icon = guildIconUrl(guild)
            return (
              <li key={guild.id} className="kc-guild-item">
                {icon ? (
                  <img className="kc-guild-icon" src={icon} alt={guild.name} width={32} height={32} />
                ) : (
                  <span className="kc-guild-fallback" aria-hidden="true">
                    {guild.name.charAt(0)}
                  </span>
                )}
                <span className="kc-guild-name">{guild.name}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
