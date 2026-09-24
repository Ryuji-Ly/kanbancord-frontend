import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { readableError } from '../api/http'
import { fetchMyServers } from '../services/meService'
import { fetchUserGuilds, filterManageableGuilds } from '../services/discordGuildsService'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { ServersGridSection } from '../components/dashboard/ServersGridSection'
import { SidebarServerRail } from '../components/dashboard/SidebarServerRail'
import { ToastStack } from '../components/dashboard/ToastStack'
import type { ApiServer } from '../components/dashboard/types'
import { useToasts } from '../hooks/useToasts'
import {
  botServerIds as toBotServerIds,
  loadSelectedServerId,
  mergeServers,
  saveSelectedServerId,
} from '../features/dashboard/dashboardModel'
import { ServerWorkspace } from '../features/dashboard/ServerWorkspace'
import { useDashboardSession } from '../features/dashboard/useDashboardSession'

/** Discord guild lists change rarely; refresh them every 10 minutes while the dashboard is open. */
const GUILD_REFRESH_MS = 10 * 60_000

export function DashboardPage() {
  const navigate = useNavigate()
  const session = useDashboardSession()
  const { toasts, showToast } = useToasts()
  const [chosenServerId, setChosenServerId] = useState(loadSelectedServerId)

  const userId = session.me ? String(session.me.userId) : ''
  const guildsQuery = useQuery({
    queryKey: ['discord', 'guilds', userId],
    queryFn: async () => filterManageableGuilds(await fetchUserGuilds()),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    refetchInterval: GUILD_REFRESH_MS,
  })
  const myServersQuery = useQuery({
    queryKey: ['me', 'servers', userId],
    queryFn: async () => {
      const servers = await fetchMyServers()
      return Array.isArray(servers) ? (servers as ApiServer[]) : []
    },
    enabled: Boolean(userId),
  })

  const guilds = useMemo(() => guildsQuery.data ?? [], [guildsQuery.data])
  const botIds = useMemo(() => toBotServerIds(myServersQuery.data ?? []), [myServersQuery.data])
  const botServers = useMemo(() => guilds.filter((guild) => botIds.has(guild.id)), [guilds, botIds])
  const mergedServers = useMemo(() => mergeServers(guilds, botIds), [guilds, botIds])

  // The chosen server while it is still one of the user's bot servers, otherwise the first of them.
  const serversLoaded = guildsQuery.isSuccess && myServersQuery.isSuccess
  const selectedServerId = !serversLoaded
    ? chosenServerId
    : botServers.some((server) => server.id === chosenServerId)
      ? chosenServerId
      : (botServers[0]?.id ?? '')
  const selectedServer = botServers.find((server) => server.id === selectedServerId) ?? null

  function selectServer(serverId: string) {
    setChosenServerId(serverId)
    saveSelectedServerId(serverId)
  }

  const loadError = guildsQuery.error ?? myServersQuery.error
  const banner = session.banner ?? (loadError ? { text: readableError(loadError, 'Failed to fetch servers'), type: 'error' as const } : null)
  const loading = session.exchanging || (Boolean(userId) && (guildsQuery.isPending || myServersQuery.isPending))

  return (
    <div className="kc-dashboard-root">
      <DashboardHeader
        isAuthenticated={session.isAuthenticated}
        me={session.me}
        loading={loading}
        onBrandClick={() => navigate('/')}
        onLogout={session.logout}
        onLogin={session.login}
      />

      <div className="kc-dashboard-shell">
        <SidebarServerRail
          isAuthenticated={session.isAuthenticated}
          botServers={botServers}
          selectedServerId={selectedServerId}
          loading={loading}
          onSelectServer={selectServer}
        />

        <main className="kc-content">
          {banner && <p className={`kc-banner${banner.type === 'success' ? ' kc-banner--success' : ''}`}>{banner.text}</p>}

          {!session.isAuthenticated && !session.exchanging && (
            <section className="kc-panel">
              <h2>Welcome</h2>
              <p className="kc-muted">Login with Discord to load your servers and manage KanbanCord boards.</p>
            </section>
          )}

          {session.isAuthenticated && selectedServer && (
            <ServerWorkspace
              key={selectedServer.id}
              serverId={selectedServer.id}
              server={selectedServer}
              showError={(text) => session.showBanner(text, 'error')}
              showToast={showToast}
            />
          )}

          <ServersGridSection
            isAuthenticated={session.isAuthenticated}
            loading={loading}
            mergedServers={mergedServers}
            onServerCardClick={(server) => {
              if (!server.botPresent && server.inviteLink) {
                window.open(server.inviteLink, '_blank')
              } else {
                selectServer(server.id)
              }
            }}
          />
        </main>
      </div>

      <ToastStack toasts={toasts} />
    </div>
  )
}
