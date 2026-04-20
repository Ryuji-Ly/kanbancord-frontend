type AuthActionsProps = {
  loading: boolean
  isAuthenticated: boolean
  onLogin: () => void
  onValidateToken: () => void
  onFetchServers: () => void
  onLogout: () => void
}

export function AuthActions({
  loading,
  isAuthenticated,
  onLogin,
  onValidateToken,
  onFetchServers,
  onLogout,
}: AuthActionsProps) {
  return (
    <section className="kc-actions">
      <div className="kc-row">
        <button className="kc-btn kc-btn-primary" type="button" onClick={onLogin} disabled={loading}>
          Login with Discord
        </button>
      </div>

      <p className="kc-auth-chip">
        <strong>Authenticated:</strong> {isAuthenticated ? 'yes' : 'no'}
      </p>

      <div className="kc-row kc-row-wrap">
        <button className="kc-btn" type="button" onClick={onValidateToken} disabled={!isAuthenticated || loading}>
          Validate Token (/api/me)
        </button>
        <button className="kc-btn" type="button" onClick={onFetchServers} disabled={!isAuthenticated || loading}>
          Fetch Servers (/api/me/servers)
        </button>
        <button className="kc-btn kc-btn-ghost" type="button" onClick={onLogout} disabled={loading}>
          Logout
        </button>
      </div>
    </section>
  )
}
