import { t } from '../../i18n'
import { guildIconUrl } from '../../services/discordGuildsService'
import type { DiscordGuild } from '../../types/auth'

type SidebarServerRailProps = {
  isAuthenticated: boolean
  botServers: DiscordGuild[]
  selectedServerId: string
  loading: boolean
  onSelectServer: (serverId: string) => void
}

function serverInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export function SidebarServerRail({
  isAuthenticated,
  botServers,
  selectedServerId,
  loading,
  onSelectServer,
}: SidebarServerRailProps) {
  return (
    <aside className="kc-sidebar">
      <h2 className="kc-sidebar-title">{t('dashboard.servers')}</h2>
      {!isAuthenticated && <p className="kc-muted">{t('dashboard.loginToSeeServers')}</p>}
      {isAuthenticated && botServers.length === 0 && !loading && (
        <p className="kc-muted">{t('dashboard.botInNoServers')}</p>
      )}
      <ul className="kc-guild-rail">
        {botServers.map((server) => {
          const icon = guildIconUrl(server)
          return (
            <li key={server.id}>
              <button
                className={`kc-guild-pill ${selectedServerId === server.id ? 'is-active' : ''}`}
                type="button"
                onClick={() => onSelectServer(server.id)}
              >
                {icon ? (
                  <img className="kc-guild-pill-icon" src={icon} alt={server.name} />
                ) : (
                  <span className="kc-guild-pill-fallback">{serverInitial(server.name)}</span>
                )}
                <span className="kc-guild-pill-text">{server.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
