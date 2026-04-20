import type { DiscordGuild } from '../types/auth'

const DISCORD_API = 'https://discord.com/api/v10'

// Permission bits
const ADMINISTRATOR = BigInt(0x8)
const MANAGE_GUILD = BigInt(0x20)

function canManageServer(permissions: string): boolean {
  const bits = BigInt(permissions)
  return (bits & ADMINISTRATOR) !== 0n || (bits & MANAGE_GUILD) !== 0n
}

export async function fetchUserGuilds(discordToken: string): Promise<DiscordGuild[]> {
  const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${discordToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Discord guilds (${response.status})`)
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
