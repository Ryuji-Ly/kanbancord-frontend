import { API_BASE_URL } from '../config/env'
import { t } from '../i18n'

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export async function parseError(response: Response): Promise<string> {
  const errorText = await response.text()
  // In the API's own error shape, so the status is still recognised (see queryClient) in any language.
  return errorText || JSON.stringify({ status: response.status, message: t('common.requestFailed', { status: response.status }) })
}

/** The message to show for a failed request: the API's `message` field when the error carries its JSON body. */
export function readableError(error: unknown, fallback: string): string {
  const text = error instanceof Error ? error.message : ''
  try {
    const body = JSON.parse(text) as { message?: unknown }
    if (typeof body.message === 'string' && body.message) return body.message
  } catch {
    // Not a JSON body; use the text itself.
  }
  return text || fallback
}

/**
 * A time from the server, such as when something was created or when a task is due. The API sends
 * these in UTC without a zone, which `new Date` would read as local time.
 */
export function parseServerTime(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
}

/** A server time as a date-and-time field's value ("2026-11-20T17:00"), in this device's time zone. */
export function toLocalInput(value: string): string {
  const date = parseServerTime(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * A date-and-time field's value, which is in this device's time zone, as the server wants it: UTC
 * without a zone. Reminders, Discord and everyone else's screens then agree on the moment.
 */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString().slice(0, 19)
}
