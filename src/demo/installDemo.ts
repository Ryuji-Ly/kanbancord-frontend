import { KANBAN_PERM_INFO } from '../services/permissionsService'
import { presetChanges, type PermissionPreset } from '../components/dashboard/permissions/permissionPresets'
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

// Preferences last for the browser session, like an account's, so a cleared language choice can
// be seen coming back from them.
const PREFERENCES_KEY = 'kc.demo.preferences'
function loadDemoPreferences(): Record<string, unknown> {
  try {
    return JSON.parse(sessionStorage.getItem(PREFERENCES_KEY) ?? '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}
const me = { userId: data.ME, username: 'alex', globalName: 'Alex', avatarUrl: undefined, preferences: loadDemoPreferences() }
const allowed = (keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, { allowed: true, sourceTier: 'ROLE', sourceScopeType: 'SERVER' }]))

let features = { ...data.FEATURES }
const dismissedSuggestions = new Set<string>()
// Reminder times: the server's, each board's own and the demo user's own.
let serverReminders: number[] = [1440]
const boardReminders = new Map<string, number[]>()
let myReminders: number[] | null = null
const myBoardReminders = new Map<string, number[]>()
const minutesOf = (body: unknown) => (body as { minutes?: number[] | null }).minutes ?? null
const boardTimes = (boardId: string) => boardReminders.get(boardId) ?? serverReminders
const myTimes = () => ({
  everywhere: myReminders,
  boards: [...myBoardReminders].map(([boardId, minutes]) => ({
    boardId: Number(boardId),
    boardName: data.BOARDS.find((board) => String(board.boardId) === boardId)?.name ?? boardId,
    serverId: data.SERVER_ID,
    serverName: 'Pixel Forge',
    minutes,
  })),
})
const DEMO_SUGGESTIONS = [
  { feature: 'LABELS', signal: 'TAGS', examples: ['[M]', '[US1-T3]', '[S]'], count: 9, scope: 'SERVER', canEnable: true },
  { feature: 'PRIORITIES', signal: 'MARKS', examples: ['[E]', '[D]'], count: 9, scope: 'SERVER', canEnable: true },
  { feature: 'DUE_DATES', signal: 'DATES', examples: ['by Friday', 'Deadline'], count: 4, scope: 'SERVER', canEnable: false },
  { feature: 'ASSIGNEES', signal: 'NAMES', examples: ['@sam', 'Rudra'], count: 5, scope: 'BOARD', canEnable: false },
] as const
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
  ['TASK_ARCHIVED', 'TASKS', 'Task archived or restored', true, false, true, false],
  ['DUE_SOON', 'TASKS', 'Due soon (reminder)', false, true, true, true],
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

/** A rough stand-in for the API's reading of a list: one task per line, headings as columns. */
function demoImportPlan(body: unknown) {
  const text = String((body as { text?: string } | null)?.text ?? '')
  let column = data.COLUMNS[0].name
  const tasks: { title: string; column: string }[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const heading = line.match(/^#{1,6}\s+(.+)$/)
    if (heading) {
      column = heading[1]
      continue
    }
    const done = /^[-*+]\s+\[[xX]]/.test(line)
    const title = line.replace(/^([-*+]|\d+[.)])\s+/, '').replace(/^\[[ xX]]\s*/, '')
    tasks.push({ title, column: done ? data.COLUMNS[data.COLUMNS.length - 1].name : column })
  }
  const names = [...new Set(tasks.map((task) => task.column))]
  return {
    format: 'LIST',
    headers: [],
    fields: [],
    columns: names.map((name) => {
      const existing = data.COLUMNS.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
      return { columnId: existing ? String(existing.columnId) : undefined, name, created: !existing, tasks: tasks.filter((task) => task.column === name).length }
    }),
    tasks,
    notes: [],
  }
}

/** Tasks archived in the demo, which leave the board until restored. */
const archivedTaskIds = new Set<number>()

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
    tasks: main ? data.TASKS.filter((task) => !archivedTaskIds.has(task.taskId)) : [],
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

/** A one-step setup applied to the server's rules, as the API does it. */
function applyServerPreset(body: { preset: PermissionPreset; staffRoleId?: string | null }) {
  const result = { created: 0, changed: 0, removed: 0 }
  for (const change of presetChanges(body.preset, data.SERVER_ID, body.staffRoleId ?? null)) {
    const index = serverRules.findIndex(
      (rule) => rule.subjectType === 'ROLE' && rule.subjectId === change.roleId && rule.kanbanPermissionKey === change.key,
    )
    if (change.state === null) {
      if (index >= 0) {
        serverRules.splice(index, 1)
        result.removed++
      }
    } else if (index >= 0) {
      if (serverRules[index].state !== change.state) {
        serverRules[index] = { ...serverRules[index], state: change.state }
        result.changed++
      }
    } else {
      serverRules.push({
        id: Math.max(0, ...serverRules.map((rule) => rule.id)) + 1,
        scopeType: 'SERVER',
        scopeId: data.SERVER_ID,
        subjectType: 'ROLE',
        subjectId: change.roleId,
        kanbanPermissionId: permissionId(change.key),
        kanbanPermissionKey: change.key,
        state: change.state,
        priority: 100,
        isImmutable: false,
      })
      result.created++
    }
  }
  return result
}

const members = data.PEOPLE.map((person, index) => ({
  id: index + 1,
  serverId: data.SERVER_ID,
  ...person,
  avatarUrl: null,
  joinedAt: data.at(-200),
}))

/** People in the server who never used KanbanCord: not in the member list, only found by searching. */
const discordOnly = [
  { userId: '100000000000000007', username: 'robin.k', displayName: 'Robin', nickname: null },
  { userId: '100000000000000008', username: 'kai', displayName: 'Kai', nickname: 'Kai (QA)' },
].map((person) => ({ id: null, serverId: data.SERVER_ID, ...person, avatarUrl: null, joinedAt: data.at(-90) }))

function searchMembers(query: string) {
  const needle = query.trim().toLowerCase()
  const matches = (person: { username: string; displayName: string; nickname: string | null }) =>
    [person.username, person.displayName, person.nickname ?? ''].some((name) => name.toLowerCase().includes(needle))
  return [...members.filter(matches), ...discordOnly.filter((person) => !members.some((m) => m.userId === person.userId) && matches(person))]
}

/** Boards' own settings for the demo's feed, by board id. */
const boardOverrides: Record<number, { events: Record<string, boolean>; mentions: Record<string, boolean> }> = {}

function boardNotifications(boardId: number) {
  const feed = feeds[0]
  const own = boardOverrides[boardId] ?? { events: {}, mentions: {} }
  const covers = feed.boardIds.length === 0 || feed.boardIds.includes(boardId)
  return {
    feeds: covers
      ? [{
          feedId: feed.feedId,
          channelId: feed.channelId,
          channelName: data.CHANNELS.find((channel) => channel.channelId === feed.channelId)?.name ?? null,
          everyBoard: feed.boardIds.length === 0,
          interactive: feed.interactive,
          feedEvents: feed.events,
          feedMentions: feed.mentions,
          own: { ...own, changes: Object.keys(own.events).length + Object.keys(own.mentions).length },
        }]
      : [],
    catalogue,
  }
}

/** The Discord permissions each demo role gives, and each demo member's roles; Alex owns the server. */
const ROLE_FLAGS: Record<string, string[]> = {
  [data.ROLES[0].roleId]: ['1024', '2048'],
  [data.ROLES[1].roleId]: [],
  [data.ROLES[2].roleId]: ['8192'],
  [data.ROLES[3].roleId]: ['16', '8192'],
}
const MEMBER_ROLES: Record<string, string[]> = {
  [data.PEOPLE[1].userId]: [data.ROLES[3].roleId],
  [data.PEOPLE[2].userId]: [data.ROLES[1].roleId],
  [data.PEOPLE[3].userId]: [data.ROLES[2].roleId],
  [data.PEOPLE[4].userId]: [data.ROLES[1].roleId, data.ROLES[2].roleId],
}
const FLAG_NAMES: Record<string, string> = {
  '8': 'ADMINISTRATOR', '16': 'MANAGE_CHANNELS', '32': 'MANAGE_GUILD', '1024': 'VIEW_CHANNEL', '2048': 'SEND_MESSAGES',
  '8192': 'MANAGE_MESSAGES',
}

/** The server's rules resolved as the API does (server scope only; the demo has no board rules). */
function accessCheck(query: URLSearchParams) {
  const withRoles = query.get('withRoles') === 'true'
  const userId = query.get('userId') ?? (withRoles ? null : data.ME)
  const roleIds = withRoles ? (query.get('roleIds')?.split(',').filter(Boolean) ?? []) : (userId ? MEMBER_ROLES[userId] ?? [] : [])
  const roles = [data.SERVER_ID, ...roleIds]
  const owner = userId === data.ME
  const flags = new Set(roles.flatMap((roleId) => ROLE_FLAGS[roleId] ?? []))
  if (owner) flags.add('8')
  // @everyone is its own layer beneath the other roles, as in the API (and Discord).
  const subjects: Record<string, Set<string>> = {
    DISCORD_PERMISSION: flags,
    EVERYONE: new Set([data.SERVER_ID]),
    ROLE: new Set(roleIds),
    USER: new Set(userId ? [userId] : []),
  }
  const storedType: Record<string, string> = { EVERYONE: 'ROLE' }
  const ref = (rule: (typeof serverRules)[number]) => ({
    ruleId: rule.id,
    scope: 'SERVER',
    subjectType: rule.subjectType,
    subjectId: rule.subjectId,
    subjectName:
      rule.subjectType === 'DISCORD_PERMISSION'
        ? FLAG_NAMES[rule.subjectId] ?? rule.subjectId
        : rule.subjectType === 'ROLE'
          ? data.ROLES.find((role) => role.roleId === rule.subjectId)?.name ?? 'a role'
          : data.PEOPLE.find((person) => person.userId === rule.subjectId)?.displayName ?? 'someone',
    state: rule.state,
    builtIn: false,
  })
  const trace = (key: string) =>
    ['DISCORD_PERMISSION', 'EVERYONE', 'ROLE', 'USER']
      .map((tier) => serverRules.filter((rule) => rule.subjectType === (storedType[tier] ?? tier)
        && rule.kanbanPermissionKey === key && subjects[tier].has(rule.subjectId)))
      .filter((rules) => rules.length > 0)
      .map((rules) => ({ rules, decider: rules.find((rule) => rule.state === 'DENY') ?? rules[0] }))
  const adminLayers = trace('ADMIN')
  const adminRule = adminLayers.length > 0 && adminLayers[adminLayers.length - 1].decider.state === 'ALLOW'
    ? ref(adminLayers[adminLayers.length - 1].decider)
    : null
  const boardId = query.get('boardId')
  const board = data.BOARDS.find((entry) => String(entry.boardId) === boardId)
  return {
    subject: {
      userId,
      name: data.PEOPLE.find((person) => person.userId === userId)?.displayName ?? null,
      member: true,
      owner,
      rolesChanged: Boolean(userId) && withRoles,
      roles: data.ROLES.filter((role) => roles.includes(role.roleId))
        .sort((a, b) => b.position - a.position)
        .map((role) => ({ roleId: role.roleId, name: role.name, color: role.color, everyone: role.roleId === data.SERVER_ID })),
      discordPermissions: [...flags].map((flag) => FLAG_NAMES[flag]),
      administrator: adminRule !== null,
      administratorRule: adminRule,
    },
    customPermissions: features.PERMISSIONS,
    openPermissions,
    boardId: board ? String(board.boardId) : null,
    boardName: board?.name ?? null,
    results: catalog
      .filter((entry) => entry.key !== 'ADMIN' && (!board || data.BOARD_KEYS.includes(entry.key)))
      .map((entry) => {
        const layers = trace(entry.key)
        const matched = layers.flatMap((layer) => layer.rules)
        const base = { key: entry.key, name: entry.name, category: entry.category }
        if (adminRule) return { ...base, allowed: true, reason: 'ADMIN', decidedBy: adminRule, overridden: matched.map(ref) }
        if (layers.length === 0) return { ...base, allowed: false, reason: 'NONE', decidedBy: null, overridden: [] }
        const decider = layers[layers.length - 1].decider
        return {
          ...base,
          allowed: decider.state === 'ALLOW',
          reason: 'RULE',
          decidedBy: ref(decider),
          overridden: matched.filter((rule) => rule !== decider).map(ref),
        }
      }),
  }
}

type ThreadSetting = { channelId: string; privateThreads: boolean; updates: string }
/** Boards' task thread settings, by board id. */
const threadSettings: Record<number, ThreadSetting> = {}

function boardThreads(boardId: number) {
  const feed = feeds[0]
  const covers = feed.boardIds.length === 0 || feed.boardIds.includes(boardId)
  const channels = covers
    ? data.CHANNELS.filter((channel) => channel.channelId === feed.channelId).map((channel) => ({
        channelId: channel.channelId,
        name: channel.name,
        botCanThread: true,
        botCanPrivateThread: true,
      }))
    : []
  const own = threadSettings[boardId]
  return own
    ? { enabled: true, active: channels.some((channel) => channel.channelId === own.channelId), ...own, channels }
    : { enabled: false, active: false, channelId: null, privateThreads: false, updates: 'BOTH', channels }
}

const ROUTES: [string, RegExp, Handler][] = [
  ['GET', /^\/api\/servers\/\d+\/permissions\/check$/, (_m, { query }) => accessCheck(query)],
  ['POST', /^\/api\/auth\/refresh$/, () => ({ accessToken: 'demo', tokenType: 'Bearer', expiresIn: 86_400, sessionId: 'demo', user: me })],
  ['POST', /^\/api\/auth\/logout$/, () => undefined],
  ['GET', /^\/api\/me$/, () => me],
  ['GET', /^\/api\/me\/guilds$/, () => [{ id: data.SERVER_ID, name: 'Pixel Forge', icon: null, owner: true, permissions: '8' }]],
  ['GET', /^\/api\/me\/servers$/, () => [{ serverId: data.SERVER_ID, name: 'Pixel Forge', botPresent: true, ownerId: data.ME }]],
  ['GET', /^\/api\/me\/preferences$/, () => me.preferences],
  ['PATCH', /^\/api\/me\/preferences$/, (_m, { body }) => {
    const merged: Record<string, unknown> = { ...me.preferences }
    for (const [key, value] of Object.entries((body ?? {}) as Record<string, unknown>)) {
      if (value === null) delete merged[key]
      else merged[key] = value
    }
    me.preferences = merged
    try {
      sessionStorage.setItem(PREFERENCES_KEY, JSON.stringify(merged))
    } catch {
      // Not kept past a reload, which only matters for trying it out.
    }
    return merged
  }],
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
  ['GET', /^\/api\/servers\/\d+\/reminders$/, () => ({ minutes: serverReminders, effective: serverReminders })],
  ['PUT', /^\/api\/servers\/\d+\/reminders$/, (_m, { body }) => {
    serverReminders = minutesOf(body) ?? [1440]
    return { minutes: serverReminders, effective: serverReminders }
  }],
  ['GET', /^\/api\/servers\/\d+\/boards\/(\d+)\/reminders$/, (m) => ({ minutes: boardReminders.get(m[1]) ?? null, effective: boardTimes(m[1]) })],
  ['PUT', /^\/api\/servers\/\d+\/boards\/(\d+)\/reminders$/, (m, { body }) => {
    const minutes = minutesOf(body)
    if (minutes) boardReminders.set(m[1], minutes)
    else boardReminders.delete(m[1])
    return { minutes, effective: boardTimes(m[1]) }
  }],
  ['GET', /^\/api\/servers\/\d+\/boards\/(\d+)\/reminders\/mine$/, (m) => ({
    minutes: myBoardReminders.get(m[1]) ?? null,
    effective: myBoardReminders.get(m[1]) ?? myReminders ?? boardTimes(m[1]),
  })],
  ['PUT', /^\/api\/servers\/\d+\/boards\/(\d+)\/reminders\/mine$/, (m, { body }) => {
    const minutes = minutesOf(body)
    if (minutes) myBoardReminders.set(m[1], minutes)
    else myBoardReminders.delete(m[1])
    return { minutes, effective: minutes ?? myReminders ?? boardTimes(m[1]) }
  }],
  ['GET', /^\/api\/me\/reminders$/, () => myTimes()],
  ['PUT', /^\/api\/me\/reminders$/, (_m, { body }) => {
    myReminders = minutesOf(body)
    return myTimes()
  }],
  // Suggestions for whatever is switched off, as the API would make them for a board using tags by hand.
  ['GET', /^\/api\/servers\/\d+\/boards\/\d+\/feature-suggestions$/, () => ({
    suggestions: DEMO_SUGGESTIONS.filter((suggestion) => !features[suggestion.feature] && !dismissedSuggestions.has(suggestion.feature)),
  })],
  ['POST', /^\/api\/servers\/\d+\/boards\/\d+\/feature-suggestions\/dismiss$/, (_m, { body }) => {
    for (const feature of (body as { features: string[] }).features) dismissedSuggestions.add(feature)
    return undefined
  }],
  ['GET', /^\/api\/servers\/\d+\/permissions\/mine$/, () => ({
    server: Object.fromEntries(data.SERVER_KEYS.map((key) => [key, true])),
    boards: Object.fromEntries(data.BOARDS.map((board) => [board.boardId, Object.fromEntries(data.BOARD_KEYS.map((key) => [key, true]))])),
  })],
  ['GET', /^\/api\/public\/roadmap$/, () => DEMO_ROADMAP],
  ['POST', /^\/api\/public\/roadmap\/issues$/, (_m, { body }) => {
    const issue = { id: String(Date.now()), columnId: '1', labelIds: [], ...(body as { title: string; description?: string }) }
    DEMO_ROADMAP.tasks = [issue, ...DEMO_ROADMAP.tasks]
    return issue
  }],
  ['GET', /^\/api\/servers\/\d+\/permissions\/catalog$/, () => catalog],
  ['POST', /^\/api\/servers\/\d+\/permissions\/presets$/, (_m, { body }) => applyServerPreset(body as { preset: PermissionPreset; staffRoleId?: string | null })],
  ['GET', /^\/api\/servers\/\d+\/permissions$/, (_m, { query }) => (query.get('scopeType') === 'BOARD' ? [] : serverRules)],
  ['GET', /^\/api\/servers\/\d+\/roles$/, () => data.ROLES.map((role) => ({ ...role, serverId: data.SERVER_ID }))],
  ['GET', /^\/api\/servers\/\d+\/members$/, () => members],
  ['GET', /^\/api\/servers\/\d+\/members\/search$/, (_m, { query }) => searchMembers(query.get('q') ?? '')],
  ['GET', /^\/api\/servers\/\d+\/boards$/, (_m, { query }) => ({
    content: data.BOARDS.filter((board) => query.get('archived') === null || String(board.isArchived) === query.get('archived')),
  })],
  ['GET', /^\/api\/servers\/\d+\/boards\/(\d+)$/, (m) => data.BOARDS.find((board) => board.boardId === Number(m[1]))],
  ['GET', /^\/api\/servers\/\d+\/boards\/(\d+)\/snapshot$/, (m) => snapshot(Number(m[1]))],
  ['GET', /^\/api\/servers\/\d+\/boards\/\d+\/tasks$/, (_m, { query }) => ({
    content: query.get('archived') === 'true'
      ? data.TASKS.filter((task) => archivedTaskIds.has(task.taskId)).map((task) => ({ ...task, isArchived: true }))
      : data.TASKS,
  })],
  ['PATCH', /^\/api\/servers\/\d+\/boards\/\d+\/tasks\/(\d+)\/archive$/, (m, { query }) => {
    const task = data.TASKS.find((entry) => entry.taskId === Number(m[1]))
    const archived = query.get('archived') !== 'false'
    if (archived) archivedTaskIds.add(Number(m[1]))
    else archivedTaskIds.delete(Number(m[1]))
    return task && { ...task, isArchived: archived }
  }],
  ['POST', /^\/api\/servers\/\d+\/boards\/\d+\/import-tasks(\/preview)?$/, (_m, { body }) => demoImportPlan(body)],
  ['POST', /^\/api\/servers\/\d+\/boards\/\d+\/columns\/(\d+)\/archive-tasks$/, (m) => {
    const tasks = data.TASKS.filter((task) => task.columnId === Number(m[1]) && !archivedTaskIds.has(task.taskId))
    tasks.forEach((task) => archivedTaskIds.add(task.taskId))
    return { archived: tasks.length }
  }],
  ['GET', /^\/api\/servers\/\d+\/boards\/\d+\/tasks\/(\d+)\/comments$/, (m) =>
    ({ content: Number(m[1]) === data.FEATURED_TASK ? data.COMMENTS : [] })],
  ['GET', /^\/api\/servers\/\d+\/boards\/(\d+)\/notifications$/, (m) => boardNotifications(Number(m[1]))],
  ['GET', /^\/api\/servers\/\d+\/boards\/(\d+)\/threads$/, (m) => boardThreads(Number(m[1]))],
  ['PUT', /^\/api\/servers\/\d+\/boards\/(\d+)\/threads$/, (m, { body }) => {
    threadSettings[Number(m[1])] = body as ThreadSetting
    return boardThreads(Number(m[1]))
  }],
  ['DELETE', /^\/api\/servers\/\d+\/boards\/(\d+)\/threads$/, (m) => {
    delete threadSettings[Number(m[1])]
    return boardThreads(Number(m[1]))
  }],
  ['PUT', /^\/api\/servers\/\d+\/boards\/(\d+)\/notifications\/feeds\/\d+$/, (m, { body }) => {
    const boardId = Number(m[1])
    const changes = body as { events?: Record<string, boolean>; mentions?: Record<string, boolean> }
    const own = boardOverrides[boardId] ?? { events: {}, mentions: {} }
    const feed = feeds[0]
    for (const [kind, feedFlags] of [['events', feed.events], ['mentions', feed.mentions]] as const) {
      for (const [key, on] of Object.entries(changes[kind] ?? {})) {
        if (on === Boolean(feedFlags[key])) delete own[kind][key]
        else own[kind][key] = on
      }
    }
    boardOverrides[boardId] = own
    return boardNotifications(boardId)
  }],
  ['DELETE', /^\/api\/servers\/\d+\/boards\/(\d+)\/notifications\/feeds\/\d+$/, (m) => {
    delete boardOverrides[Number(m[1])]
    return boardNotifications(Number(m[1]))
  }],
  ['GET', /^\/api\/servers\/\d+\/notifications$/, () => ({
    auditChannelId: data.CHANNELS[4].channelId,
    feeds: feeds.map((feed) => ({
      ...feed,
      boardOverrides: Object.fromEntries(Object.entries(boardOverrides).map(([boardId, own]) =>
        [boardId, { ...own, changes: Object.keys(own.events).length + Object.keys(own.mentions).length }])),
    })),
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

/** An example roadmap: KanbanCord's own board as it might look. */
const DEMO_ROADMAP = {
  name: 'KanbanCord',
  description: 'What is next for KanbanCord',
  issuesColumnId: '1',
  columns: [
    { id: '1', name: 'Issues', color: null },
    { id: '2', name: 'To Do', color: null },
    { id: '3', name: 'In Progress', color: null },
    { id: '4', name: 'Done', color: null },
  ],
  labels: [
    { id: '1', name: 'Bug', color: '#ef4444' },
    { id: '2', name: 'Feature', color: '#3b82f6' },
    { id: '3', name: 'Website', color: '#10b981' },
  ],
  priorities: [
    { id: '1', name: 'High', color: '#ea580c', position: 1 },
    { id: '2', name: 'Medium', color: '#ca8a04', position: 2 },
  ],
  tasks: [
    { id: '11', columnId: '1', title: 'Due date picker is hard to use on phones', labelIds: ['1'] },
    { id: '21', columnId: '2', title: 'Import from CSV or a pasted list', labelIds: ['2'], priorityId: '1',
      description: 'Paste a list, **one task per line**, into a column.' },
    { id: '22', columnId: '2', title: 'Per-assignee completion', labelIds: ['2'] },
    { id: '31', columnId: '3', title: 'Public roadmap', labelIds: ['3'], priorityId: '2' },
    ...Array.from({ length: 40 }, (_, i) => ({ id: String(100 + i), columnId: '4', title: `Shipped change ${i + 1}`, labelIds: ['2'] })),
  ] as { id: string; columnId: string; title: string; description?: string; labelIds?: string[]; priorityId?: string }[],
}

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
