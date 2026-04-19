export type AuthResponse = {
  accessToken: string
  tokenType?: string
  expiresInSeconds?: number
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
