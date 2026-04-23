import { useEffect, useMemo, useState } from 'react'
import { FiLock, FiX, FiPlus } from 'react-icons/fi'
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
import {
  fetchServerPermissions,
  evaluatePermission,
  groupPermissionsByGrantedTo,
  updatePermissionState,
  deletePermission,
  fetchPermissionCatalog,
  createPermission,
  KANBAN_PERM_INFO,
  type PermissionEntry,
  type KanbanCatalogEntry,
} from '../services/permissionsService'
import { DISCORD_CLIENT_ID } from '../config/env'
import type { DiscordGuild, MeResponse } from '../types/auth'

type ApiServer = {
  serverId: string | number
  name: string
  botPresent?: boolean
  ownerId?: string | number
}

type MergedServer = DiscordGuild & {
  botPresent: boolean
  inviteLink?: string
}

const PERMISSION_RANK_WEIGHT: Record<string, number> = {
  ADMIN: 1000,
  MANAGE_SERVER_PERMISSIONS: 800,
  CREATE_BOARD: 600,
  EDIT_BOARD_DETAILS: 600,
  EDIT_BOARD_PERMISSIONS: 600,
  ARCHIVE_BOARD: 600,
  DELETE_BOARD: 600,
  CREATE_COLUMN: 600,
  EDIT_COLUMN: 600,
  DELETE_COLUMN: 600,
  MOVE_COLUMN: 600,
  CREATE_LABEL: 600,
  EDIT_LABEL: 600,
  DELETE_LABEL: 600,
  CREATE_TASK: 400,
  EDIT_TASK: 400,
  MOVE_TASK: 400,
  DELETE_TASK: 400,
  ARCHIVE_TASK: 400,
  ASSIGN_TASK_SELF: 400,
  ASSIGN_TASK_OTHERS: 400,
  CREATE_TASK_COMMENT: 400,
  EDIT_TASK_COMMENT: 400,
  DELETE_TASK_COMMENT: 400,
  APPLY_LABEL_TO_TASK: 400,
  REMOVE_LABEL_FROM_TASK: 400,
  VIEW_SERVER: 200,
  VIEW_AUDIT_LOG: 200,
  VIEW_BOARD: 200,
  VIEW_TASK: 200,
}

const ACTOR_RANK_PROBES: Array<{ key: string; weight: number }> = [
  { key: 'ADMIN', weight: 1000 },
  { key: 'MANAGE_SERVER_PERMISSIONS', weight: 800 },
  { key: 'CREATE_BOARD', weight: 600 },
  { key: 'CREATE_TASK', weight: 400 },
  { key: 'VIEW_SERVER', weight: 200 },
]

function permissionRankWeight(key: string): number {
  return PERMISSION_RANK_WEIGHT[key] ?? 200
}

function groupHighestAllowedRankWeight(entries: PermissionEntry[]): number {
  let best = 200
  for (const entry of entries) {
    if (entry.state !== 'ALLOW') continue
    const weight = permissionRankWeight(entry.kanbanPermissionKey)
    if (weight > best) best = weight
  }
  return best
}

function serverInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function buildBotInviteLink(guildId: string): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    guild_id: guildId,
    permissions: '412854119488',
    scope: 'bot applications.commands',
  })

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

