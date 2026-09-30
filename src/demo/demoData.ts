/**
 * Example data for demo mode: a made-up game-development community planning a game jam. Every name
 * and person here is fictional. Dates are relative to now, so "due tomorrow" stays true.
 */

export const SERVER_ID = '900000000000000001'
export const ME = '100000000000000001'

const DAY = 86_400_000
/** A server time (UTC, no zone) this many days from now, at this hour. */
export function at(days: number, hour = 12): string {
  const date = new Date(Date.now() + days * DAY)
  date.setUTCHours(hour, 0, 0, 0)
  return date.toISOString().slice(0, 19)
}

export const PEOPLE = [
  { userId: ME, username: 'alex', displayName: 'Alex', nickname: null },
  { userId: '100000000000000002', username: 'mira.dev', displayName: 'Mira', nickname: null },
  { userId: '100000000000000003', username: 'jonas', displayName: 'Jonas', nickname: 'Jonas (Audio)' },
  { userId: '100000000000000004', username: 'aiko', displayName: 'Aiko', nickname: null },
  { userId: '100000000000000005', username: 'theo_builds', displayName: 'Theo', nickname: null },
  { userId: '100000000000000006', username: 'sana', displayName: 'Sana', nickname: null },
]
const [ALEX, MIRA, JONAS, AIKO, THEO, SANA] = PEOPLE.map((person) => person.userId)

export const ROLES = [
  { roleId: SERVER_ID, name: '@everyone', color: null, position: 0 },
  { roleId: '800000000000000001', name: 'Artists', color: 0xf472b6, position: 3 },
  { roleId: '800000000000000002', name: 'Programmers', color: 0x60a5fa, position: 2 },
  { roleId: '800000000000000003', name: 'Organisers', color: 0xfbbf24, position: 4 },
]
const [, ARTISTS, PROGRAMMERS] = ROLES.map((role) => role.roleId)

export const BOARD_KEYS = [
  'VIEW_BOARD', 'EDIT_BOARD_DETAILS', 'EDIT_BOARD_PERMISSIONS', 'ARCHIVE_BOARD', 'DELETE_BOARD', 'CREATE_COLUMN',
  'EDIT_COLUMN', 'DELETE_COLUMN', 'MOVE_COLUMN', 'CREATE_TASK', 'VIEW_TASK', 'EDIT_TASK', 'MOVE_TASK', 'DELETE_TASK',
  'ARCHIVE_TASK', 'ASSIGN_TASK_SELF', 'ASSIGN_TASK_OTHERS', 'CREATE_TASK_COMMENT',
  'DELETE_TASK_COMMENT', 'CREATE_LABEL', 'EDIT_LABEL', 'DELETE_LABEL', 'APPLY_LABEL_TO_TASK', 'REMOVE_LABEL_FROM_TASK',
  'MANAGE_PRIORITIES',
]
export const SERVER_KEYS = ['ADMIN', 'VIEW_SERVER', 'MANAGE_SERVER_PERMISSIONS', 'VIEW_AUDIT_LOG', 'CREATE_BOARD']

export const FEATURES = { LABELS: true, PRIORITIES: true, ASSIGNEES: true, COMMENTS: true, DUE_DATES: true, PERMISSIONS: true }

export const BOARDS = [
  { boardId: 1, name: 'Game Jam 2026', description: 'Our entry for the autumn jam: a cosy puzzle platformer. Ship by Sunday!' },
  { boardId: 2, name: 'Community Events', description: 'Movie nights, tournaments and the monthly showcase.' },
  { boardId: 3, name: 'Website Redesign', description: 'New studio site with devlogs and a press kit.' },
  { boardId: 4, name: 'Launch Week', description: 'Everything for the demo launch in spring.', isArchived: true },
].map((board) => ({
  serverId: SERVER_ID,
  isArchived: false,
  createdBy: ALEX,
  createdAt: at(-30),
  updatedAt: at(-1),
  ...board,
}))

export const COLUMNS = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'].map((name, index) => ({
  columnId: 10 + index,
  boardId: 1,
  name,
  position: index + 1,
  color: null,
  wipLimit: null,
  createdAt: at(-30),
  updatedAt: at(-30),
}))
const [BACKLOG, TODO, DOING, REVIEW, DONE] = COLUMNS.map((column) => column.columnId)

export const PRIORITIES = [
  ['Critical', '#dc2626'], ['High', '#ea580c'], ['Medium', '#ca8a04'], ['Low', '#2563eb'], ['Ignorable', '#6b7280'],
].map(([name, color], index) => ({ priorityId: 20 + index, boardId: 1, name, color, position: index + 1 }))
const [CRITICAL, HIGH, MEDIUM, LOW] = PRIORITIES.map((level) => level.priorityId)

export const LABELS = [
  ['Art', '#db2777'], ['Code', '#2563eb'], ['Audio', '#9333ea'], ['Design', '#16a34a'], ['Bug', '#dc2626'],
].map(([name, color], index) => ({ labelId: 30 + index, boardId: 1, name, color }))
const [ART, CODE, AUDIO, DESIGN, BUG] = LABELS.map((label) => label.labelId)

type TaskSeed = {
  title: string
  column: number
  priority?: number
  due?: number
  labels?: number[]
  people?: string[]
  roles?: string[]
  description?: string
  by?: string
}

