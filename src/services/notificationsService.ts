import { parseError } from '../api/http'
import { apiFetch } from '../api/session'
import { tOr } from '../i18n'

/** A category's name in the reader's language; the API's (English) for one this app does not know yet. */
export function categoryLabel(category: Pick<NotificationCategory, 'key' | 'label'>): string {
  return tOr(`notifications.categories.${category.key}`, category.label)
}

/** An event's name in the reader's language; the API's (English) for one this app does not know yet. */
export function eventLabel(event: Pick<NotificationCategory['events'][number], 'key' | 'label'>): string {
  return tOr(`notifications.events.${event.key}`, event.label)
}

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
  /** Whether the bot may start public threads there, and private ones (text channels only). */
  botCanThread?: boolean
  botCanPrivateThread?: boolean
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
  /** By board id: boards with their own settings for this feed, set in their board settings. */
  boardOverrides?: Record<string, BoardOverride>
}

/** Where a board's settings for a feed differ from the feed's; the rest follows the feed. */
export type BoardOverride = {
  events: Record<string, boolean>
  mentions: Record<string, boolean>
  changes: number
}

/** A feed as it concerns one board: its own settings, the board's changes, and where it posts. */
export type BoardFeed = {
  feedId: number
  channelId: string
  channelName: string | null
  everyBoard: boolean
  interactive: boolean
  feedEvents: Record<string, boolean>
  feedMentions: Record<string, boolean>
  own: BoardOverride
}

export type BoardNotifications = {
  feeds: BoardFeed[]
  catalogue: NotificationCategory[]
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

/** The feeds that post about a board, with the board's own settings for each. */
export async function fetchBoardNotifications(serverId: string, boardId: string): Promise<BoardNotifications> {
  return json<BoardNotifications>(await apiFetch(`/api/servers/${serverId}/boards/${boardId}/notifications`))
}

/** Changes the board's settings for one feed; a value equal to the feed's goes back to following it. */
export async function updateBoardFeed(
  serverId: string,
  boardId: string,
  feedId: number,
  changes: { events?: Record<string, boolean>; mentions?: Record<string, boolean> },
): Promise<BoardNotifications> {
  return json<BoardNotifications>(
    await send(`/api/servers/${serverId}/boards/${boardId}/notifications/feeds/${feedId}`, 'PUT', changes),
  )
}

/** The board follows the feed's settings again. */
export async function resetBoardFeed(serverId: string, boardId: string, feedId: number): Promise<BoardNotifications> {
  return json<BoardNotifications>(
    await send(`/api/servers/${serverId}/boards/${boardId}/notifications/feeds/${feedId}`, 'DELETE'),
  )
}

/** Where a task's updates go once it has a thread. */
export type ThreadUpdates = 'BOTH' | 'THREAD' | 'CHANNEL'

/**
 * A thread per task for one board. `enabled`: switched on; `active`: and working (a feed for the board
 * still posts in the chosen channel). `channels`: the board's feed channels, where threads can go.
 */
export type BoardThreads = {
  enabled: boolean
  active: boolean
  channelId: string | null
  privateThreads: boolean
  updates: ThreadUpdates
  channels: { channelId: string; name: string; botCanThread: boolean; botCanPrivateThread: boolean }[]
}

export async function fetchBoardThreads(serverId: string, boardId: string): Promise<BoardThreads> {
  return json<BoardThreads>(await apiFetch(`/api/servers/${serverId}/boards/${boardId}/threads`))
}

/** Switches threads on for the board, or changes how. */
export async function saveBoardThreads(
  serverId: string,
  boardId: string,
  settings: { channelId: string; privateThreads: boolean; updates: ThreadUpdates },
): Promise<BoardThreads> {
  return json<BoardThreads>(await send(`/api/servers/${serverId}/boards/${boardId}/threads`, 'PUT', settings))
}

export async function disableBoardThreads(serverId: string, boardId: string): Promise<BoardThreads> {
  return json<BoardThreads>(await send(`/api/servers/${serverId}/boards/${boardId}/threads`, 'DELETE'))
}
