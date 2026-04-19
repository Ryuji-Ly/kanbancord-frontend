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
    <>
      <div>
        <button type="button" onClick={onLogin} disabled={loading}>
          Login with Discord
        </button>
      </div>

      <p><strong>Authenticated:</strong> {isAuthenticated ? 'yes' : 'no'}</p>

      <div>
        <button type="button" onClick={onValidateToken} disabled={!isAuthenticated || loading}>
          Validate Token (/api/me)
        </button>
        <button type="button" onClick={onFetchServers} disabled={!isAuthenticated || loading}>
          Fetch Servers (/api/me/servers)
        </button>
        <button type="button" onClick={onLogout} disabled={loading}>
          Logout
        </button>
      </div>
    </>
  )
}
