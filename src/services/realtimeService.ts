import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { parseError } from '../api/http'
import { apiFetch, refreshSession, SignedOutError } from '../api/session'
import { API_BASE_URL } from '../config/env'

type RealtimeTicketResponse = {
  ticket: string
  expiresAt: string
  websocketPath: string
}

export type RealtimeEvent = {
  eventId: string
  eventType: string
  scopeType: string
  serverId: number
  boardId: number | null
  entityType: string
  entityId: number | null
  actorUserId: number | null
  occurredAt: string
  payload?: unknown
}

export type RealtimeSubscriptionInfo = {
  subscriptionId: string
  destination: string
  scopeType: string
  serverId: number | null
  boardId: number | null
  subscribedAt: string
}

export type RealtimeSessionInfo = {
  type: string
  sessionId: string
  userId: number
  connectedAt: string
  lastSeenAt: string
  serverTime: string
  allowedSendDestinations: string[]
  subscriptions: RealtimeSubscriptionInfo[]
}

/** The server ended a subscription: the user lost access to it, or its board was deleted. */
export type RealtimeRevocation = {
  type: 'SUBSCRIPTION_REVOKED'
  reason: 'ACCESS_LOST' | 'BOARD_DELETED'
  destination: string
  serverId: number
  boardId: number | null
}

type RealtimeConnectionOptions = {
  destination: string
  onEvent: (event: RealtimeEvent) => void
  onSession?: (session: RealtimeSessionInfo) => void
  /** The subscription to `destination` was ended by the server; no more events will arrive. */
  onRevoked?: (revocation: RealtimeRevocation) => void
  onError?: (message: string) => void
}

/** Close code the API uses when the sign-in session behind a connection is revoked. */
const SESSION_REVOKED_CLOSE_CODE = 4401
const TICKET_RETRY_MS = 5000

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

export function serverTopic(serverId: string): string {
  return `/topic/servers/${serverId}`
}

export function boardTopic(serverId: string, boardId: string): string {
  return `/topic/servers/${serverId}/boards/${boardId}`
}

export function connectRealtimeChannel(options: RealtimeConnectionOptions): () => void {
  let eventSubscription: StompSubscription | null = null
  let sessionSubscription: StompSubscription | null = null
  let retryTimer: number | null = null
  let disposed = false

  const client = new Client({
    reconnectDelay: 5000,
    heartbeatIncoming: 20000,
    heartbeatOutgoing: 20000,
  })

  // Every connection attempt needs a fresh one-time ticket. When none can be had, stop instead of
  // opening a socket that would be refused: for good once signed out, otherwise retry shortly.
  client.beforeConnect = async () => {
    try {
      const ticket = await createRealtimeTicket()
      client.brokerURL = `${resolveWebSocketUrl(ticket.websocketPath)}?ticket=${encodeURIComponent(ticket.ticket)}`
    } catch (error) {
      await client.deactivate()
      if (error instanceof SignedOutError || disposed) return
      options.onError?.(error instanceof Error ? error.message : 'Realtime connection failed')
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        if (!disposed) client.activate()
      }, TICKET_RETRY_MS)
    }
  }

  client.onConnect = () => {
    sessionSubscription = client.subscribe('/user/queue/session', (message) => {
      const payload = parseFrameBody<RealtimeSessionInfo | RealtimeRevocation>(message)
      if (payload?.type === 'SUBSCRIPTION_REVOKED') {
        const revocation = payload as RealtimeRevocation
        if (revocation.destination === options.destination) {
          options.onRevoked?.(revocation)
        }
      } else if (payload) {
        options.onSession?.(payload as RealtimeSessionInfo)
      }
    })

    eventSubscription = client.subscribe(options.destination, (message) => {
      const payload = parseFrameBody<RealtimeEvent>(message)
      if (payload) {
        options.onEvent(payload)
      }
    })

    client.publish({
      destination: '/app/session/ping',
      body: '{}',
    })
  }

  client.onStompError = (frame) => {
    options.onError?.(frame.headers.message ?? 'Realtime broker error')
  }

  client.onWebSocketError = () => {
    options.onError?.('Realtime connection failed')
  }

  client.onWebSocketClose = (event) => {
    // The session was signed out elsewhere; refreshing confirms it and signs this page out.
    if (event.code === SESSION_REVOKED_CLOSE_CODE) {
      void refreshSession().catch(() => undefined)
    }
  }

  client.activate()

  return () => {
    disposed = true
    if (retryTimer !== null) window.clearTimeout(retryTimer)
    eventSubscription?.unsubscribe()
    sessionSubscription?.unsubscribe()
    void client.deactivate()
  }
}