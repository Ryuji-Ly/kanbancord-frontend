import { KANBAN_PERM_INFO } from '../services/permissionsService'
import * as data from './demoData'

/**
 * Demo mode, for screenshots and trying the website without a server: every request to the API is
 * answered from example data in the page itself, and nothing leaves the browser. Only ever included
 * in development (`npm run demo`); production builds do not contain it.
 */

type Handler = (match: RegExpMatchArray, init: { method: string; body: unknown; query: URLSearchParams }) => unknown

const NEVER = Symbol('never')

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status: body === undefined && status === 200 ? 204 : status,
    headers: { 'content-type': 'application/json' },
  })

const me = { userId: data.ME, username: 'alex', globalName: 'Alex', avatarUrl: undefined, preferences: {} }
const allowed = (keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, { allowed: true, sourceTier: 'ROLE', sourceScopeType: 'SERVER' }]))

let features = { ...data.FEATURES }
let openPermissions = false

const EVENTS: [string, string, string, boolean, boolean | null, boolean, boolean][] = [
  // key, category, label, posted by default, DM default (null: never), can mention, mentions by default
  ['TASK_CREATED', 'TASKS', 'Task created', true, false, true, false],
  ['TASK_DELETED', 'TASKS', 'Task deleted', true, true, true, false],
  ['TASK_MOVED', 'TASKS', 'Task moved to another column', true, true, true, true],
  ['TASK_TITLE', 'TASKS', 'Title changed', true, false, true, false],
  ['TASK_DESCRIPTION', 'TASKS', 'Description changed', true, false, true, false],
  ['TASK_DUE', 'TASKS', 'Due date changed', true, true, true, true],
  ['TASK_PRIORITY', 'TASKS', 'Priority changed', true, false, true, false],
  ['DUE_SOON', 'TASKS', 'Due within a day (reminder)', false, true, true, true],
  ['OVERDUE', 'TASKS', 'Overdue (reminder)', false, true, true, true],
  ['USER_ASSIGNED', 'PEOPLE', 'Someone assigned', true, true, true, true],
  ['USER_UNASSIGNED', 'PEOPLE', 'Someone unassigned', true, true, true, true],
  ['ROLE_ASSIGNED', 'PEOPLE', 'Role assigned', true, null, true, true],
  ['ROLE_UNASSIGNED', 'PEOPLE', 'Role unassigned', true, null, true, true],
  ['COMMENT_CREATED', 'COMMENTS', 'New comment', true, true, true, false],
  ['COMMENT_EDITED', 'COMMENTS', 'Comment edited', false, false, true, false],
  ['COMMENT_DELETED', 'COMMENTS', 'Comment deleted', false, false, true, false],
  ['LABEL_ADDED', 'LABELS', 'Label added to a task', true, false, true, false],
  ['LABEL_REMOVED', 'LABELS', 'Label removed from a task', true, false, true, false],
  ['COLUMN_CHANGED', 'BOARD', 'Columns created, renamed, moved or deleted', true, null, false, false],
  ['BOARD_CHANGED', 'BOARD', 'Board created, renamed, archived or deleted', true, null, false, false],
  ['BOARD_SETTINGS_CHANGED', 'BOARD', 'Labels, priority levels and board features changed', false, null, false, false],
]
const CATEGORIES: [string, string][] = [
  ['TASKS', 'Tasks'], ['PEOPLE', 'People'], ['COMMENTS', 'Comments'], ['LABELS', 'Labels'], ['BOARD', 'Board structure'],
]
const catalogue = CATEGORIES.map(([key, label]) => ({
  key,
  label,
  mentionByDefault: key === 'PEOPLE',
  events: EVENTS.filter((event) => event[1] === key).map(([eventKey, , eventLabel, feed, dm, canMention, mention]) => ({
    key: eventKey,
    label: eventLabel,
    feedDefault: feed,
    canDm: dm !== null,
    dmDefault: Boolean(dm),
    canMention,
    mentionDefault: mention,
  })),
}))
const flags = (pick: (event: (typeof EVENTS)[number]) => boolean) =>
  Object.fromEntries(EVENTS.map((event) => [event[0], pick(event)]))

let feeds = [
  {
    feedId: 1,
    channelId: data.CHANNELS[3].channelId,
    boardIds: [1],
    events: flags((event) => event[3] || event[0] === 'DUE_SOON'),
    mentions: flags((event) => event[6] || event[0] === 'COMMENT_CREATED'),
    mentionRoles: false,
    interactive: true,
  },
]

