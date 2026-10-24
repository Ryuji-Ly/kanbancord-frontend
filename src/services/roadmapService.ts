import { apiUrl, parseError } from '../api/http'
import { apiFetch } from '../api/session'

export type RoadmapTask = {
  id: string
  columnId: string
  title: string
  description?: string | null
  labelIds?: string[]
  priorityId?: string | null
}

export type Roadmap = {
  name: string
  description: string | null
  /** The column anyone signed in may add an issue to; null when the board has none. */
  issuesColumnId: string | null
  columns: { id: string; name: string; color: string | null }[]
  labels: { id: string; name: string; color: string }[]
  /** Most urgent first: position 1 is P1. */
  priorities: { id: string; name: string; color: string | null; position: number }[]
  tasks: RoadmapTask[]
}

/** The roadmap, readable without signing in; null while none is set up. */
export async function fetchRoadmap(): Promise<Roadmap | null> {
  const response = await fetch(apiUrl('/api/public/roadmap'))
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as Roadmap
}

/** Refused because the person already added one this hour: when they may add the next. */
export class IssueLimitError extends Error {
  readonly nextAt: Date

  constructor(message: string, nextAt: Date) {
    super(message)
    this.name = 'IssueLimitError'
    this.nextAt = nextAt
  }
}

export async function addRoadmapIssue(input: { title: string; description: string }): Promise<RoadmapTask> {
  const response = await apiFetch('/api/public/roadmap/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (response.status === 429) {
    const seconds = Number(response.headers.get('Retry-After')) || 3600
    throw new IssueLimitError(await parseError(response), new Date(Date.now() + seconds * 1000))
  }
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as RoadmapTask
}
