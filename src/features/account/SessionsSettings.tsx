import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { parseServerTime, readableError } from '../../api/http'
import { formatLocale, t } from '../../i18n'
import { fetchSessions, revokeOtherSessions, revokeSession, type SessionEntry } from '../../services/meService'
import { relativeTime } from '../audit/auditModel'

/** "Chrome on Windows" from a user agent string, or the string itself when it is not recognised. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return t('account.sessions.unknownDevice')
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
  return browser && system ? t('account.sessions.browserOn', { browser, system }) : browser ?? system ?? userAgent.slice(0, 60)
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
      <p className="kc-muted">{t('account.sessions.intro')}</p>
      {error && <p className="kc-banner">{readableError(error, t('account.sessions.signOutFailed'))}</p>}
      {sessions.isError && <p className="kc-banner">{readableError(sessions.error, t('account.sessions.loadFailed'))}</p>}

      <ul className="kc-features-list">
        {(sessions.data ?? []).map((session: SessionEntry) => (
          <li key={session.sessionId} className="kc-feature-row">
            <div className="kc-feature-text">
              <span className="kc-feature-label">
                {describeDevice(session.userAgent)}
                {session.current && <span className="kc-session-current">{t('account.sessions.thisDevice')}</span>}
              </span>
              <p className="kc-muted">
                {t('account.sessions.activity', {
                  active: relativeTime(session.lastUsedAt),
                  signedIn: parseServerTime(session.createdAt).toLocaleDateString(formatLocale()),
                })}
              </p>
            </div>
            {!session.current && (
              <button
                type="button"
                className="kc-btn kc-btn-ghost kc-btn-small"
                disabled={revokeOne.isPending}
                onClick={() => revokeOne.mutate(session.sessionId)}
              >
                {t('account.sessions.signOut')}
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
            {t('account.sessions.signOutOthers')}
          </button>
        </div>
      )}
    </div>
  )
}
