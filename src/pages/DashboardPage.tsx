import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  fetchScopedPermissions,
  groupPermissionsByGrantedTo,
  updatePermissionState,
  deletePermission,
  fetchPermissionCatalog,
  createPermission,
  fetchServerRoles,
  fetchServerMembers,
  evaluatePermissions,
  KANBAN_PERM_INFO,
  DISCORD_FLAG_NAMES,
  DISCORD_PERM_IMPORTANCE,
  type PermissionEntry,
  type KanbanCatalogEntry,
  type ServerRoleEntry,
  type ServerMemberEntry,
  type SubjectLookups,
} from '../services/permissionsService'
import {
  archiveBoard,
  createBoard,
  deleteBoard,
  fetchBoards,
  updateBoard,
  type BoardEntry,
} from '../services/boardsService'
import { connectRealtimeChannel, serverTopic } from '../services/realtimeService'
import { DISCORD_CLIENT_ID } from '../config/env'
import type { DiscordGuild, MeResponse } from '../types/auth'
import { AddEntryModal } from '../components/dashboard/AddEntryModal'
import { BoardModal } from '../components/dashboard/boards/BoardModal'
import {
  boardPermissionOverrides,
  buildInheritedBoardPermissionDrafts,
  mergeBoardPermissionDrafts,
  diffBoardPermissions,
} from '../components/dashboard/boards/boardPermissionDraft'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { DeleteGroupModal } from '../components/dashboard/DeleteGroupModal'
import { permissionRankWeight } from '../components/dashboard/permissionRank'
import { ServerOverviewPanel } from '../components/dashboard/ServerOverviewPanel'
import { ServersGridSection } from '../components/dashboard/ServersGridSection'
import { SidebarServerRail } from '../components/dashboard/SidebarServerRail'
import { ToastStack } from '../components/dashboard/ToastStack'
import type {
  ApiServer,
  BoardCapability,
  BoardModalConfig,
  DeleteGroupTarget,
  MergedServer,
  ToastMessage,
} from '../components/dashboard/types'

const ACTOR_RANK_PROBES: Array<{ key: string; weight: number }> = [
  { key: 'ADMIN', weight: 1000 },
  { key: 'MANAGE_SERVER_PERMISSIONS', weight: 800 },
  { key: 'CREATE_BOARD', weight: 600 },
  { key: 'CREATE_TASK', weight: 400 },
  { key: 'VIEW_SERVER', weight: 200 },
]

type DashboardWarmCache = {
  authToken: string
  discordToken: string
  me: MeResponse | null
  manageableGuilds: DiscordGuild[]
  apiServers: ApiServer[]
  botServerIds: string[]
  selectedServerId: string
  serverPermissions: PermissionEntry[] | null
  boards: BoardEntry[]
  canCreateBoard: boolean
  boardCapabilities: Record<string, BoardCapability>
  canEditPermissions: boolean
  actorRankWeight: number
}

