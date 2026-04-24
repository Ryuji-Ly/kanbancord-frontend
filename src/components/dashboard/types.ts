import type { DiscordGuild, MeResponse } from '../../types/auth'
import type { PermissionEntry } from '../../services/permissionsService'

export type ApiServer = {
  serverId: string | number
  name: string
  botPresent?: boolean
  ownerId?: string | number
}

export type MergedServer = DiscordGuild & {
  botPresent: boolean
  inviteLink?: string
}

export type ToastMessage = {
  id: number
  text: string
  type: 'success' | 'error'
}

export type DeleteGroupTarget = {
  subjectType: string
  subjectId: string
  subjectDisplay: string
  permissions: PermissionEntry[]
}

export type HeaderUser = MeResponse | null