export function DashboardPage() {
  const [authToken, setAuthToken] = useState<string>(() => getStoredToken())
  const [discordToken, setDiscordToken] = useState<string>(() => getStoredDiscordToken())
  const [me, setMe] = useState<MeResponse | null>(null)
  const [botServerIds, setBotServerIds] = useState<Set<string>>(new Set())
  const [apiServers, setApiServers] = useState<ApiServer[]>([])
  const [manageableGuilds, setManageableGuilds] = useState<DiscordGuild[]>([])
  const [selectedServerId, setSelectedServerId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')
  const [toasts, setToasts] = useState<Array<{ id: number; text: string; type: 'success' | 'error' }>>([])
  const [nextToastId, setNextToastId] = useState(0)
  const [serverPermissions, setServerPermissions] = useState<PermissionEntry[] | null>(null)
  const [canEditPermissions, setCanEditPermissions] = useState(false)
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [catalogEntries, setCatalogEntries] = useState<KanbanCatalogEntry[]>([])
  const [catalogLoadedForServer, setCatalogLoadedForServer] = useState<string>('')
  const [openAddGroupKey, setOpenAddGroupKey] = useState<string>('')
  const [actorRankWeight, setActorRankWeight] = useState<number>(200)
  const [newPermId, setNewPermId] = useState<number | ''>('')
  const [newPermState, setNewPermState] = useState<'ALLOW' | 'DENY'>('ALLOW')
  const [addSaving, setAddSaving] = useState(false)

  function setSuccess(text: string) { setMessage(text); setMessageType('success') }
  function setError(text: string) { setMessage(text); setMessageType('error') }

  // Toast notification functions for less important messages
  function showToast(text: string, type: 'success' | 'error' = 'success') {
    const id = nextToastId
    setNextToastId(id + 1)
    setToasts((prev) => [...prev, { id, text, type }])
    
    // Auto-dismiss after 3 seconds for success, 5 seconds for error
    const delay = type === 'success' ? 3000 : 5000
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, delay)
  }

  // Auto-dismiss notifications after a delay
  useEffect(() => {
    if (!message) return

    const delay = messageType === 'success' ? 3000 : 5000
    const timer = setTimeout(() => setMessage(''), delay)
    return () => clearTimeout(timer)
  }, [message, messageType])

  const isAuthenticated = useMemo(() => authToken.trim().length > 0, [authToken])

  /** Servers the bot is in AND user can manage (sidebar list) */
  const botServers = useMemo(
    () => manageableGuilds.filter((g) => botServerIds.has(g.id)),
    [manageableGuilds, botServerIds],
  )

  /** Unified merged list: bot-present servers first, then invite-needed servers */
  const mergedServers = useMemo<MergedServer[]>(
    () =>
      [...manageableGuilds]
        .map((g) => ({
          ...g,
          botPresent: botServerIds.has(g.id),
          inviteLink: botServerIds.has(g.id) ? undefined : buildBotInviteLink(g.id),
        }))
        .sort((a, b) => Number(b.botPresent) - Number(a.botPresent)),
    [manageableGuilds, botServerIds],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (!isOAuthInProgress()) {
      return
    }

    // Capture state and consume both session flags synchronously before any
    // async work — prevents StrictMode double-fire from replaying the code.
    const expectedState = getExpectedOAuthState()
    clearOAuthSessionState()

    if (error) {
      setError(`Discord authorization failed: ${error}`)
      clearCallbackQuery()
      return
    }

    if (!code) {
      return
    }

    if (!state || state !== expectedState) {
      setError('Invalid OAuth state. Please try again.')
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
      setApiServers([])
      setBotServerIds(new Set())
      setSelectedServerId('')
      return
    }
    // Wait for me to be confirmed before fetching guilds — avoids 403 race
    // when a stale stored JWT is still being validated by loadMe
    if (!me) return

    void loadGuilds(discordToken)
  }, [me, discordToken])

  useEffect(() => {
    setServerPermissions(null)
    setCanEditPermissions(false)
    setActorRankWeight(200)
    setOpenAddGroupKey('')
    setNewPermId('')
    setNewPermState('ALLOW')
    if (!selectedServerId || !authToken || !me) return
    void loadServerPermissions(selectedServerId)
  }, [selectedServerId, authToken, me])

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
      setSuccess('Logged in successfully.')
      clearCallbackQuery()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'OAuth login failed')
    } finally {
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
      setError('Session expired. Please login again.')
    }
  }

  async function loadGuilds(token: string) {
    setLoading(true)
    setMessage('')

    try {
      const allGuilds = await fetchUserGuilds(token)
      const manageable = filterManageableGuilds(allGuilds)
      setManageableGuilds(manageable)

      if (authToken) {
        const rawServers = await fetchMyServers(authToken)
        const serverList = Array.isArray(rawServers) ? (rawServers as ApiServer[]) : []
        setApiServers(serverList)
        const ids = new Set(
          serverList
            .filter((s) => s.botPresent !== false)
            .map((s) => String(s.serverId)),
        )
        setBotServerIds(ids)

        // Pre-select first server the bot is in
        const firstBot = manageable.find((g) => ids.has(g.id))
        if (!selectedServerId && firstBot) {
          setSelectedServerId(firstBot.id)
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch servers')
      setManageableGuilds([])
      setBotServerIds(new Set())
    } finally {
      setLoading(false)
    }
  }

  async function loadServerPermissions(serverId: string) {
    if (!authToken || !me) return
    setPermissionsLoading(true)
    try {
      const apiServer = apiServers.find((s) => String(s.serverId) === serverId)
      const isOwner = apiServer?.ownerId && String(apiServer.ownerId) === String(me.userId)
      
      if (isOwner) {
        setCanEditPermissions(true)
        setActorRankWeight(1000)
      } else {
        const decision = await evaluatePermission(authToken, serverId, me.userId, 'MANAGE_SERVER_PERMISSIONS')
        setCanEditPermissions(decision.allowed)

        const rankDecisions = await Promise.all(
          ACTOR_RANK_PROBES.map(async (probe) => {
            const result = await evaluatePermission(authToken, serverId, me.userId, probe.key)
            return result.allowed ? probe.weight : 0
          }),
        )
        setActorRankWeight(Math.max(...rankDecisions, 200))
      }
      
      if (isOwner || apiServer?.ownerId) {
        const perms = await fetchServerPermissions(authToken, serverId, me.userId)
        setServerPermissions(perms)
      }
    } catch (error) {
      console.error('Failed to load permissions:', error)
    } finally {
      setPermissionsLoading(false)
    }
  }

  async function handleTogglePermissionState(permissionId: number, currentState: 'ALLOW' | 'DENY') {
    if (!authToken || !selectedServerId || !me || !serverPermissions) return
    const newState = currentState === 'ALLOW' ? 'DENY' : 'ALLOW'
    
    // Optimistic update: change local state immediately
    const prevPermissions = serverPermissions
    setServerPermissions(
      serverPermissions.map((p) =>
        p.id === permissionId ? { ...p, state: newState } : p
      )
    )
    
    try {
      await updatePermissionState(authToken, selectedServerId, me.userId, permissionId, newState)
      showToast(`Permission state changed to ${newState}`, 'success')
    } catch (error) {
      // Revert on failure
      setServerPermissions(prevPermissions)
      setError(`Failed to update permission: ${error}`)
    }
  }

  async function handleDeletePermission(permissionId: number) {
    if (!authToken || !selectedServerId || !me || !serverPermissions) return
    
    // Optimistic update: remove from local state immediately
    const prevPermissions = serverPermissions
    setServerPermissions(serverPermissions.filter((p) => p.id !== permissionId))
    
    try {
      await deletePermission(authToken, selectedServerId, me.userId, permissionId)
      showToast('Permission removed', 'success')
    } catch (error) {
      // Revert on failure
      setServerPermissions(prevPermissions)
      setError(`Failed to delete permission: ${error}`)
    }
  }

  async function ensureCatalogForServer(serverId: string): Promise<KanbanCatalogEntry[]> {
    if (!authToken || !me) return []
    if (catalogLoadedForServer === serverId && catalogEntries.length > 0) return catalogEntries

    const entries = await fetchPermissionCatalog(authToken, serverId, me.userId)
    setCatalogEntries(entries)
    setCatalogLoadedForServer(serverId)
    return entries
  }

  async function openAddPermission(subjectType: string, subjectId: string, existingKeys: string[]) {
    if (!selectedServerId) return
    try {
      const entries = await ensureCatalogForServer(selectedServerId)
      const available = entries.filter((c) => {
        const actorCanGrant = actorRankWeight === 1000 || actorRankWeight > permissionRankWeight(c.key)
        return !existingKeys.includes(c.key) && actorCanGrant
      })
      if (available.length === 0) {
        showToast('No grantable permissions available for this target', 'error')
        return
      }
      setOpenAddGroupKey(`${subjectType}:${subjectId}`)
      setNewPermState('ALLOW')
      setNewPermId(available.length > 0 ? available[0].permissionId : '')
    } catch (error) {
      setError(`Failed to load permission catalog: ${error}`)
    }
  }

  async function handleAddPermission(subjectType: string, subjectId: string, defaultPriority: number) {
    if (!authToken || !selectedServerId || !me || !newPermId) return

    try {
      setAddSaving(true)
      await createPermission(authToken, selectedServerId, me.userId, {
        scopeType: 'SERVER',
        scopeId: selectedServerId,
        subjectType,
        subjectId,
        kanbanPermissionId: Number(newPermId),
        state: newPermState,
        priority: defaultPriority,
        isImmutable: false,
      })
      await loadServerPermissions(selectedServerId)
      setOpenAddGroupKey('')
      setNewPermId('')
      showToast('Permission added', 'success')
    } catch (error) {
      setError(`Failed to add permission: ${error}`)
    } finally {
      setAddSaving(false)
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
    setApiServers([])
    setBotServerIds(new Set())
    setSelectedServerId('')
    setServerPermissions(null)
    setCanEditPermissions(false)
    setSuccess('Logged out successfully.')
  }

  function onServerCardClick(server: MergedServer) {
    if (!server.botPresent && server.inviteLink) {
      window.open(server.inviteLink, '_blank')
    } else {
      setSelectedServerId(server.id)
    }
  }

  const selectedServer = botServers.find((s) => s.id === selectedServerId) ?? null

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
          <h2 className="kc-sidebar-title">Servers</h2>
          {!isAuthenticated && <p className="kc-muted">Login to see your servers.</p>}
          {isAuthenticated && botServers.length === 0 && !loading && (
            <p className="kc-muted">KanbanCord is not in any of your servers yet.</p>
          )}
          <ul className="kc-guild-rail">
            {botServers.map((server) => {
              const icon = guildIconUrl(server)
              return (
                <li key={server.id}>
                  <button
                    className={`kc-guild-pill ${selectedServerId === server.id ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setSelectedServerId(server.id)}
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

        <main className="kc-content">
          {message && <p className={`kc-banner${messageType === 'success' ? ' kc-banner--success' : ''}`}>{message}</p>}

          {!isAuthenticated && (
            <section className="kc-panel">
              <h2>Welcome</h2>
              <p className="kc-muted">
                Login with Discord to load your servers and manage KanbanCord boards.
              </p>
            </section>
          )}

          {isAuthenticated && selectedServer && (
            <section className="kc-panel">
              <h2>{selectedServer.name}</h2>
              <p className="kc-muted">Server overview and permissions.</p>
              
              {canEditPermissions && (
                <div className="kc-server-perms-section">
                  <h3>Permissions</h3>
                  {permissionsLoading && (
                    <div className="kc-loading-state" aria-live="polite" aria-busy="true">
                      <span className="kc-spinner" aria-hidden="true" />
                      <span className="kc-muted">Loading permissions...</span>
                    </div>
                  )}
                  {!permissionsLoading && serverPermissions && (
                    <div className="kc-perms-granted-to-list">
                      {groupPermissionsByGrantedTo(serverPermissions).map((group) => (
                        <div key={`${group.subjectType}:${group.subjectId}`} className="kc-perms-granted-to-row">
                          <div className="kc-perms-granted-to-label">
                            <span className="kc-muted">{group.subjectDisplay}</span>
                          </div>
                          <div className="kc-perms-granted-to-perms">
                            {group.permissions.map((perm) => {
                              const permName = KANBAN_PERM_INFO[perm.kanbanPermissionKey]?.name ?? perm.kanbanPermissionKey
                              const groupRank = groupHighestAllowedRankWeight(group.permissions)
                              const targetGuarded =
                                (group.subjectType === 'USER' || group.subjectType === 'ROLE')
                                && actorRankWeight !== 1000
                                && actorRankWeight <= groupRank
                              const actorCanModifyKey =
                                actorRankWeight === 1000 || actorRankWeight > permissionRankWeight(perm.kanbanPermissionKey)
                              const isLocked = perm.isImmutable || targetGuarded || !actorCanModifyKey
                              return (
                                <div
                                  key={perm.id}
                                  className={`kc-perm-button kc-perm-button--${perm.state.toLowerCase()}${isLocked ? ` ${perm.isImmutable ? 'kc-perm-button--immutable' : 'kc-perm-button--locked'}` : ''}`}
                                  title={`${permName} — ${perm.state}${isLocked ? ' (locked)' : ''}`}
                                  onClick={() => !isLocked && handleTogglePermissionState(perm.id, perm.state)}
                                  role="button"
                                  tabIndex={isLocked ? -1 : 0}
                                  onKeyDown={(e) => {
                                    if (!isLocked && (e.key === 'Enter' || e.key === ' ')) {
                                      handleTogglePermissionState(perm.id, perm.state)
                                    }
                                  }}
                                >
                                  <span className="kc-perm-button-text">{permName}</span>
                                  {isLocked
                                    ? <FiLock className="kc-perm-lock" aria-hidden="true" />
                                    : (
                                      <button
                                        className="kc-perm-button-remove"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeletePermission(perm.id)
                                        }}
                                        title="Remove permission"
                                        aria-label={`Remove ${permName}`}
                                      >
                                        <FiX aria-hidden="true" />
                                      </button>
                                    )
                                  }
                                </div>
                              )
                            })}
                            {openAddGroupKey === `${group.subjectType}:${group.subjectId}` && (
                              <div className="kc-perm-add-editor">
                                <select
                                  className="kc-perm-add-select"
                                  value={newPermId}
                                  onChange={(e) => setNewPermId(e.target.value ? Number(e.target.value) : '')}
                                >
                                  {catalogEntries
                                    .filter((c) => !group.permissions.some((p) => p.kanbanPermissionKey === c.key))
                                    .map((c) => (
                                      <option key={c.permissionId} value={c.permissionId}>
                                        {c.name}
                                      </option>
                                    ))}
                                </select>
                                <select
                                  className="kc-perm-add-state"
                                  value={newPermState}
                                  onChange={(e) => setNewPermState(e.target.value as 'ALLOW' | 'DENY')}
                                >
                                  <option value="ALLOW">ALLOW</option>
                                  <option value="DENY">DENY</option>
                                </select>
                                <button
                                  type="button"
                                  className="kc-btn kc-btn-primary kc-perm-add-save"
                                  disabled={addSaving || !newPermId}
                                  onClick={() => handleAddPermission(
                                    group.subjectType,
                                    group.subjectId,
                                    Math.max(...group.permissions.map((p) => p.priority), 100),
                                  )}
                                >
                                  Add
                                </button>
                                <button
                                  type="button"
                                  className="kc-btn kc-btn-ghost kc-perm-add-cancel"
                                  disabled={addSaving}
                                  onClick={() => {
                                    setOpenAddGroupKey('')
                                    setNewPermId('')
                                    setNewPermState('ALLOW')
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {!(group.subjectType === 'DISCORD_PERMISSION' && String(group.subjectId) === '8') && (
                              <button
                                type="button"
                                className="kc-perm-button-add"
                                title="Add permission"
                                aria-label="Add permission"
                                disabled={
                                  (group.subjectType === 'USER' || group.subjectType === 'ROLE')
                                    && actorRankWeight !== 1000
                                    && actorRankWeight <= groupHighestAllowedRankWeight(group.permissions)
                                }
                                onClick={() => openAddPermission(
                                  group.subjectType,
                                  group.subjectId,
                                  group.permissions.map((p) => p.kanbanPermissionKey),
                                )}
                              >
                                <FiPlus aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {isAuthenticated && (
            <section className="kc-panel">
              <h2>Your Servers</h2>
              {loading ? (
                <div className="kc-loading-state" aria-live="polite" aria-busy="true">
                  <span className="kc-spinner" aria-hidden="true" />
                  <span className="kc-muted">Loading your servers...</span>
                </div>
              ) : mergedServers.length === 0 ? (
                <p className="kc-muted">No servers with manage permissions found.</p>
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
                      {!server.botPresent && (
                        <p className="kc-invite-hint">Click to invite bot</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Toast notifications in bottom-right */}
      <div className="kc-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`kc-toast kc-toast--${toast.type}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  )
}