const SEEDS: TaskSeed[] = [
  { title: 'Pick a theme from the jam shortlist', column: DONE, priority: HIGH, labels: [DESIGN], people: [ALEX, MIRA] },
  { title: 'Player movement and jumping', column: DONE, priority: HIGH, labels: [CODE], people: [MIRA] },
  { title: 'Tileset for the forest levels', column: REVIEW, priority: MEDIUM, due: 1, labels: [ART], people: [AIKO] },
  {
    title: 'Level 1: the first puzzle room',
    column: DOING,
    priority: CRITICAL,
    due: 2,
    labels: [DESIGN, CODE],
    people: [ALEX, THEO],
    roles: [PROGRAMMERS],
    description: [
      'The room that teaches the core mechanic: push the lantern onto the pressure plate to open the gate.',
      '',
      '**Checklist**',
      '- [x] Block out the room',
      '- [x] Pressure plate and gate',
      '- [ ] Lantern physics',
      '- [ ] Hint sign for players who get stuck',
      '',
      'Keep it under a minute for most players. Playtest notes are in the comments.',
    ].join('\n'),
  },
  { title: 'Main menu music', column: DOING, priority: MEDIUM, due: 3, labels: [AUDIO], people: [JONAS] },
  { title: 'Lantern glow shader', column: DOING, priority: LOW, labels: [ART, CODE], people: [MIRA], roles: [ARTISTS] },
  { title: 'Save progress between levels', column: TODO, priority: HIGH, due: 4, labels: [CODE], people: [THEO] },
  { title: 'Footstep sounds on wood and stone', column: TODO, priority: LOW, labels: [AUDIO], people: [JONAS] },
  { title: 'Character sprite: idle and walk', column: TODO, priority: MEDIUM, due: -1, labels: [ART], people: [AIKO] },
  { title: 'Player falls through moving platforms', column: TODO, priority: CRITICAL, due: 1, labels: [BUG, CODE] },
  { title: 'Credits screen', column: BACKLOG, priority: LOW, labels: [DESIGN], people: [SANA] },
  { title: 'Controller support', column: BACKLOG, priority: MEDIUM, labels: [CODE] },
  { title: 'Trailer for the jam page', column: BACKLOG, labels: [ART, AUDIO], by: SANA },
  { title: 'Write the itch.io page', column: BACKLOG, due: 6, labels: [DESIGN], people: [SANA] },
]

export const TASKS = SEEDS.map((seed, index) => ({
  taskId: 100 + index,
  boardId: 1,
  columnId: seed.column,
  title: seed.title,
  description: seed.description ?? null,
  position: index + 1,
  priorityId: seed.priority ?? null,
  dueDate: seed.due === undefined ? null : at(seed.due, 18),
  isArchived: false,
  metadata: null,
  createdBy: seed.by ?? ALEX,
  createdAt: at(-10 + index * 0.4),
  updatedAt: at(-1),
  completedAt: null,
}))

export const ASSIGNMENTS = SEEDS.flatMap((seed, index) => (seed.people ?? []).map((userId, n) => ({
  id: 1000 + index * 10 + n,
  taskId: 100 + index,
  userId,
  assignedBy: ALEX,
  assignedAt: at(-5),
})))

export const ROLE_ASSIGNMENTS = SEEDS.flatMap((seed, index) => (seed.roles ?? []).map((roleId, n) => ({
  id: 2000 + index * 10 + n,
  taskId: 100 + index,
  roleId,
  assignedBy: ALEX,
  assignedAt: at(-5),
})))

export const TASK_LABELS = SEEDS.flatMap((seed, index) => (seed.labels ?? []).map((labelId, n) => ({
  id: 3000 + index * 10 + n,
  taskId: 100 + index,
  labelId,
  addedAt: at(-5),
})))

/** The task shown open in screenshots, with a short discussion. */
export const FEATURED_TASK = 103
export const COMMENTS = [
  { userId: THEO, text: 'Gate animation is in. The plate triggers a bit early when you stand on the edge.' },
  { userId: MIRA, text: 'I can widen the trigger area tomorrow. Want the lantern to be pushable from both sides?' },
  { userId: ALEX, text: 'Both sides please, testers kept trying that. Hint sign can wait until after playtest.' },
].map((comment, index) => {
  const person = PEOPLE.find((entry) => entry.userId === comment.userId)!
  return {
    commentId: 500 + index,
    taskId: FEATURED_TASK,
    userId: comment.userId,
    authorUsername: person.username,
    authorGlobalName: person.displayName,
    authorAvatarUrl: null,
    content: comment.text,
    replyToId: null,
    createdAt: at(-1 + index * 0.1, 9 + index * 2),
    updatedAt: null,
    deletedAt: null,
    editedByUsers: [],
  }
})

export const CHANNELS = [
  ['general', 'Community', 1], ['announcements', 'Community', 2], ['jam-board', 'Game Jam', 3],
  ['jam-updates', 'Game Jam', 4], ['kanban-log', 'Staff', 5],
].map(([name, category, position], index) => ({
  channelId: String(700000000000000001n + BigInt(index)),
  name,
  category,
  position,
  botCanPost: true,
}))
