import { API_BASE_URL } from '../config/env'

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export async function parseError(response: Response): Promise<string> {
  const errorText = await response.text()
  return errorText || `Request failed (${response.status})`
}
