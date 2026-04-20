export type AuthResponse = {
  accessToken: string
  tokenType?: string
  expiresInSeconds?: number
  discordAccessToken?: string
  user?: {
    userId: string
    username: string
    globalName?: string
    avatarUrl?: string
  }
}

export type MeResponse = {
  userId: string
  username: string
  globalName?: string
  avatarUrl?: string
}

export type DiscordGuild = {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string
}
