import { Link } from 'react-router-dom'
import { ActivityPresence } from '../../activity/ActivityPresence'
import { UserMenu } from '../../features/account/UserMenu'
import { t } from '../../i18n'
import type { HeaderUser } from './types'

type DashboardHeaderProps = {
  isAuthenticated: boolean
  me: HeaderUser
  loading: boolean
  onLogout: () => void
  onLogin: () => void
  subtitle?: string
  onBrandClick?: () => void
}

export function DashboardHeader({
  isAuthenticated,
  me,
  loading,
  onLogout,
  onLogin,
  subtitle = t('dashboard.title'),
  onBrandClick,
}: DashboardHeaderProps) {
  return (
    <header className="kc-topbar">
      <button
        type="button"
        className="kc-brand-block kc-brand-block-btn"
        onClick={() => {
          onBrandClick?.()
        }}
        aria-label={t('dashboard.goToDashboard')}
      >
        <img src="/images/kanbancord.png" alt="KanbanCord" className="kc-logo" />
        <div>
          <h1 className="kc-title">KanbanCord</h1>
          <p className="kc-subtitle">{subtitle}</p>
        </div>
      </button>
      <nav className="kc-topbar-links" aria-label={t('site.nav.news')}>
        <Link to="/updates">{t('site.nav.updates')}</Link>
        <Link to="/roadmap">{t('site.nav.roadmap')}</Link>
      </nav>

      <div className="kc-user-block">
        <ActivityPresence selfId={me?.userId} />
        {isAuthenticated && me ? (
          <UserMenu me={me} onLogout={onLogout} />
        ) : (
          <button
            className="kc-btn kc-btn-primary"
            type="button"
            onClick={onLogin}
            disabled={loading}
          >
            {t('common.loginWithDiscord')}
          </button>
        )}
      </div>
    </header>
  )
}
