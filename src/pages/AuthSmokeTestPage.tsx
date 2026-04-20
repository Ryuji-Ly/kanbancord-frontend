import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config/env'
import { AuthActions } from '../components/AuthActions'
import { GuildList } from '../components/GuildList'
import {
  clearCallbackQuery,
  clearDiscordToken,
  clearOAuthSessionState,
  clearToken,
  exchangeDiscordCode,
  getExpectedOAuthState,
  getStoredDiscordToken,
  getStoredToken,
  isOAuthInProgress,
  saveDiscordToken,
  saveToken,
  startDiscordLogin,
} from '../services/authService'
import { fetchMe, fetchMyServers } from '../services/meService'
import { fetchUserGuilds, filterManageableGuilds } from '../services/discordGuildsService'
import type { DiscordGuild, MeResponse } from '../types/auth'

export function AuthSmokeTestPage() {
  const [authToken, setAuthToken] = useState<string>(() => getStoredToken())
  const [discordToken, setDiscordToken] = useState<string>(() => getStoredDiscordToken())
  const [me, setMe] = useState<MeResponse | null>(null)
  const [serversPayload, setServersPayload] = useState<string>('')
  const [manageableGuilds, setManageableGuilds] = useState<DiscordGuild[]>([])
  const [botGuilds, setBotGuilds] = useState<DiscordGuild[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const isAuthenticated = useMemo(() => authToken.trim().length > 0, [authToken])
  const messageTone = useMemo(() => {
    const lower = message.toLowerCase()
    if (!message) return 'neutral'
    if (lower.includes('failed') || lower.includes('invalid') || lower.includes('no discord access token')) {
      return 'error'
    }
    return 'success'
  }, [message])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (!isOAuthInProgress()) return

    if (error) {
      setMessage(`Discord authorization failed: ${error}`)
      clearOAuthSessionState()
      clearCallbackQuery()
      return
    }

    if (!code) return

    const expectedState = getExpectedOAuthState()
    if (!state || !expectedState || state !== expectedState) {
      setMessage('Invalid OAuth state. Please try again.')
      clearOAuthSessionState()
      clearCallbackQuery()
      return
    }

    void completeDiscordExchange(code)
  }, [])

  async function completeDiscordExchange(code: string) {
    setLoading(true)
    setMessage('')
    try {
      const data = await exchangeDiscordCode(code)
      saveToken(data.accessToken)
      setAuthToken(data.accessToken)
      if (data.discordAccessToken) {
        saveDiscordToken(data.discordAccessToken)
        setDiscordToken(data.discordAccessToken)
      }
      setMessage('Login successful via Discord OAuth. Backend token saved.')
      clearCallbackQuery()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'OAuth login failed')
    } finally {
      clearOAuthSessionState()
      setLoading(false)
    }
  }

  async function onFetchMe() {
    if (!authToken) return
    setLoading(true)
    setMessage('')
    try {
      const data = await fetchMe(authToken)
      setMe(data)
      setMessage('Token validated through /api/me.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to fetch /api/me')
    } finally {
      setLoading(false)
    }
  }

  async function onFetchServers() {
    if (!authToken) return
    setLoading(true)
    setMessage('')
    try {
      const data = await fetchMyServers(authToken)
      setServersPayload(JSON.stringify(data, null, 2))
      setMessage('Fetched /api/me/servers successfully.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to fetch /api/me/servers')
    } finally {
      setLoading(false)
    }
  }

  async function onFetchGuilds() {
    if (!discordToken) {
      setMessage('No Discord access token — please log in again.')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const allGuilds = await fetchUserGuilds(discordToken)
      const manageable = filterManageableGuilds(allGuilds)
      setManageableGuilds(manageable)

      if (authToken) {
        const backendServers = await fetchMyServers(authToken) as Array<{ serverId: string; name: string }>
        const botServerIds = new Set(backendServers.map((s) => s.serverId))
        setBotGuilds(allGuilds.filter((g) => botServerIds.has(g.id)))
      }

      setMessage(`Loaded ${allGuilds.length} guilds — ${manageable.length} where you can manage the server.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to fetch guilds')
    } finally {
      setLoading(false)
    }
  }

  function onLogout() {
    clearToken()
    clearDiscordToken()
    clearCallbackQuery()
    setAuthToken('')
    setDiscordToken('')
    setMe(null)
    setServersPayload('')
    setManageableGuilds([])
    setBotGuilds([])
    setMessage('Logged out and token cleared.')
  }

  return (
    <main className="kc-shell">
      <section className="kc-hero-card">
        <div className="kc-brand">
          <img className="kc-brand-logo" src="/images/kanbancord.png" alt="KanbanCord" />
          <div>
            <h1>KanbanCord</h1>
            <p className="kc-subtitle">Auth Smoke Test</p>
          </div>
        </div>
        <p className="kc-muted">API Base URL: {API_BASE_URL || '(same-origin / Vite proxy)'}</p>
      </section>

      <AuthActions
        loading={loading}
        isAuthenticated={isAuthenticated}
        onLogin={() => startDiscordLogin(setMessage)}
        onValidateToken={onFetchMe}
        onFetchServers={onFetchServers}
        onLogout={onLogout}
      />

      <div className="kc-row">
        <button className="kc-btn" type="button" onClick={onFetchGuilds} disabled={!isAuthenticated || loading}>
          Fetch My Discord Guilds
        </button>
      </div>

      {message && <p className={`kc-message kc-message-${messageTone}`}>{message}</p>}

      {me && (
        <section className="kc-panel">
          <h2>/api/me Response</h2>
          <pre>{JSON.stringify(me, null, 2)}</pre>
        </section>
      )}

      {serversPayload && (
        <section className="kc-panel">
          <h2>/api/me/servers Response</h2>
          <pre>{serversPayload}</pre>
        </section>
      )}

      {manageableGuilds.length > 0 && (
        <GuildList
          title="Servers where you can manage / invite bot"
          guilds={manageableGuilds}
        />
      )}

      {botGuilds.length > 0 && (
        <GuildList
          title="Servers where both you and the bot are present"
          guilds={botGuilds}
          emptyMessage="Bot is not in any of your servers yet."
        />
      )}
    </main>
  )
}

