export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
export const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID ?? ''
export const DISCORD_REDIRECT_URI = import.meta.env.VITE_DISCORD_REDIRECT_URI ?? window.location.origin
export const DISCORD_SCOPES = import.meta.env.VITE_DISCORD_SCOPES ?? 'identify guilds'

export const TOKEN_STORAGE_KEY = 'kanbancord_access_token'
export const DISCORD_TOKEN_STORAGE_KEY = 'kanbancord_discord_access_token'
export const OAUTH_STATE_KEY = 'kanbancord_discord_oauth_state'
export const OAUTH_IN_PROGRESS_KEY = 'kanbancord_discord_oauth_in_progress'
