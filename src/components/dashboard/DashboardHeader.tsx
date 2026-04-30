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

function serverInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export function DashboardHeader({
  isAuthenticated,
  me,
  loading,
  onLogout,
  onLogin,
  subtitle = 'Dashboard',
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
        aria-label="Go to dashboard"
      >
        <img src="/images/kanbancord.png" alt="KanbanCord" className="kc-logo" />
        <div>
          <h1 className="kc-title">KanbanCord</h1>
          <p className="kc-subtitle">{subtitle}</p>
        </div>
      </button>

      <div className="kc-user-block">
        {isAuthenticated && me ? (
          <>
            <div className="kc-user-meta">
              <span className="kc-user-name">{me.globalName || me.username}</span>
              <span className="kc-user-handle">@{me.username}</span>
            </div>
            {me.avatarUrl ? (
              <img src={me.avatarUrl} alt={me.username} className="kc-avatar" />
            ) : (
              <span className="kc-avatar-fallback">{serverInitial(me.username)}</span>
            )}
            <button className="kc-btn kc-btn-ghost" type="button" onClick={onLogout} disabled={loading}>
              Logout
            </button>
          </>
        ) : (
          <button
            className="kc-btn kc-btn-primary"
            type="button"
            onClick={onLogin}
            disabled={loading}
          >
            Login with Discord
          </button>
        )}
      </div>
    </header>
  )
}
