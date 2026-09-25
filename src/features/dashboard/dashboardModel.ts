import { DISCORD_CLIENT_ID } from '../../config/env'
import { NO_FEATURES, type ServerFeatures } from '../../services/featuresService'
import type { ServerAccess } from '../../services/permissionsService'
import type { DiscordGuild } from '../../types/auth'
import type { ApiServer, BoardCapability, MergedServer } from '../../components/dashboard/types'

/** The link that adds the bot to a server: that server, or one Discord asks you to pick. */
export function buildBotInviteLink(guildId?: string): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    permissions: '412854119488',
    scope: 'bot applications.commands',
  })
  if (guildId) params.set('guild_id', guildId)
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

/** Ids of the servers the bot is in. */
export function botServerIds(servers: ApiServer[]): Set<string> {
  return new Set(servers.filter((server) => server.botPresent !== false).map((server) => String(server.serverId)))
}

/** Every manageable guild, those with the bot first; the others carry an invite link. */
export function mergeServers(guilds: DiscordGuild[], botIds: Set<string>): MergedServer[] {
  return guilds
    .map((guild) => ({
      ...guild,
      botPresent: botIds.has(guild.id),
      inviteLink: botIds.has(guild.id) ? undefined : buildBotInviteLink(guild.id),
    }))
    .sort((left, right) => Number(right.botPresent) - Number(left.botPresent))
}

/** The rank the UI uses to decide which permissions the user may hand out (see permissionRank.ts). */
const RANK_PROBES: Array<{ key: string; weight: number }> = [
  { key: 'ADMIN', weight: 1000 },
  { key: 'MANAGE_SERVER_PERMISSIONS', weight: 800 },
  { key: 'CREATE_BOARD', weight: 600 },
  { key: 'CREATE_TASK', weight: 400 },
  { key: 'VIEW_SERVER', weight: 200 },
]

export function actorRankWeight(access: ServerAccess | undefined): number {
  return Math.max(200, ...RANK_PROBES.filter((probe) => access?.server[probe.key]).map((probe) => probe.weight))
}

/** What the user may change on each board, leaving out features the server has switched off. */
export function boardCapabilities(
  access: ServerAccess | undefined,
  features: ServerFeatures = NO_FEATURES,
): Record<string, BoardCapability> {
  return Object.fromEntries(
    Object.entries(access?.boards ?? {}).map(([boardId, keys]) => [
      boardId,
      {
        canEditDetails: Boolean(keys.EDIT_BOARD_DETAILS),
        canEditPermissions: features.PERMISSIONS && Boolean(keys.EDIT_BOARD_PERMISSIONS),
        canArchive: Boolean(keys.ARCHIVE_BOARD),
        canDelete: Boolean(keys.DELETE_BOARD),
        canManageCatalog:
          (features.LABELS && Boolean(keys.CREATE_LABEL || keys.EDIT_LABEL || keys.DELETE_LABEL)) ||
          (features.PRIORITIES && Boolean(keys.MANAGE_PRIORITIES)),
      },
    ]),
  )
}

// ── The selected server survives navigation and reloads within the tab ──────

const SELECTED_SERVER_KEY = 'kanbancord_selected_server'

export function loadSelectedServerId(): string {
  try {
    return sessionStorage.getItem(SELECTED_SERVER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveSelectedServerId(serverId: string) {
  try {
    if (serverId) {
      sessionStorage.setItem(SELECTED_SERVER_KEY, serverId)
    } else {
      sessionStorage.removeItem(SELECTED_SERVER_KEY)
    }
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the selection is then per page load.
  }
}
