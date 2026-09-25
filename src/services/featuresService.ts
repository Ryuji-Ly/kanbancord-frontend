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
