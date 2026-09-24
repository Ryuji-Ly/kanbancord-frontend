import { API_BASE_URL } from '../config/env'

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export async function parseError(response: Response): Promise<string> {
  const errorText = await response.text()
  return errorText || `Request failed (${response.status})`
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
 * A time the server recorded, such as when something was created. The API sends these in UTC
 * without a zone, which `new Date` would read as local time. Due dates are not recorded times but
 * the user's own wall-clock times, and must not go through this.
 */
export function parseServerTime(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
}
