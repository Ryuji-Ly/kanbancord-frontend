import type { DiscordGuild, MeResponse } from '../../types/auth'
import type { BoardEntry } from '../../services/boardsService'
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

export type BoardCapability = {
  canEditDetails: boolean
  canEditPermissions: boolean
  canArchive: boolean
  canDelete: boolean
}

export type BoardModalConfig = {
  mode: 'create' | 'edit'
  board: BoardEntry | null
  canEditDetails: boolean
  canEditPermissions: boolean
  canArchive: boolean
  canDelete: boolean
}

export type HeaderUser = MeResponse | null
