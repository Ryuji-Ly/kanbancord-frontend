import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

/** The optional parts of KanbanCord. With all of them off, a server is in simple mode. */
export type FeatureKey = 'LABELS' | 'PRIORITIES' | 'ASSIGNEES' | 'COMMENTS' | 'DUE_DATES' | 'PERMISSIONS'

export type ServerFeatures = Record<FeatureKey, boolean>

export const FEATURES: { key: FeatureKey; label: string; description: string }[] = [
  { key: 'LABELS', label: 'Labels', description: 'Coloured tags on tasks, managed per board.' },
  { key: 'PRIORITIES', label: 'Priorities', description: 'A priority level on each task, from Critical to Ignorable.' },
  { key: 'ASSIGNEES', label: 'Assignees', description: 'Assign members to tasks.' },
  { key: 'COMMENTS', label: 'Comments', description: 'Discussion on each task.' },
  { key: 'DUE_DATES', label: 'Due dates', description: 'A date and time each task is due.' },
  {
    key: 'PERMISSIONS',
    label: 'Custom permissions',
    description: 'Edit who may do what, per server and per board. While off, access follows Discord permissions.',
  },
]

/** Everything off: what a new server starts with. */
export const NO_FEATURES: ServerFeatures = {
  LABELS: false,
  PRIORITIES: false,
  ASSIGNEES: false,
  COMMENTS: false,
  DUE_DATES: false,
  PERMISSIONS: false,
}

export async function fetchServerFeatures(serverId: string): Promise<ServerFeatures> {
  const response = await apiFetch(`/api/servers/${serverId}/features`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerFeatures>
}

/** Switches the given features on or off; the others keep their setting. */
export async function updateServerFeatures(serverId: string, changes: Partial<ServerFeatures>): Promise<ServerFeatures> {
  const response = await apiFetch(`/api/servers/${serverId}/features`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<ServerFeatures>
}

/**
 * Open permissions: everyone who can talk in the server may do anything with boards, columns and
 * tasks. Not a feature: simple mode and "enable everything" leave it alone, and it cannot be on
 * together with custom permissions.
 */
export async function fetchOpenPermissions(serverId: string): Promise<boolean> {
  const response = await apiFetch(`/api/servers/${serverId}/features/open-permissions`)
  if (!response.ok) throw new Error(await parseError(response))
  return Boolean(((await response.json()) as { enabled: boolean }).enabled)
}

export async function setOpenPermissions(serverId: string, enabled: boolean): Promise<boolean> {
  const response = await apiFetch(`/api/servers/${serverId}/features/open-permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return Boolean(((await response.json()) as { enabled: boolean }).enabled)
}

/** Features a board can switch off for itself; permissions are managed for the whole server. */
export type BoardFeatureKey = Exclude<FeatureKey, 'PERMISSIONS'>

/**
 * Switches features on or off for one board; the others keep their setting. Switching on only
 * undoes the board's own switch: a feature the server has off stays off.
 */
export async function updateBoardFeatures(
  serverId: string,
  boardId: string,
  changes: Partial<Record<BoardFeatureKey, boolean>>,
): Promise<Record<BoardFeatureKey, boolean>> {
  const response = await apiFetch(`/api/servers/${serverId}/boards/${boardId}/features`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<Record<BoardFeatureKey, boolean>>
}
