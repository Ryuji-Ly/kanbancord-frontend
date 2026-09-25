import { parseServerTime } from '../../api/http'
import type { TaskEntry } from '../../services/tasksService'

/**
 * Narrowing a board down to the tasks you are looking for. Filters live in the page's address, so a
 * filtered board can be bookmarked or shared.
 */
export type BoardFilters = {
  /** Words that must all appear in the title or description, ignoring case. */
  query: string
  /** '' anyone, 'me', 'none' for unassigned, or a user id. */
  assignee: string
  /** '' any, or a label id. */
  label: string
  /** '' any, 'none' for no priority, or a priority id. */
  priority: string
  due: '' | 'overdue' | 'week' | 'none'
}

export const NO_FILTERS: BoardFilters = { query: '', assignee: '', label: '', priority: '', due: '' }

const PARAMS: Record<keyof BoardFilters, string> = { query: 'q', assignee: 'assignee', label: 'label', priority: 'priority', due: 'due' }
const DUE_VALUES = new Set(['overdue', 'week', 'none'])

export function filtersFromParams(params: URLSearchParams): BoardFilters {
  const due = params.get(PARAMS.due) ?? ''
  return {
    query: params.get(PARAMS.query) ?? '',
    assignee: params.get(PARAMS.assignee) ?? '',
    label: params.get(PARAMS.label) ?? '',
    priority: params.get(PARAMS.priority) ?? '',
    due: DUE_VALUES.has(due) ? (due as BoardFilters['due']) : '',
  }
}

/** The address with these filters, keeping everything else in it (the server, an open task). */
export function paramsWithFilters(params: URLSearchParams, filters: BoardFilters): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const [key, param] of Object.entries(PARAMS) as [keyof BoardFilters, string][]) {
    const value = filters[key].trim()
    if (value) next.set(param, value)
    else next.delete(param)
  }
  return next
}

export function isFiltering(filters: BoardFilters): boolean {
  return Object.values(filters).some((value) => value.trim() !== '')
}

type TaskFacts = {
  assigneeIds: (taskId: number) => string[]
  labelIds: (taskId: number) => number[]
  myId: string | null
  now: Date
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function matchesFilters(task: TaskEntry, filters: BoardFilters, facts: TaskFacts): boolean {
  const words = filters.query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length > 0) {
    const text = `${task.title}\n${task.description ?? ''}`.toLowerCase()
    if (!words.every((word) => text.includes(word))) return false
  }

  if (filters.assignee) {
    const assigned = facts.assigneeIds(task.taskId)
    if (filters.assignee === 'none' ? assigned.length > 0 : !assigned.includes(filters.assignee === 'me' ? (facts.myId ?? '') : filters.assignee)) {
      return false
    }
  }

  if (filters.label && !facts.labelIds(task.taskId).includes(Number(filters.label))) return false

  if (filters.priority) {
    if (filters.priority === 'none' ? task.priorityId !== null : task.priorityId !== Number(filters.priority)) return false
  }

  if (filters.due) {
    const due = task.dueDate ? parseServerTime(task.dueDate) : null
    if (filters.due === 'none') return due === null
    if (!due) return false
    const now = facts.now.getTime()
    if (filters.due === 'overdue' && due.getTime() >= now) return false
    if (filters.due === 'week' && (due.getTime() < now || due.getTime() > now + WEEK_MS)) return false
  }
  return true
}