function snapshot(boardId: number) {
  const board = data.BOARDS.find((entry) => entry.boardId === boardId)
  if (!board) return null
  const main = boardId === 1
  const columns = main
    ? data.COLUMNS
    : ['To Do', 'In Progress', 'Done'].map((name, index) => ({ ...data.COLUMNS[index], columnId: boardId * 100 + index, boardId, name }))
  return {
    board,
    columns,
    tasks: main ? data.TASKS : [],
    assignments: main ? data.ASSIGNMENTS : [],
    roleAssignments: main ? data.ROLE_ASSIGNMENTS : [],
    labels: main ? data.LABELS : [],
    taskLabels: main ? data.TASK_LABELS : [],
    priorities: data.PRIORITIES.map((level) => ({ ...level, boardId })),
    followedTaskIds: main ? [data.FEATURED_TASK] : [],
    permissions: allowed(data.BOARD_KEYS),
    features,
    serverFeatures: features,
  }
}

const catalog = Object.entries(KANBAN_PERM_INFO).map(([key, info], index) => ({
  permissionId: index + 1,
  key,
  name: info.name,
  description: info.name,
  category: info.category,
}))
const permissionId = (key: string) => catalog.find((entry) => entry.key === key)?.permissionId ?? 0

/** The defaults every server starts with, mapped from Discord permissions, plus one rule of the server's own. */
const TIERS: [string, number, string[]][] = [
  ['8', 10_000, ['ADMIN']],
  ['1024', 100, ['VIEW_SERVER', 'VIEW_BOARD', 'VIEW_TASK']],
  ['2048', 120, ['CREATE_TASK', 'MOVE_TASK', 'CREATE_TASK_COMMENT', 'APPLY_LABEL_TO_TASK', 'REMOVE_LABEL_FROM_TASK', 'ASSIGN_TASK_SELF']],
  ['8192', 130, ['EDIT_TASK', 'DELETE_TASK', 'ARCHIVE_TASK', 'DELETE_TASK_COMMENT', 'ASSIGN_TASK_OTHERS']],
  ['16', 180, ['CREATE_COLUMN', 'EDIT_COLUMN', 'DELETE_COLUMN', 'MOVE_COLUMN', 'EDIT_BOARD_DETAILS', 'ARCHIVE_BOARD',
    'EDIT_BOARD_PERMISSIONS', 'CREATE_LABEL', 'EDIT_LABEL', 'DELETE_LABEL', 'MANAGE_PRIORITIES', 'VIEW_AUDIT_LOG']],
  ['32', 200, ['MANAGE_SERVER_PERMISSIONS', 'CREATE_BOARD', 'DELETE_BOARD']],
]
const serverRules = [
  ...TIERS.flatMap(([bit, priority, keys]) => keys.map((key) => ({ subjectType: 'DISCORD_PERMISSION', subjectId: bit, key, priority }))),
  { subjectType: 'ROLE', subjectId: data.ROLES[3].roleId, key: 'ASSIGN_TASK_OTHERS', priority: 150 },
  { subjectType: 'ROLE', subjectId: data.ROLES[3].roleId, key: 'EDIT_TASK', priority: 150 },
].map((rule, index) => ({
  id: index + 1,
  scopeType: 'SERVER',
  scopeId: data.SERVER_ID,
  subjectType: rule.subjectType,
  subjectId: rule.subjectId,
  kanbanPermissionId: permissionId(rule.key),
  kanbanPermissionKey: rule.key,
  state: 'ALLOW',
  priority: rule.priority,
  isImmutable: rule.key === 'ADMIN',
}))

const members = data.PEOPLE.map((person, index) => ({
  id: index + 1,
  serverId: data.SERVER_ID,
  ...person,
  avatarUrl: null,
  joinedAt: data.at(-200),
}))

