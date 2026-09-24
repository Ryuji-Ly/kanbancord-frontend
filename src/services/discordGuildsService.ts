import { parseError } from '../api/http'
import { apiFetch } from '../api/session'
import type { DiscordGuild } from '../types/auth'

// Permission bits
const ADMINISTRATOR = BigInt(0x8)
const MANAGE_GUILD = BigInt(0x20)

function canManageServer(permissions: string): boolean {
  const bits = BigInt(permissions)
  return (bits & ADMINISTRATOR) !== 0n || (bits & MANAGE_GUILD) !== 0n
}

/** The user's Discord servers. The API fetches them with the Discord token it keeps for the user. */
export async function fetchUserGuilds(): Promise<DiscordGuild[]> {
  const response = await apiFetch('/api/me/guilds')
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<DiscordGuild[]>
}

export function filterManageableGuilds(guilds: DiscordGuild[]): DiscordGuild[] {
  return guilds.filter((g) => canManageServer(g.permissions))
}

export function guildIconUrl(guild: DiscordGuild): string | null {
  if (!guild.icon) return null
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
}
