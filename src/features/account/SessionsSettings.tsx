import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { parseServerTime, readableError } from '../../api/http'
import { fetchSessions, revokeOtherSessions, revokeSession, type SessionEntry } from '../../services/meService'
import { relativeTime } from '../audit/auditModel'

/** "Chrome on Windows" from a user agent string, or the string itself when it is not recognised. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : null
  const system = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null
  return browser && system ? `${browser} on ${system}` : browser ?? system ?? userAgent.slice(0, 60)
}

/** Where the user is signed in, with sign-out for any other device. */
export function SessionsSettings() {
  const queryClient = useQueryClient()
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: fetchSessions })
  const refresh = { onSettled: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }) }
  const revokeOne = useMutation({ mutationFn: revokeSession, ...refresh })
  const revokeOthers = useMutation({ mutationFn: revokeOtherSessions, ...refresh })
  const error = revokeOne.error ?? revokeOthers.error
  const others = (sessions.data ?? []).filter((session) => !session.current)

  return (
    <div className="kc-features">
      <p className="kc-muted">
        Devices and browsers signed in to your account. Signing one out ends it straight away, including any board it
        has open.
      </p>
      {error && <p className="kc-banner">{readableError(error, 'Could not sign out that session')}</p>}
      {sessions.isError && <p className="kc-banner">{readableError(sessions.error, 'Could not load your sessions')}</p>}

      <ul className="kc-features-list">
        {(sessions.data ?? []).map((session: SessionEntry) => (
          <li key={session.sessionId} className="kc-feature-row">
            <div className="kc-feature-text">
              <span className="kc-feature-label">
                {describeDevice(session.userAgent)}
                {session.current && <span className="kc-session-current"> · This device</span>}
              </span>
              <p className="kc-muted">
                Active {relativeTime(session.lastUsedAt)} · signed in{' '}
                {parseServerTime(session.createdAt).toLocaleDateString()}
              </p>
            </div>
            {!session.current && (
              <button
                type="button"
                className="kc-btn kc-btn-ghost kc-btn-small"
                disabled={revokeOne.isPending}
                onClick={() => revokeOne.mutate(session.sessionId)}
              >
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <div>
          <button
            type="button"
            className="kc-btn kc-btn-danger"
            disabled={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            Sign out all other devices
          </button>
        </div>
      )}
    </div>
  )
}
