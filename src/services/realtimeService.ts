import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { parseError } from '../api/http'
import { apiFetch, onSessionChange, refreshSession, SignedOutError } from '../api/session'
import { API_BASE_URL } from '../config/env'

type RealtimeTicketResponse = {
  ticket: string
  expiresAt: string
  websocketPath: string
}

/** A change announced on a server or board topic. */
export type RealtimeEvent = {
  eventId: string
  eventType: string
  /** What changed: BOARD, BOARD_COLUMN, TASK, LABEL, PERMISSION, ROLE, MEMBER, SERVER, ... */
  entityType: string
  scopeType: string
  serverId: number
  boardId: number | null
  entityId: number | null
  actorUserId: number | null
  occurredAt: string
  payload?: unknown
}

/** A change that concerns the signed-in user only, sent on their own queue. */
export type UserRealtimeEvent = {
  eventType: 'PROFILE_UPDATED' | 'NOTIFICATIONS_CHANGED' | 'SESSIONS_CHANGED'
  occurredAt: string
  payload?: unknown
}

/** The server ended a subscription: the user lost access to it, or its board was deleted. */
export type RealtimeRevocation = {
  type: 'SUBSCRIPTION_REVOKED'
  reason: 'ACCESS_LOST' | 'BOARD_DELETED'
  destination: string
  serverId: number
  boardId: number | null
}

export type RealtimeHandlers<T> = {
  onEvent: (event: T) => void
  /** The server ended this subscription; no more events will arrive on it. */
  onRevoked?: (revocation: RealtimeRevocation) => void
}

export function serverTopic(serverId: string): string {
  return `/topic/servers/${serverId}`
}

export function boardTopic(serverId: string, boardId: string): string {
  return `/topic/servers/${serverId}/boards/${boardId}`
}

/** Changes that concern the signed-in user only: profile, notifications, sessions. */
export const USER_QUEUE = '/user/queue/me'
const SESSION_QUEUE = '/user/queue/session'

/** Close code the API uses when the sign-in session behind a connection is revoked. */
const SESSION_REVOKED_CLOSE_CODE = 4401
const TICKET_RETRY_MS = 5000
/** Keep the socket briefly after the last subscription ends, so moving between pages reuses it. */
const IDLE_DISCONNECT_MS = 10_000

// ── One connection per tab ───────────────────────────────────────────────────
//
// Every page subscribes to the topics it shows on the same WebSocket. Subscriptions are kept here
// and made again after each reconnect, so pages never deal with the connection itself.

type Topic = {
  handlers: Set<RealtimeHandlers<never>>
  subscription: StompSubscription | null
  revoked: boolean
}

const topics = new Map<string, Topic>()
let client: Client | null = null
let retryTimer: number | null = null
let idleTimer: number | null = null

async function createRealtimeTicket(): Promise<RealtimeTicketResponse> {
  const response = await apiFetch('/api/realtime/tickets', { method: 'POST' })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<RealtimeTicketResponse>
}

function resolveWebSocketUrl(path: string): string {
  const configuredBaseUrl = API_BASE_URL.trim()
  const baseUrl = configuredBaseUrl.length > 0
    ? new URL(configuredBaseUrl, window.location.origin)
    : new URL(window.location.origin)

  const protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${baseUrl.host}${path}`
}

function parseFrameBody<T>(message: IMessage): T | null {
  if (!message.body) return null
  try {
    return JSON.parse(message.body) as T
  } catch {
    return null
  }
}

function subscribeOnServer(stomp: Client, destination: string, topic: Topic) {
  topic.subscription = stomp.subscribe(destination, (message) => {
    const payload = parseFrameBody<never>(message)
    if (payload) topic.handlers.forEach((handlers) => handlers.onEvent(payload))
  })
}

function handleRevocation(revocation: RealtimeRevocation) {
  const topic = topics.get(revocation.destination)
  if (!topic) return
  // The server already removed the subscription; do not make it again on reconnect.
  topic.revoked = true
  topic.subscription = null
  topic.handlers.forEach((handlers) => handlers.onRevoked?.(revocation))
}

function createClient(): Client {
  const stomp = new Client({
    reconnectDelay: 5000,
    heartbeatIncoming: 20000,
    heartbeatOutgoing: 20000,
  })

  // Every connection attempt needs a fresh one-time ticket. When none can be had, stop instead of
  // opening a socket that would be refused: for good once signed out, otherwise retry shortly.
  stomp.beforeConnect = async () => {
    try {
      const ticket = await createRealtimeTicket()
      stomp.brokerURL = `${resolveWebSocketUrl(ticket.websocketPath)}?ticket=${encodeURIComponent(ticket.ticket)}`
    } catch (error) {
      await stomp.deactivate()
      if (error instanceof SignedOutError || client !== stomp) return
      console.error('Realtime connection failed:', error)
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        if (client === stomp && topics.size > 0) stomp.activate()
      }, TICKET_RETRY_MS)
    }
  }

  stomp.onConnect = () => {
    stomp.subscribe(SESSION_QUEUE, (message) => {
      const payload = parseFrameBody<{ type?: string }>(message)
      if (payload?.type === 'SUBSCRIPTION_REVOKED') handleRevocation(payload as RealtimeRevocation)
    })
    topics.forEach((topic, destination) => {
      if (!topic.revoked) subscribeOnServer(stomp, destination, topic)
    })
  }

  stomp.onWebSocketClose = (event) => {
    topics.forEach((topic) => {
      topic.subscription = null
    })
    // The session was signed out elsewhere; refreshing confirms it and signs this page out.
    if (event.code === SESSION_REVOKED_CLOSE_CODE) {
      void refreshSession().catch(() => undefined)
    }
  }

  stomp.onStompError = (frame) => {
    console.error('Realtime broker error:', frame.headers.message)
  }

  return stomp
}

function ensureConnected() {
  if (idleTimer !== null) {
    window.clearTimeout(idleTimer)
    idleTimer = null
  }
  client ??= createClient()
  if (!client.active && retryTimer === null) client.activate()
}

function disconnect() {
  if (retryTimer !== null) window.clearTimeout(retryTimer)
  retryTimer = null
  const current = client
  client = null
  topics.forEach((topic) => {
    topic.subscription = null
  })
  void current?.deactivate()
}

/**
 * Listens to a topic or queue until the returned function is called. Several listeners may share a
 * destination; it is subscribed once, on the tab's single connection.
 */
export function subscribeRealtime<T>(destination: string, handlers: RealtimeHandlers<T>): () => void {
  let topic = topics.get(destination)
  if (!topic) {
    topic = { handlers: new Set(), subscription: null, revoked: false }
    topics.set(destination, topic)
    if (client?.connected) subscribeOnServer(client, destination, topic)
  }
  const registered = handlers as RealtimeHandlers<never>
  topic.handlers.add(registered)
  ensureConnected()

  return () => {
    const current = topics.get(destination)
    if (!current) return
    current.handlers.delete(registered)
    if (current.handlers.size > 0) return
    topics.delete(destination)
    if (current.subscription && client?.connected) current.subscription.unsubscribe()
    if (topics.size === 0) {
      idleTimer = window.setTimeout(() => {
        idleTimer = null
        if (topics.size === 0) disconnect()
      }, IDLE_DISCONNECT_MS)
    }
  }
}

// Signing out closes the connection; signing back in reconnects for whatever is still listening.
onSessionChange((state) => {
  if (state.status === 'signedOut') {
    disconnect()
  } else if (state.status === 'signedIn' && topics.size > 0) {
    ensureConnected()
  }
})