const ROUTES: [string, RegExp, Handler][] = [
  ['POST', /^\/api\/auth\/refresh$/, () => ({ accessToken: 'demo', tokenType: 'Bearer', expiresIn: 86_400, sessionId: 'demo', user: me })],
  ['POST', /^\/api\/auth\/logout$/, () => undefined],
  ['GET', /^\/api\/me$/, () => me],
  ['GET', /^\/api\/me\/guilds$/, () => [{ id: data.SERVER_ID, name: 'Pixel Forge', icon: null, owner: true, permissions: '8' }]],
  ['GET', /^\/api\/me\/servers$/, () => [{ serverId: data.SERVER_ID, name: 'Pixel Forge', botPresent: true, ownerId: data.ME }]],
  ['GET', /^\/api\/me\/preferences$/, () => ({})],
  ['PATCH', /^\/api\/me\/preferences$/, (_m, { body }) => body ?? {}],
  ['GET', /^\/api\/me\/sessions$/, () => []],
  ['GET', /^\/api\/me\/notifications$/, () => ({
    dmMode: 'UNLESS_PINGED',
    events: flags((event) => Boolean(event[4])),
    includeCommented: false,
    includeFollowed: true,
    servers: {},
    catalogue,
  })],
  ['POST', /^\/api\/realtime\/tickets$/, () => NEVER],
  ['GET', /^\/api\/servers\/\d+\/features$/, () => features],
  ['GET', /^\/api\/servers\/\d+\/features\/open-permissions$/, () => ({ enabled: openPermissions })],
  ['PUT', /^\/api\/servers\/\d+\/features\/open-permissions$/, (_m, { body }) =>
    ({ enabled: (openPermissions = Boolean((body as { enabled: boolean }).enabled)) })],
  ['PUT', /^\/api\/servers\/\d+\/features$/, (_m, { body }) => (features = { ...features, ...(body as object) })],
  ['GET', /^\/api\/servers\/\d+\/permissions\/mine$/, () => ({
    server: Object.fromEntries(data.SERVER_KEYS.map((key) => [key, true])),
    boards: Object.fromEntries(data.BOARDS.map((board) => [board.boardId, Object.fromEntries(data.BOARD_KEYS.map((key) => [key, true]))])),
  })],
  ['GET', /^\/api\/servers\/\d+\/permissions\/catalog$/, () => catalog],
  ['GET', /^\/api\/servers\/\d+\/permissions$/, (_m, { query }) => (query.get('scopeType') === 'BOARD' ? [] : serverRules)],
  ['GET', /^\/api\/servers\/\d+\/roles$/, () => data.ROLES.map((role) => ({ ...role, serverId: data.SERVER_ID }))],
  ['GET', /^\/api\/servers\/\d+\/members$/, () => members],
  ['GET', /^\/api\/servers\/\d+\/boards$/, (_m, { query }) => ({
    content: data.BOARDS.filter((board) => query.get('archived') === null || String(board.isArchived) === query.get('archived')),
  })],
  ['GET', /^\/api\/servers\/\d+\/boards\/(\d+)$/, (m) => data.BOARDS.find((board) => board.boardId === Number(m[1]))],
  ['GET', /^\/api\/servers\/\d+\/boards\/(\d+)\/snapshot$/, (m) => snapshot(Number(m[1]))],
  ['GET', /^\/api\/servers\/\d+\/boards\/\d+\/tasks\/(\d+)\/comments$/, (m) =>
    ({ content: Number(m[1]) === data.FEATURED_TASK ? data.COMMENTS : [] })],
  ['GET', /^\/api\/servers\/\d+\/notifications$/, () => ({
    auditChannelId: data.CHANNELS[4].channelId,
    feeds,
    channels: data.CHANNELS,
    catalogue,
  })],
  ['PUT', /^\/api\/servers\/\d+\/notifications\/feeds\/(\d+)$/, (m, { body }) => {
    const changes = body as Record<string, unknown>
    feeds = feeds.map((feed) => feed.feedId !== Number(m[1]) ? feed : {
      ...feed,
      ...changes,
      events: { ...feed.events, ...(changes.events as object) },
      mentions: { ...feed.mentions, ...(changes.mentions as object) },
    })
    return feeds.find((feed) => feed.feedId === Number(m[1]))
  }],
]

function route(method: string, path: string) {
  for (const [routeMethod, pattern, handler] of ROUTES) {
    const match = routeMethod === method ? path.match(pattern) : null
    if (match) return { match, handler }
  }
  return null
}

export function installDemo() {
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init)
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    let body: unknown = null
    if (typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body)
      } catch {
        body = init.body
      }
    }
    const found = route(method, url.pathname)
    if (!found) {
      // Changes succeed without doing anything; reads the demo does not know are reported.
      if (method !== 'GET') return json(body ?? undefined)
      console.warn(`[demo] No example data for GET ${url.pathname}${url.search}`)
      return json({ message: 'Not in the demo' }, 404)
    }
    const result = found.handler(found.match, { method, body, query: url.searchParams })
    if (result === NEVER) return new Promise<Response>(() => {})
    return json(result ?? (method === 'GET' ? null : undefined))
  }
  console.info('[demo] KanbanCord demo mode: example data, nothing leaves the browser')
}
