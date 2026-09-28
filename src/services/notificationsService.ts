import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

/** Every event that can be announced, grouped as the API defines them. */
export type NotificationCategory = {
  key: string
  label: string
  mentionByDefault: boolean
  events: {
    key: string
    label: string
    feedDefault: boolean
    canDm: boolean
    dmDefault: boolean
    /** Whether the event concerns a task, so there are people to mention. */
    canMention: boolean
    mentionDefault: boolean
  }[]
}

export type DiscordChannel = {
  channelId: string
  name: string
  category: string | null
  position: number
  botCanPost: boolean
}

/** An update feed; no boards means every board in the server. */
export type NotificationFeed = {
  feedId: number
  channelId: string
  boardIds: number[]
  events: Record<string, boolean>
  /** Per event: whether posting it mentions the people involved. A category key sets all its events. */
  mentions: Record<string, boolean>
  mentionRoles: boolean
  /** Posts show the whole task, with buttons to change it right there in Discord. */
  interactive: boolean
}

export type ServerNotifications = {
  auditChannelId: string | null
  feeds: NotificationFeed[]
  channels: DiscordChannel[]
  catalogue: NotificationCategory[]
}

export type FeedChanges = Partial<Omit<NotificationFeed, 'feedId'>>

export type DmMode = 'UNLESS_PINGED' | 'ALWAYS' | 'NEVER'
export type ServerMode = 'DEFAULT' | 'ASSIGNMENTS' | 'NONE'

export type MyNotifications = {
  dmMode: DmMode
  events: Record<string, boolean>
  includeCommented: boolean
  /** Also tasks you follow; on unless switched off. */
  includeFollowed: boolean
  /** Per server id; servers not listed use DEFAULT. */
  servers: Record<string, ServerMode>
  catalogue: NotificationCategory[]
}

export type MyNotificationChanges = Partial<Omit<MyNotifications, 'catalogue'>>

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<T>
}

function send(path: string, method: string, body?: unknown) {
  return apiFetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function fetchServerNotifications(serverId: string): Promise<ServerNotifications> {
  return json(await apiFetch(`/api/servers/${serverId}/notifications`))
}

export async function setAuditChannel(serverId: string, channelId: string | null): Promise<ServerNotifications> {
  return json(await send(`/api/servers/${serverId}/notifications/audit-channel`, 'PUT', { channelId }))
}

export async function createFeed(serverId: string, feed: FeedChanges): Promise<NotificationFeed> {
  return json(await send(`/api/servers/${serverId}/notifications/feeds`, 'POST', feed))
}

/** Changes only what is given; everything else about the feed stays. */
export async function updateFeed(serverId: string, feedId: number, changes: FeedChanges): Promise<NotificationFeed> {
  return json(await send(`/api/servers/${serverId}/notifications/feeds/${feedId}`, 'PUT', changes))
}

export async function deleteFeed(serverId: string, feedId: number): Promise<void> {
  const response = await send(`/api/servers/${serverId}/notifications/feeds/${feedId}`, 'DELETE')
  if (!response.ok) throw new Error(await parseError(response))
}

export async function fetchMyNotifications(): Promise<MyNotifications> {
  return json(await apiFetch('/api/me/notifications'))
}

/** Changes only what is given: `{ events: { TASK_DUE: false } }` leaves every other setting alone. */
export async function updateMyNotifications(changes: MyNotificationChanges): Promise<MyNotifications> {
  return json(await send('/api/me/notifications', 'PUT', changes))
}
