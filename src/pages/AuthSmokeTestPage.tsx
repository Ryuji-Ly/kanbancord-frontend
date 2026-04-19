import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config/env'
import { AuthActions } from '../components/AuthActions'
import {
  clearCallbackQuery,
  clearOAuthSessionState,
  clearToken,
  exchangeDiscordCode,
  getExpectedOAuthState,
  getStoredToken,
  isOAuthInProgress,
  saveToken,
  startDiscordLogin,
} from '../services/authService'
import { fetchMe, fetchMyServers } from '../services/meService'
import type { MeResponse } from '../types/auth'

export function AuthSmokeTestPage() {
  const [authToken, setAuthToken] = useState<string>(() => getStoredToken())
  const [me, setMe] = useState<MeResponse | null>(null)
  const [serversPayload, setServersPayload] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const isAuthenticated = useMemo(() => authToken.trim().length > 0, [authToken])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (!isOAuthInProgress()) {
      return
    }

    if (error) {
      setMessage(`Discord authorization failed: ${error}`)
      clearOAuthSessionState()
      clearCallbackQuery()
      return
    }

    if (!code) {
      return
    }

    const expectedState = getExpectedOAuthState()
    if (!state || !expectedState || state !== expectedState) {
      setMessage('Invalid OAuth state. Please try again.')
      clearOAuthSessionState()
      clearCallbackQuery()
      return
    }

    void completeDiscordExchange(code)
  }, [])

  async function completeDiscordExchange(code: string) {
    setLoading(true)
    setMessage('')

    try {
      const data = await exchangeDiscordCode(code)
      saveToken(data.accessToken)
      setAuthToken(data.accessToken)
      setMessage('Login successful via Discord OAuth. Backend token saved.')
      clearCallbackQuery()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'OAuth login failed')
    } finally {
      clearOAuthSessionState()
      setLoading(false)
    }
  }

  async function onFetchMe() {
    if (!authToken) {
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const data = await fetchMe(authToken)
      setMe(data)
      setMessage('Token validated through /api/me.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to fetch /api/me')
    } finally {
      setLoading(false)
    }
  }

  async function onFetchServers() {
    if (!authToken) {
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const data = await fetchMyServers(authToken)
      setServersPayload(JSON.stringify(data, null, 2))
      setMessage('Fetched /api/me/servers successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to fetch /api/me/servers')
    } finally {
      setLoading(false)
    }
  }

  function onLogout() {
    clearToken()
    clearCallbackQuery()
    setAuthToken('')
    setMe(null)
    setServersPayload('')
    setMessage('Logged out and token cleared.')
  }

  return (
    <main>
      <h1>KanbanCord Auth Smoke Test</h1>
      <p>API Base URL: {API_BASE_URL || '(same-origin / Vite proxy)'}</p>

      <AuthActions
        loading={loading}
        isAuthenticated={isAuthenticated}
        onLogin={() => startDiscordLogin(setMessage)}
        onValidateToken={onFetchMe}
        onFetchServers={onFetchServers}
        onLogout={onLogout}
      />

      {message && <p>{message}</p>}

      {me && (
        <section>
          <h2>/api/me Response</h2>
          <pre>{JSON.stringify(me, null, 2)}</pre>
        </section>
      )}

      {serversPayload && (
        <section>
          <h2>/api/me/servers Response</h2>
          <pre>{serversPayload}</pre>
        </section>
      )}
    </main>
  )
}
