import { useEffect, useMemo, useState } from 'react'
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
import { fetchMyServers, fetchMe } from '../services/meService'
import { fetchUserGuilds, filterManageableGuilds, guildIconUrl } from '../services/discordGuildsService'
import type { DiscordGuild, MeResponse } from '../types/auth'

type ApiServer = {
  serverId: string | number
  name: string
}

function guildInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export function DashboardPage() {
  const [authToken, setAuthToken] = useState<string>(() => getStoredToken())
  const [discordToken, setDiscordToken] = useState<string>(() => getStoredDiscordToken())
  const [me, setMe] = useState<MeResponse | null>(null)
  const [manageableGuilds, setManageableGuilds] = useState<DiscordGuild[]>([])
  const [botGuilds, setBotGuilds] = useState<DiscordGuild[]>([])
  const [selectedGuildId, setSelectedGuildId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const isAuthenticated = useMemo(() => authToken.trim().length > 0, [authToken])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (!isOAuthInProgress()) {
      return
    }

    if (error) {
      setMessage(`Discord authorization failed: ${error}`)
      clearOAuthSessionState()
      clearCallbackQuery()
      return
    }

    if (!code) {
      return
    }

    const expectedState = getExpectedOAuthState()
    if (!state || !expectedState || state !== expectedState) {
      setMessage('Invalid OAuth state. Please try again.')
      clearOAuthSessionState()
      clearCallbackQuery()
      return
    }

    void completeDiscordExchange(code)
  }, [])

  useEffect(() => {
    if (!authToken) {
      setMe(null)
      return
    }

    void loadMe(authToken)
  }, [authToken])

  useEffect(() => {
    if (!discordToken) {
      setManageableGuilds([])
      setBotGuilds([])
      setSelectedGuildId('')
      return
    }

    void loadGuilds(discordToken)
  }, [discordToken, authToken])

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
      setMessage('Logged in successfully.')
      clearCallbackQuery()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'OAuth login failed')
    } finally {
      clearOAuthSessionState()
      setLoading(false)
    }
  }

  async function loadMe(token: string) {
    try {
      const user = await fetchMe(token)
      setMe(user)
    } catch {
      clearToken()
      clearDiscordToken()
      setAuthToken('')
      setDiscordToken('')
      setMe(null)
      setMessage('Session expired. Please login again.')
    }
  }

  async function loadGuilds(token: string) {
    setLoading(true)
    setMessage('')

    try {
      const allGuilds = await fetchUserGuilds(token)
      const manageable = filterManageableGuilds(allGuilds)
      setManageableGuilds(manageable)

      if (!selectedGuildId && manageable.length > 0) {
        setSelectedGuildId(manageable[0].id)
      }

      if (authToken) {
        const rawServers = await fetchMyServers(authToken)
        const serverList = Array.isArray(rawServers) ? (rawServers as ApiServer[]) : []
        const botServerIds = new Set(serverList.map((server) => String(server.serverId)))
        setBotGuilds(allGuilds.filter((guild) => botServerIds.has(guild.id)))
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to fetch guilds')
      setManageableGuilds([])
      setBotGuilds([])
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
    setManageableGuilds([])
    setBotGuilds([])
    setSelectedGuildId('')
    setMessage('Logged out successfully.')
  }

  const selectedGuild = manageableGuilds.find((guild) => guild.id === selectedGuildId) ?? null

  return (
    <div className="kc-dashboard-root">
      <header className="kc-topbar">
        <div className="kc-brand-block">
          <img src="/images/kanbancord.png" alt="KanbanCord" className="kc-logo" />
          <div>
            <h1 className="kc-title">KanbanCord</h1>
            <p className="kc-subtitle">Dashboard</p>
          </div>
        </div>

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
                <span className="kc-avatar-fallback">{guildInitial(me.username)}</span>
              )}
              <button className="kc-btn kc-btn-ghost" type="button" onClick={onLogout} disabled={loading}>
                Logout
              </button>
            </>
          ) : (
            <button
              className="kc-btn kc-btn-primary"
              type="button"
              onClick={() => startDiscordLogin(setMessage)}
              disabled={loading}
            >
              Login with Discord
            </button>
          )}
        </div>
      </header>

      <div className="kc-dashboard-shell">
        <aside className="kc-sidebar">
          <h2 className="kc-sidebar-title">Guilds</h2>
          {!isAuthenticated && <p className="kc-muted">Login to load your servers.</p>}
          {isAuthenticated && manageableGuilds.length === 0 && !loading && (
            <p className="kc-muted">No manageable servers found.</p>
          )}
          <ul className="kc-guild-rail">
            {manageableGuilds.map((guild) => {
              const icon = guildIconUrl(guild)
              return (
                <li key={guild.id}>
                  <button
                    className={`kc-guild-pill ${selectedGuildId === guild.id ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setSelectedGuildId(guild.id)}
                  >
                    {icon ? (
                      <img className="kc-guild-pill-icon" src={icon} alt={guild.name} />
                    ) : (
                      <span className="kc-guild-pill-fallback">{guildInitial(guild.name)}</span>
                    )}
                    <span className="kc-guild-pill-text">{guild.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <main className="kc-content">
          {message && <p className="kc-banner">{message}</p>}

          {!isAuthenticated && (
            <section className="kc-panel">
              <h2>Welcome</h2>
              <p className="kc-muted">
                Login with Discord to load your servers and see where you can manage or invite the bot.
              </p>
            </section>
          )}

          {isAuthenticated && selectedGuild && (
            <section className="kc-panel">
              <h2>{selectedGuild.name}</h2>
              <p className="kc-muted">Selected server overview.</p>
            </section>
          )}

          {isAuthenticated && (
            <section className="kc-panel">
              <h2>Servers You Can Manage</h2>
              {manageableGuilds.length === 0 ? (
                <p className="kc-muted">No servers with manage/admin permissions.</p>
              ) : (
                <div className="kc-card-grid">
                  {manageableGuilds.map((guild) => (
                    <article key={guild.id} className="kc-card">
                      <div className="kc-card-head">
                        {guildIconUrl(guild) ? (
                          <img src={guildIconUrl(guild) ?? ''} alt={guild.name} className="kc-card-icon" />
                        ) : (
                          <span className="kc-card-fallback">{guildInitial(guild.name)}</span>
                        )}
                        <h3>{guild.name}</h3>
                      </div>
                      <p>Manage Server / Admin available</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {isAuthenticated && (
            <section className="kc-panel">
              <h2>Servers With Bot Present</h2>
              {botGuilds.length === 0 ? (
                <p className="kc-muted">Bot is not in any of your servers yet.</p>
              ) : (
                <div className="kc-card-grid">
                  {botGuilds.map((guild) => (
                    <article key={guild.id} className="kc-card">
                      <div className="kc-card-head">
                        {guildIconUrl(guild) ? (
                          <img src={guildIconUrl(guild) ?? ''} alt={guild.name} className="kc-card-icon" />
                        ) : (
                          <span className="kc-card-fallback">{guildInitial(guild.name)}</span>
                        )}
                        <h3>{guild.name}</h3>
                      </div>
                      <p>You and the bot are both in this server.</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
