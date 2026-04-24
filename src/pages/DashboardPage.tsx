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
import { fetchUserGuilds, filterManageableGuilds } from '../services/discordGuildsService'
import {
  fetchServerPermissions,
  evaluatePermission,
  groupPermissionsByGrantedTo,
  updatePermissionState,
  deletePermission,
  fetchPermissionCatalog,
  createPermission,
  fetchServerRoles,
  fetchServerMembers,
  KANBAN_PERM_INFO,
  DISCORD_FLAG_NAMES,
  DISCORD_PERM_IMPORTANCE,
  type PermissionEntry,
  type KanbanCatalogEntry,
  type ServerRoleEntry,
  type ServerMemberEntry,
  type SubjectLookups,
} from '../services/permissionsService'
import { DISCORD_CLIENT_ID } from '../config/env'
import type { DiscordGuild, MeResponse } from '../types/auth'
import { AddEntryModal } from '../components/dashboard/AddEntryModal'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { DeleteGroupModal } from '../components/dashboard/DeleteGroupModal'
import { ServerOverviewPanel } from '../components/dashboard/ServerOverviewPanel'
import { ServersGridSection } from '../components/dashboard/ServersGridSection'
import { SidebarServerRail } from '../components/dashboard/SidebarServerRail'
import { ToastStack } from '../components/dashboard/ToastStack'
import type { ApiServer, DeleteGroupTarget, MergedServer, ToastMessage } from '../components/dashboard/types'

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
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [nextToastId, setNextToastId] = useState(0)
  const [serverPermissions, setServerPermissions] = useState<PermissionEntry[] | null>(null)
  const [canEditPermissions, setCanEditPermissions] = useState(false)
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [permissionsCollapsed, setPermissionsCollapsed] = useState(true)
  const [expandedPermissionGroups, setExpandedPermissionGroups] = useState<Set<string>>(new Set())
  const [catalogEntries, setCatalogEntries] = useState<KanbanCatalogEntry[]>([])
  const [catalogLoadedForServer, setCatalogLoadedForServer] = useState<string>('')
  const [openAddGroupKey, setOpenAddGroupKey] = useState<string>('')
  const [actorRankWeight, setActorRankWeight] = useState<number>(200)
  const [newPermId, setNewPermId] = useState<number | ''>('')
  const [newPermState, setNewPermState] = useState<'ALLOW' | 'DENY'>('ALLOW')
  const [addSaving, setAddSaving] = useState(false)

  // ── "Add new entry" modal ────────────────────────────────────
  const [permFilter, setPermFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [modalSubjectType, setModalSubjectType] = useState<string | null>(null)
  const [modalSubjectId, setModalSubjectId] = useState<string | null>(null)
  const [modalSubjectDisplay, setModalSubjectDisplay] = useState<string | null>(null)
  const [modalPermStates, setModalPermStates] = useState<Record<number, 'ALLOW' | 'DENY'>>({})
  const [serverRoles, setServerRoles] = useState<ServerRoleEntry[]>([])
  const [serverMembers, setServerMembers] = useState<ServerMemberEntry[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)

  // ── Delete-group confirmation modal ──────────────────────────
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<DeleteGroupTarget | null>(null)
  const [deleteGroupSaving, setDeleteGroupSaving] = useState(false)

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
    setPermissionsCollapsed(true)
    setExpandedPermissionGroups(new Set())
    setActorRankWeight(200)
    setOpenAddGroupKey('')
    setNewPermId('')
    setNewPermState('ALLOW')
    setPermFilter('')
    setShowAddModal(false)
    setServerRoles([])
    setServerMembers([])
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
        const [perms] = await Promise.all([
          fetchServerPermissions(authToken, serverId, me.userId),
          serverRoles.length === 0
            ? fetchServerRoles(authToken, serverId, me.userId).then(setServerRoles)
            : Promise.resolve(),
          serverMembers.length === 0
            ? fetchServerMembers(authToken, serverId, me.userId).then(setServerMembers)
            : Promise.resolve(),
        ])
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

  async function handleDeleteGroup() {
    if (!authToken || !selectedServerId || !me || !deleteGroupTarget) return
    setDeleteGroupSaving(true)
    try {
      await Promise.all(
        deleteGroupTarget.permissions.map((p) =>
          deletePermission(authToken, selectedServerId!, me!.userId, p.id),
        ),
      )
      await loadServerPermissions(selectedServerId)
      showToast(`Removed all permissions for ${deleteGroupTarget.subjectDisplay}`, 'success')
      setDeleteGroupTarget(null)
    } catch (error) {
      setError(`Failed to delete permission entry: ${error}`)
    } finally {
      setDeleteGroupSaving(false)
    }
  }

  async function ensureCatalogForServer(serverId: string): Promise<KanbanCatalogEntry[]> {    if (!authToken || !me) return []
    if (catalogLoadedForServer === serverId && catalogEntries.length > 0) return catalogEntries

    const entries = await fetchPermissionCatalog(authToken, serverId, me.userId)
    setCatalogEntries(entries)
    setCatalogLoadedForServer(serverId)
    return entries
  }

  // ── "Add new entry" modal handlers ─────────────────────────
  async function openNewEntryModal() {
    if (!authToken || !selectedServerId || !me) return
    setShowAddModal(true)
    setModalSearch('')
    setModalSubjectType(null)
    setModalSubjectId(null)
    setModalSubjectDisplay(null)
    setModalPermStates({})

    setModalLoading(true)
    try {
      await Promise.all([
        ensureCatalogForServer(selectedServerId),
        serverRoles.length === 0
          ? fetchServerRoles(authToken, selectedServerId, me.userId).then(setServerRoles)
          : Promise.resolve(),
        serverMembers.length === 0
          ? fetchServerMembers(authToken, selectedServerId, me.userId).then(setServerMembers)
          : Promise.resolve(),
      ])
    } catch (err) {
      showToast(`Failed to load data: ${err}`, 'error')
    } finally {
      setModalLoading(false)
    }
  }

  function closeModal() {
    setShowAddModal(false)
    setModalSearch('')
    setModalSubjectType(null)
    setModalSubjectId(null)
    setModalSubjectDisplay(null)
    setModalPermStates({})
  }

  function selectModalSubject(subjectType: string, subjectId: string, display: string) {
    setModalSubjectType(subjectType)
    setModalSubjectId(subjectId)
    setModalSubjectDisplay(display)
    setModalPermStates({})
  }

  function clearModalSubject() {
    setModalSubjectType(null)
    setModalSubjectId(null)
    setModalSubjectDisplay(null)
    setModalPermStates({})
    setModalSearch('')
  }

  function cycleModalPermState(permissionId: number) {
    setModalPermStates((prev) => {
      const current = prev[permissionId] ?? null
      if (current === null) return { ...prev, [permissionId]: 'ALLOW' }
      if (current === 'ALLOW') return { ...prev, [permissionId]: 'DENY' }
      const next = { ...prev }
      delete next[permissionId]
      return next
    })
  }

  async function handleSaveModal() {
    if (!authToken || !selectedServerId || !me || !modalSubjectType || !modalSubjectId) return
    const entries = Object.entries(modalPermStates)
    if (entries.length === 0) return

    setModalSaving(true)
    try {
      await Promise.all(
        entries.map(([permIdStr, state]) =>
          createPermission(authToken, selectedServerId, me.userId, {
            scopeType: 'SERVER',
            scopeId: selectedServerId,
            subjectType: modalSubjectType,
            subjectId: modalSubjectId,
            kanbanPermissionId: Number(permIdStr),
            state,
            priority: 100,
            isImmutable: false,
          }),
        ),
      )
      await loadServerPermissions(selectedServerId)
      closeModal()
      showToast(`${entries.length} permission${entries.length > 1 ? 's' : ''} added`, 'success')
    } catch (err) {
      setError(`Failed to save permissions: ${err}`)
    } finally {
      setModalSaving(false)
    }
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

  function togglePermissionGroupExpansion(groupKey: string) {
    setExpandedPermissionGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  const selectedServer = botServers.find((s) => s.id === selectedServerId) ?? null

  // ── Modal computed lists ────────────────────────────────────
  const existingSubjectIds = useMemo(() => {
    const map: Record<string, Set<string>> = {
      DISCORD_PERMISSION: new Set(),
      ROLE: new Set(),
      USER: new Set(),
    }
    for (const p of serverPermissions ?? []) {
      map[p.subjectType]?.add(p.subjectId)
    }
    return map
  }, [serverPermissions])

  const filteredDiscordPerms = useMemo(() => {
    const q = modalSearch.toLowerCase()
    return Object.entries(DISCORD_FLAG_NAMES)
      .filter(([id]) => !existingSubjectIds.DISCORD_PERMISSION.has(id))
      .filter(([id, name]) => !q || name.toLowerCase().includes(q) || id.includes(q))
      .sort(([idA], [idB]) => (DISCORD_PERM_IMPORTANCE[idA] ?? 999) - (DISCORD_PERM_IMPORTANCE[idB] ?? 999))
      .map(([id, name]) => ({ id, name }))
  }, [modalSearch, existingSubjectIds])

  const filteredRoles = useMemo(() => {
    const q = modalSearch.toLowerCase()
    const available = serverRoles.filter((r) => !existingSubjectIds.ROLE.has(r.roleId))
    if (!q) return available
    return available.filter((r) => r.name.toLowerCase().includes(q) || r.roleId.includes(q))
  }, [modalSearch, serverRoles, existingSubjectIds])

  const filteredMembers = useMemo(() => {
    const q = modalSearch.toLowerCase()
    const available = serverMembers.filter((m) => !existingSubjectIds.USER.has(m.userId))
    if (!q) return available
    return available.filter((m) => {
      const display = m.displayName ?? m.nickname ?? `User #${m.userId}`
      return (
        display.toLowerCase().includes(q) ||
        (m.username?.toLowerCase().includes(q) ?? false) ||
        m.userId.includes(q)
      )
    })
  }, [modalSearch, serverMembers, existingSubjectIds])

  const grantableCatalogEntries = useMemo(() => {
    if (!modalSubjectType || !modalSubjectId) return []
    const existingKeys = serverPermissions
      ?.filter((p) => p.subjectType === modalSubjectType && p.subjectId === modalSubjectId)
      .map((p) => p.kanbanPermissionKey) ?? []
    return catalogEntries.filter((c) => {
      const actorCanGrant = actorRankWeight === 1000 || actorRankWeight > permissionRankWeight(c.key)
      return actorCanGrant && !existingKeys.includes(c.key)
    })
  }, [modalSubjectType, modalSubjectId, catalogEntries, serverPermissions, actorRankWeight])

  const filteredGroups = useMemo(() => {
    if (!serverPermissions) return []
    const lookups: SubjectLookups = {
      roles: new Map(serverRoles.map((r) => [r.roleId, r.name])),
      members: new Map(
        serverMembers.map((m) => [m.userId, m.displayName ?? m.nickname ?? m.userId]),
      ),
    }
    const groups = groupPermissionsByGrantedTo(serverPermissions, lookups)
    if (!permFilter.trim()) return groups
    const q = permFilter.toLowerCase()
    const usernameMap = new Map(serverMembers.map((m) => [m.userId, m.username ?? '']))
    return groups.filter(
      (g) =>
        g.subjectDisplay.toLowerCase().includes(q) ||
        String(g.subjectId).includes(q) ||
        (g.subjectType === 'USER' && (usernameMap.get(g.subjectId)?.toLowerCase().includes(q) ?? false)) ||
        g.permissions.some((p) =>
          (KANBAN_PERM_INFO[p.kanbanPermissionKey]?.name ?? p.kanbanPermissionKey).toLowerCase().includes(q),
        ),
    )
  }, [serverPermissions, permFilter, serverRoles, serverMembers])

  return (
    <div className="kc-dashboard-root">
      <DashboardHeader
        isAuthenticated={isAuthenticated}
        me={me}
        loading={loading}
        onLogout={onLogout}
        onLogin={() => {
          setMessage('')
          setMessageType('error')
          startDiscordLogin(setMessage)
        }}
      />

      <div className="kc-dashboard-shell">
        <SidebarServerRail
          isAuthenticated={isAuthenticated}
          botServers={botServers}
          selectedServerId={selectedServerId}
          loading={loading}
          onSelectServer={setSelectedServerId}
        />

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

          <ServerOverviewPanel
            selectedServer={isAuthenticated ? selectedServer : null}
            canEditPermissions={canEditPermissions}
            permissionsCollapsed={permissionsCollapsed}
            permissionsLoading={permissionsLoading}
            permFilter={permFilter}
            filteredGroups={serverPermissions ? filteredGroups : []}
            expandedPermissionGroups={expandedPermissionGroups}
            actorRankWeight={actorRankWeight}
            openAddGroupKey={openAddGroupKey}
            newPermId={newPermId}
            newPermState={newPermState}
            addSaving={addSaving}
            catalogEntries={catalogEntries}
            onToggleCollapsed={() => setPermissionsCollapsed((prev) => !prev)}
            onPermFilterChange={setPermFilter}
            onOpenNewEntryModal={() => {
              void openNewEntryModal()
            }}
            onToggleGroupExpansion={togglePermissionGroupExpansion}
            onRequestDeleteGroup={setDeleteGroupTarget}
            onOpenAddPermission={openAddPermission}
            onTogglePermissionState={handleTogglePermissionState}
            onDeletePermission={handleDeletePermission}
            onSetNewPermId={setNewPermId}
            onSetNewPermState={setNewPermState}
            onAddPermission={(subjectType, subjectId, defaultPriority) => {
              void handleAddPermission(subjectType, subjectId, defaultPriority)
            }}
            onCancelAddPermission={() => {
              setOpenAddGroupKey('')
              setNewPermId('')
              setNewPermState('ALLOW')
            }}
          />

          <ServersGridSection
            isAuthenticated={isAuthenticated}
            loading={loading}
            mergedServers={mergedServers}
            onServerCardClick={onServerCardClick}
          />
        </main>
      </div>

      <ToastStack toasts={toasts} />

      <DeleteGroupModal
        target={deleteGroupTarget}
        deleteGroupSaving={deleteGroupSaving}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={() => {
          void handleDeleteGroup()
        }}
      />

      <AddEntryModal
        show={showAddModal}
        loading={modalLoading}
        saving={modalSaving}
        modalSearch={modalSearch}
        subjectType={modalSubjectType}
        subjectDisplay={modalSubjectDisplay}
        modalPermStates={modalPermStates}
        filteredDiscordPerms={filteredDiscordPerms}
        filteredRoles={filteredRoles}
        filteredMembers={filteredMembers}
        grantableCatalogEntries={grantableCatalogEntries}
        onClose={closeModal}
        onSearchChange={setModalSearch}
        onSelectSubject={selectModalSubject}
        onClearSubject={clearModalSubject}
        onCyclePermState={cycleModalPermState}
        onSave={() => {
          void handleSaveModal()
        }}
      />
    </div>
  )
}
