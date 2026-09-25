/** A signed-in session's access token, as returned when signing in or refreshing. */
export type AuthResponse = {
  accessToken: string
  tokenType: string
  /** Seconds until the access token expires. */
  expiresIn: number
  sessionId: string
  user: MeResponse
}

export type MeResponse = {
  userId: string
  username: string
  globalName?: string
  avatarUrl?: string
  /** Theme, accessibility and simple view settings; interpreted by features/preferences. */
  preferences?: Record<string, unknown> | null
}

export type DiscordGuild = {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string
}
