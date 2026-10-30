import { parseError } from '../api/http'
import { apiFetch } from '../api/session'

/**
 * Reminder times before a due date, in minutes, latest first: the server's, a board's own and each person's own
 * (everywhere or for one board). `minutes` is what is set at that level, null where nothing is; `effective` is
 * what applies there.
 */
export type ReminderTimes = { minutes: number[] | null; effective: number[] }

/** A person's own times: for every board (null when they use each board's), and for single boards. */
export type MyReminderTimes = {
  everywhere: number[] | null
  boards: { boardId: number; boardName: string; serverId: string; serverName: string; minutes: number[] }[]
}

/** Times a list may hold, and their range, as the API checks them. */
export const MAX_REMINDER_TIMES = 5
export const MIN_REMINDER_MINUTES = 5
export const MAX_REMINDER_MINUTES = 43_200

async function call<T>(path: string, minutes?: number[] | null): Promise<T> {
  const response = await apiFetch(
    path,
    minutes === undefined
      ? undefined
      : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes }) },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<T>
}

export const fetchServerReminders = (serverId: string) => call<ReminderTimes>(`/api/servers/${serverId}/reminders`)
export const saveServerReminders = (serverId: string, minutes: number[]) =>
  call<ReminderTimes>(`/api/servers/${serverId}/reminders`, minutes)

export const fetchBoardReminders = (serverId: string, boardId: string) =>
  call<ReminderTimes>(`/api/servers/${serverId}/boards/${boardId}/reminders`)
/** Null goes back to the server's times. */
export const saveBoardReminders = (serverId: string, boardId: string, minutes: number[] | null) =>
  call<ReminderTimes>(`/api/servers/${serverId}/boards/${boardId}/reminders`, minutes)

export const fetchMyBoardReminders = (serverId: string, boardId: string) =>
  call<ReminderTimes>(`/api/servers/${serverId}/boards/${boardId}/reminders/mine`)
/** Null goes back to the person's times for every board, or the board's. */
export const saveMyBoardReminders = (serverId: string, boardId: string, minutes: number[] | null) =>
  call<ReminderTimes>(`/api/servers/${serverId}/boards/${boardId}/reminders/mine`, minutes)

export const fetchMyReminders = () => call<MyReminderTimes>('/api/me/reminders')
/** Null goes back to each board's times. */
export const saveMyReminders = (minutes: number[] | null) => call<MyReminderTimes>('/api/me/reminders', minutes)