let dashboardWarmCache: DashboardWarmCache | null = null

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
  const navigate = useNavigate()
  const [authToken, setAuthToken] = useState<string>(() => getStoredToken())
  const [discordToken, setDiscordToken] = useState<string>(() => getStoredDiscordToken())
  const [me, setMe] = useState<MeResponse | null>(() => dashboardWarmCache?.me ?? null)
  const [botServerIds, setBotServerIds] = useState<Set<string>>(() => new Set(dashboardWarmCache?.botServerIds ?? []))
  const [apiServers, setApiServers] = useState<ApiServer[]>(() => dashboardWarmCache?.apiServers ?? [])
  const [manageableGuilds, setManageableGuilds] = useState<DiscordGuild[]>(() => dashboardWarmCache?.manageableGuilds ?? [])
  const [selectedServerId, setSelectedServerId] = useState<string>(() => dashboardWarmCache?.selectedServerId ?? '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [nextToastId, setNextToastId] = useState(0)
  const [serverPermissions, setServerPermissions] = useState<PermissionEntry[] | null>(() => dashboardWarmCache?.serverPermissions ?? null)
  const [boards, setBoards] = useState<BoardEntry[]>(() => dashboardWarmCache?.boards ?? [])
  const [boardsLoading, setBoardsLoading] = useState(false)
  const [canCreateBoard, setCanCreateBoard] = useState(() => dashboardWarmCache?.canCreateBoard ?? false)
  const [boardCapabilities, setBoardCapabilities] = useState<Record<string, BoardCapability>>(() => dashboardWarmCache?.boardCapabilities ?? {})
  const [canEditPermissions, setCanEditPermissions] = useState(() => dashboardWarmCache?.canEditPermissions ?? false)
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [permissionsCollapsed, setPermissionsCollapsed] = useState(true)
  const [expandedPermissionGroups, setExpandedPermissionGroups] = useState<Set<string>>(new Set())
  const [catalogEntries, setCatalogEntries] = useState<KanbanCatalogEntry[]>([])
  const [catalogLoadedForServer, setCatalogLoadedForServer] = useState<string>('')
  const [openAddGroupKey, setOpenAddGroupKey] = useState<string>('')
  const [actorRankWeight, setActorRankWeight] = useState<number>(() => dashboardWarmCache?.actorRankWeight ?? 200)
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
  const [boardModalConfig, setBoardModalConfig] = useState<BoardModalConfig | null>(null)
  const [boardModalPermissions, setBoardModalPermissions] = useState<PermissionEntry[]>([])
  const [boardModalLoading, setBoardModalLoading] = useState(false)
  const [boardModalSaving, setBoardModalSaving] = useState(false)
  const prevSelectedServerIdRef = useRef<string>(selectedServerId)
  const serverRealtimeRefreshTimerRef = useRef<number | null>(null)
  const deferredModalSearch = useDeferredValue(modalSearch)

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

    const hasWarmGuildData =
      dashboardWarmCache !== null &&
      dashboardWarmCache.discordToken === discordToken &&
      dashboardWarmCache.authToken === authToken &&
      dashboardWarmCache.me?.userId === me.userId &&
      dashboardWarmCache.manageableGuilds.length > 0

    void loadGuilds(discordToken, { silent: hasWarmGuildData })
  }, [me, discordToken])

  useEffect(() => {
    if (!discordToken || !authToken || !me) return

    // Increase polling interval to 10 minutes (600000 ms)
    const timer = window.setInterval(() => {
      void loadGuilds(discordToken, { silent: true });
    }, 600000);

    return () => {
      window.clearInterval(timer);
    };
  }, [discordToken, authToken, me]);


  useEffect(() => {
    if (!selectedServerId || !authToken || !me) return

    const serverChanged = prevSelectedServerIdRef.current !== selectedServerId
    prevSelectedServerIdRef.current = selectedServerId

    if (serverChanged) {
      setServerPermissions(null)
      setBoards([])
      setBoardsLoading(false)
      setCanCreateBoard(false)
      setBoardCapabilities({})
      setBoardModalConfig(null)
      setBoardModalPermissions([])
      setBoardModalLoading(false)
      setBoardModalSaving(false)
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
    }

    void loadServerPermissions(selectedServerId, { silent: !serverChanged })
    void loadServerBoards(selectedServerId, { silent: !serverChanged })
  }, [selectedServerId, authToken, me])

  useEffect(() => {
    if (!selectedServerId || !authToken || !me) return

    const disconnect = connectRealtimeChannel({
      token: authToken,
      destination: serverTopic(selectedServerId),
      onEvent: () => {
        scheduleRealtimeServerRefresh(selectedServerId)
      },
      onError: (value) => {
        console.error('Dashboard realtime error:', value)
      },
    })

    return () => {
      if (serverRealtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(serverRealtimeRefreshTimerRef.current)
        serverRealtimeRefreshTimerRef.current = null
      }
      disconnect()
    }
  }, [selectedServerId, authToken, me])

  useEffect(() => {
    dashboardWarmCache = {
      authToken,
      discordToken,
      me,
      manageableGuilds,
      apiServers,
      botServerIds: Array.from(botServerIds),
      selectedServerId,
      serverPermissions,
      boards,
      canCreateBoard,
      boardCapabilities,
      canEditPermissions,
      actorRankWeight,
    }
  }, [
    authToken,
    discordToken,
    me,
    manageableGuilds,
    apiServers,
    botServerIds,
    selectedServerId,
    serverPermissions,
    boards,
    canCreateBoard,
    boardCapabilities,
    canEditPermissions,
    actorRankWeight,
  ])

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

  async function loadGuilds(token: string, options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setLoading(true)
      setMessage('')
    }

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
      if (!options.silent) {
        setLoading(false)
      }
    }
  }

  async function loadServerPermissions(serverId: string, options: { silent?: boolean } = {}) {
    if (!authToken || !me) return
    if (!options.silent) {
      setPermissionsLoading(true)
    }
    try {
      const apiServer = apiServers.find((s) => String(s.serverId) === serverId)
      const isOwner = apiServer?.ownerId && String(apiServer.ownerId) === String(me.userId)
      
      if (isOwner) {
        setCanEditPermissions(true)
        setActorRankWeight(1000)
      } else {
        const decisionMap = await evaluatePermissions(authToken, serverId, me.userId, [
          'MANAGE_SERVER_PERMISSIONS',
          ...ACTOR_RANK_PROBES.map((probe) => probe.key),
        ])
        const decision = decisionMap.MANAGE_SERVER_PERMISSIONS ?? { allowed: false }
        setCanEditPermissions(decision.allowed)

        const rankDecisions = ACTOR_RANK_PROBES.map((probe) =>
          decisionMap[probe.key]?.allowed ? probe.weight : 0,
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
      if (!options.silent) {
        setPermissionsLoading(false)
      }
    }
  }

  async function loadServerBoards(serverId: string, options: { silent?: boolean } = {}) {
    if (!authToken || !me) return

    if (!options.silent) {
      setBoardsLoading(true)
    }
    try {
      const boardEntries = await fetchBoards(authToken, serverId, me.userId)
      setBoards(boardEntries)

      const capabilityEntries = await Promise.all(
        boardEntries.map(async (board) => {
          const boardId = String(board.boardId)
          const decisionMap = await evaluatePermissions(authToken, serverId, me.userId, [
            'EDIT_BOARD_DETAILS',
            'EDIT_BOARD_PERMISSIONS',
            'ARCHIVE_BOARD',
            'DELETE_BOARD',
          ], boardId)
          return [
            boardId,
            {
              canEditDetails: decisionMap.EDIT_BOARD_DETAILS?.allowed ?? false,
              canEditPermissions: decisionMap.EDIT_BOARD_PERMISSIONS?.allowed ?? false,
              canArchive: decisionMap.ARCHIVE_BOARD?.allowed ?? false,
              canDelete: decisionMap.DELETE_BOARD?.allowed ?? false,
            },
          ] as const
        }),
      )

      const createDecisionMap = await evaluatePermissions(authToken, serverId, me.userId, ['CREATE_BOARD'])
      setCanCreateBoard(createDecisionMap.CREATE_BOARD?.allowed ?? false)

      setBoardCapabilities(Object.fromEntries(capabilityEntries))
    } catch (error) {
      console.error('Failed to load boards:', error)
      setBoards([])
      setBoardCapabilities({})
      setCanCreateBoard(false)
    } finally {
      if (!options.silent) {
        setBoardsLoading(false)
      }
    }
  }

  function scheduleRealtimeServerRefresh(serverId: string) {
    if (!authToken || !me) return

    if (serverRealtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(serverRealtimeRefreshTimerRef.current)
    }

    serverRealtimeRefreshTimerRef.current = window.setTimeout(() => {
      serverRealtimeRefreshTimerRef.current = null
      void loadServerPermissions(serverId, { silent: true })
      void loadServerBoards(serverId, { silent: true })
    }, 150)
  }

  async function reconcileBoardPermissions(
    serverId: string,
    boardId: string,
    desiredPermissions: PermissionEntry[],
  ) {
    if (!authToken || !me) return

    // Boards inherit server rules; only entries that differ from what they inherit are stored.
    // Stored board rules that no longer differ (including legacy copies) are removed.
    const existingPermissions = await fetchScopedPermissions(authToken, serverId, me.userId, 'BOARD', boardId)
    const { toDelete, toToggle, toCreate } = diffBoardPermissions(
      existingPermissions,
      boardPermissionOverrides(desiredPermissions),
    )

    await Promise.all([
      ...toDelete.map((permission) => deletePermission(authToken, serverId, me.userId, permission.id)),
      ...toToggle.map((permission) =>
        updatePermissionState(authToken, serverId, me.userId, permission.permissionId, permission.newState),
      ),
      ...toCreate.map((permission) =>
        createPermission(authToken, serverId, me.userId, {
          scopeType: 'BOARD',
          scopeId: boardId,
          subjectType: permission.subjectType,
          subjectId: permission.subjectId,
          kanbanPermissionId: permission.kanbanPermissionId,
          state: permission.state,
          priority: permission.priority,
          isImmutable: false,
        }),
      ),
    ])
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

  async function openCreateBoardModal() {
    if (!selectedServerId || !authToken || !me) return

    try {
      const [resolvedServerPermissions] = await Promise.all([
        serverPermissions
          ? Promise.resolve(serverPermissions)
          : fetchServerPermissions(authToken, selectedServerId, me.userId).then((permissions) => {
              setServerPermissions(permissions)
              return permissions
            }),
        ensureCatalogForServer(selectedServerId),
        serverRoles.length === 0
          ? fetchServerRoles(authToken, selectedServerId, me.userId).then(setServerRoles)
          : Promise.resolve(),
        serverMembers.length === 0
          ? fetchServerMembers(authToken, selectedServerId, me.userId).then(setServerMembers)
          : Promise.resolve(),
      ])
      setBoardModalPermissions(buildInheritedBoardPermissionDrafts(resolvedServerPermissions))
      setBoardModalConfig({
        mode: 'create',
        board: null,
        canEditDetails: true,
        canEditPermissions: true,
        canArchive: false,
        canDelete: false,
      })
    } catch (error) {
      setError(`Failed to prepare board creation: ${error}`)
    }
  }

  async function openBoardSettingsModal(board: BoardEntry) {
    if (!authToken || !me || !selectedServerId) return

    const capabilities = boardCapabilities[String(board.boardId)]
    if (
      !capabilities ||
      (!capabilities.canEditDetails &&
        !capabilities.canEditPermissions &&
        !capabilities.canArchive &&
        !capabilities.canDelete)
    ) {
      return
    }

    setBoardModalLoading(true)
    setBoardModalConfig({
      mode: 'edit',
      board,
      canEditDetails: capabilities.canEditDetails,
      canEditPermissions: capabilities.canEditPermissions,
      canArchive: capabilities.canArchive,
      canDelete: capabilities.canDelete,
    })

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

      if (capabilities.canEditPermissions || board.isArchived) {
        try {
          const [resolvedServerPermissions, boardPermissions] = await Promise.all([
            serverPermissions
              ? Promise.resolve(serverPermissions)
              : fetchServerPermissions(authToken, selectedServerId, me.userId),
            fetchScopedPermissions(authToken, selectedServerId, me.userId, 'BOARD', String(board.boardId)),
          ])
          setBoardModalPermissions(mergeBoardPermissionDrafts(resolvedServerPermissions, boardPermissions))
        } catch {
          setBoardModalPermissions([])
        }
      } else {
        setBoardModalPermissions([])
      }
    } catch (error) {
      setError(`Failed to load board configuration: ${error}`)
      setBoardModalConfig(null)
    } finally {
      setBoardModalLoading(false)
    }
  }

  async function handleSaveBoardModal(payload: {
    name: string
    description: string
    permissions: PermissionEntry[]
    columnNames: string[]
  }) {
    if (!authToken || !me || !selectedServerId || !boardModalConfig) return

    if (boardModalConfig.canEditDetails && !payload.name.trim()) {
      setError('Board name is required')
      return
    }

    setBoardModalSaving(true)
    try {
      if (boardModalConfig.mode === 'create') {
        const created = await createBoard(authToken, selectedServerId, me.userId, {
          name: payload.name,
          description: payload.description,
          createdBy: me.userId,
          columnNames: payload.columnNames,
        })
        await reconcileBoardPermissions(selectedServerId, String(created.boardId), payload.permissions)
        showToast('Board created', 'success')
      } else if (boardModalConfig.board) {
        const boardId = String(boardModalConfig.board.boardId)
        if (boardModalConfig.canEditDetails) {
          await updateBoard(authToken, selectedServerId, me.userId, boardId, {
            name: payload.name,
            description: payload.description,
            createdBy: boardModalConfig.board.createdBy,
          })
        }
        if (boardModalConfig.canEditPermissions) {
          await reconcileBoardPermissions(selectedServerId, boardId, payload.permissions)
        }
        showToast('Board updated', 'success')
      }

      await Promise.all([loadServerBoards(selectedServerId), loadServerPermissions(selectedServerId)])
      setBoardModalConfig(null)
      setBoardModalPermissions([])
    } catch (error) {
      setError(`Failed to save board: ${error}`)
    } finally {
      setBoardModalSaving(false)
    }
  }

  async function handleArchiveBoardModalAction(archived: boolean) {
    if (!authToken || !me || !selectedServerId || !boardModalConfig?.board) return

    setBoardModalSaving(true)
    try {
      await archiveBoard(
        authToken,
        selectedServerId,
        me.userId,
        String(boardModalConfig.board.boardId),
        archived,
      )
      await loadServerBoards(selectedServerId)
      setBoardModalConfig(null)
      setBoardModalPermissions([])
      showToast(archived ? 'Board archived' : 'Board restored', 'success')
    } catch (error) {
      setError(`Failed to ${archived ? 'archive' : 'restore'} board: ${error}`)
    } finally {
      setBoardModalSaving(false)
    }
  }

  async function handleDeleteBoardModalAction() {
    if (!authToken || !me || !selectedServerId || !boardModalConfig?.board) return

    setBoardModalSaving(true)
    try {
      await deleteBoard(authToken, selectedServerId, me.userId, String(boardModalConfig.board.boardId))
      await loadServerBoards(selectedServerId)
      setBoardModalConfig(null)
      setBoardModalPermissions([])
      showToast('Board deleted', 'success')
    } catch (error) {
      setError(`Failed to delete board: ${error}`)
    } finally {
      setBoardModalSaving(false)
    }
  }

  function openBoardPage(board: BoardEntry) {
    if (!selectedServerId) {
      return
    }
    navigate(`/boards/${board.boardId}?serverId=${encodeURIComponent(selectedServerId)}`)
  }

  function onLogout() {
    dashboardWarmCache = null
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
    setBoards([])
    setCanCreateBoard(false)
    setBoardCapabilities({})
    setBoardModalConfig(null)
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
    const q = deferredModalSearch.toLowerCase()
    const available = serverMembers.filter((m) => !existingSubjectIds.USER.has(m.userId))
    const filtered = !q ? available : available.filter((m) => {
      const display = m.displayName ?? m.nickname ?? `User #${m.userId}`
      return (
        display.toLowerCase().includes(q) ||
        (m.username?.toLowerCase().includes(q) ?? false) ||
        m.userId.includes(q)
      )
    })
    return filtered.slice(0, 50)
  }, [deferredModalSearch, serverMembers, existingSubjectIds])

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
        onBrandClick={() => {
          navigate('/')
        }}
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
            boards={boards}
            boardsLoading={boardsLoading}
            canCreateBoard={canCreateBoard}
            boardCapabilities={boardCapabilities}
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
            onOpenCreateBoard={() => {
              void openCreateBoardModal()
            }}
            onOpenBoard={openBoardPage}
            onOpenBoardSettings={(board) => {
              void openBoardSettingsModal(board)
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

      <BoardModal
        show={boardModalConfig !== null}
        mode={boardModalConfig?.mode ?? 'create'}
        board={boardModalConfig?.board ?? null}
        initialName={boardModalConfig?.board?.name ?? ''}
        initialDescription={boardModalConfig?.board?.description ?? ''}
        initialPermissions={boardModalPermissions}
        catalogEntries={catalogEntries}
        serverRoles={serverRoles}
        serverMembers={serverMembers}
        actorRankWeight={actorRankWeight}
        canEditDetails={boardModalConfig?.canEditDetails ?? false}
        canEditPermissions={boardModalConfig?.canEditPermissions ?? false}
        canArchive={boardModalConfig?.canArchive ?? false}
        canDelete={boardModalConfig?.canDelete ?? false}
        loading={boardModalLoading}
        saving={boardModalSaving}
        onClose={() => {
          if (!boardModalSaving) {
            setBoardModalConfig(null)
            setBoardModalPermissions([])
          }
        }}
        onSave={(payload) => {
          void handleSaveBoardModal(payload)
        }}
        onArchive={(archived) => {
          void handleArchiveBoardModalAction(archived)
        }}
        onDelete={() => {
          void handleDeleteBoardModalAction()
        }}
      />
    </div>
  )
}
