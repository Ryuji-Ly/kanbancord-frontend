import { t } from '../../i18n'
import { guildIconUrl } from '../../services/discordGuildsService'
import type { MergedServer } from './types'

type ServersGridSectionProps = {
  isAuthenticated: boolean
  loading: boolean
  mergedServers: MergedServer[]
  onServerCardClick: (server: MergedServer) => void
}

function serverInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export function ServersGridSection({
  isAuthenticated,
  loading,
  mergedServers,
  onServerCardClick,
}: ServersGridSectionProps) {
  if (!isAuthenticated) return null

  return (
    <section className="kc-panel">
      <h2>{t('dashboard.yourServers')}</h2>
      {loading ? (
        <div className="kc-loading-state" aria-live="polite" aria-busy="true">
          <span className="kc-spinner" aria-hidden="true" />
          <span className="kc-muted">{t('dashboard.loadingServers')}</span>
        </div>
      ) : mergedServers.length === 0 ? (
        <p className="kc-muted">{t('dashboard.noManageableServers')}</p>
      ) : (
        <div className="kc-card-grid">
          {mergedServers.map((server) => (
            <article
              key={server.id}
              className={`kc-card ${server.botPresent ? '' : 'kc-card-greyed'}`}
              onClick={() => onServerCardClick(server)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onServerCardClick(server)}
            >
              <div className="kc-card-head">
                {guildIconUrl(server) ? (
                  <img src={guildIconUrl(server) ?? ''} alt={server.name} className="kc-card-icon" />
                ) : (
                  <span className="kc-card-fallback">{serverInitial(server.name)}</span>
                )}
                <h3>{server.name}</h3>
              </div>
              {!server.botPresent && <p className="kc-invite-hint">{t('dashboard.clickToInvite')}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
