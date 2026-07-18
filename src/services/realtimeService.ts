import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { apiUrl, parseError } from '../api/http'
import { API_BASE_URL } from '../config/env'

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

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

type RealtimeConnectionOptions = {
  token: string
  destination: string
  onEvent: (event: RealtimeEvent) => void
  onSession?: (session: RealtimeSessionInfo) => void
  onError?: (message: string) => void
}

async function createRealtimeTicket(token: string): Promise<RealtimeTicketResponse> {
  const response = await fetch(apiUrl('/api/realtime/tickets'), {
    method: 'POST',
    headers: authHeaders(token),
  })

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

  const client = new Client({
    reconnectDelay: 5000,
    heartbeatIncoming: 20000,
    heartbeatOutgoing: 20000,
  })

  client.beforeConnect = async () => {
    const ticket = await createRealtimeTicket(options.token)
    client.brokerURL = `${resolveWebSocketUrl(ticket.websocketPath)}?ticket=${encodeURIComponent(ticket.ticket)}`
  }

  client.onConnect = () => {
    sessionSubscription = client.subscribe('/user/queue/session', (message) => {
      const payload = parseFrameBody<RealtimeSessionInfo>(message)
      if (payload) {
        options.onSession?.(payload)
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

  client.activate()

  return () => {
    eventSubscription?.unsubscribe()
    sessionSubscription?.unsubscribe()
    void client.deactivate()
  }
}