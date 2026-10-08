import { useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { FiChevronDown, FiChevronRight, FiRefreshCw } from 'react-icons/fi'
import { parseServerTime, readableError } from '../../api/http'
import { formatLocale, t } from '../../i18n'
import { fetchAuditActors, fetchAuditLog, type AuditEntry, type AuditFilter } from '../../services/auditLogService'
import type { BoardEntry } from '../../services/boardsService'
import type { ServerMemberEntry, ServerRoleEntry } from '../../services/permissionsService'
import { serverKeys } from '../server/serverQueries'
import { AUDIT_CATEGORIES, describeAuditEntry, relativeTime, type AuditLookups } from './auditModel'

type AuditLogSectionProps = {
  serverId: string
  boards: BoardEntry[]
  members: ServerMemberEntry[]
  roles: ServerRoleEntry[]
}

/**
 * The server's audit log: every change made in KanbanCord, newest first, filterable by board,
 * person and kind of change.
 */
export function AuditLogSection({ serverId, boards, members, roles }: AuditLogSectionProps) {
  const [boardId, setBoardId] = useState('')
  const [actorUserId, setActorUserId] = useState('')
  const [category, setCategory] = useState('')

  const filter: AuditFilter = useMemo(
    () => ({
      boardId: boardId || undefined,
      actorUserId: actorUserId || undefined,
      entityTypes: AUDIT_CATEGORIES.find((entry) => entry.key === category)?.entityTypes,
    }),
    [boardId, actorUserId, category],
  )

  const log = useInfiniteQuery({
    queryKey: [...serverKeys.all(serverId), 'audit', filter],
    queryFn: ({ pageParam }) => fetchAuditLog(serverId, filter, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (page) => page.nextBefore,
  })
  // Only people who have changed something are offered as a filter.
  const actors = useQuery({
    queryKey: [...serverKeys.all(serverId), 'audit-actors'],
    queryFn: () => fetchAuditActors(serverId),
  })

  const lookups: AuditLookups = useMemo(
    () => ({
      members: new Map(members.map((member) => [String(member.userId), member.displayName ?? member.nickname ?? member.username ?? member.userId])),
      roles: new Map(roles.map((role) => [String(role.roleId), role.name])),
    }),
    [members, roles],
  )
  const entries = log.data?.pages.flatMap((page) => page.entries) ?? []

  return (
    <div className="kc-audit-pane">
      <div className="kc-audit-toolbar">
        <p className="kc-muted">{t('audit.intro')}</p>
        <button
          type="button"
          className="kc-icon-btn"
          aria-label={t('audit.refreshLabel')}
          title={t('audit.refresh')}
          disabled={log.isFetching}
          onClick={() => {
            void log.refetch()
            void actors.refetch()
          }}
        >
          <FiRefreshCw aria-hidden="true" />
        </button>
      </div>

      <div className="kc-audit-filters">
        <label className="kc-field">
          <span className="kc-field-label">{t('audit.filters.board')}</span>
          <select className="kc-input" value={boardId} onChange={(event) => setBoardId(event.target.value)}>
            <option value="">{t('audit.filters.allBoards')}</option>
            {boards.map((board) => (
              <option key={board.boardId} value={String(board.boardId)}>
                {board.name}
              </option>
            ))}
          </select>
        </label>
        <label className="kc-field">
          <span className="kc-field-label">{t('audit.filters.person')}</span>
          <select className="kc-input" value={actorUserId} onChange={(event) => setActorUserId(event.target.value)}>
            <option value="">{t('audit.filters.everyone')}</option>
            {(actors.data ?? []).map((actor) => (
              <option key={actor.userId} value={actor.userId}>
                {actor.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="kc-field">
          <span className="kc-field-label">{t('audit.filters.kind')}</span>
          <select className="kc-input" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">{t('audit.filters.everything')}</option>
            {AUDIT_CATEGORIES.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {t(entry.label)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {log.isPending && (
        <div className="kc-loading-state" aria-live="polite" aria-busy="true">
          <span className="kc-spinner" aria-hidden="true" />
          <span className="kc-muted">{t('audit.loading')}</span>
        </div>
      )}
      {log.isError && <p className="kc-banner">{readableError(log.error, t('audit.loadFailed'))}</p>}
      {log.isSuccess && entries.length === 0 && <p className="kc-muted">{t('audit.empty')}</p>}

      {entries.length > 0 && (
        <ol className="kc-audit-list">
          {entries.map((entry) => (
            <AuditRow key={entry.logId} entry={entry} lookups={lookups} />
          ))}
        </ol>
      )}

      {log.hasNextPage && (
        <button
          type="button"
          className="kc-btn kc-btn-ghost kc-audit-more"
          disabled={log.isFetchingNextPage}
          onClick={() => void log.fetchNextPage()}
        >
          {log.isFetchingNextPage ? t('common.loadingEllipsis') : t('audit.older')}
        </button>
      )}
    </div>
  )
}

function AuditRow({ entry, lookups }: { entry: AuditEntry; lookups: AuditLookups }) {
  const [expanded, setExpanded] = useState(false)
  const { summary, fields } = describeAuditEntry(entry, lookups)
  const actor = entry.actorDisplayName ?? (entry.userId ? t('dashboard.boardModal.userNumber', { id: entry.userId }) : t('audit.system'))
  const boardName = entry.boardName ?? (entry.boardId ? t('audit.numbered', { noun: t('audit.nouns.BOARD'), id: entry.boardId }) : null)

  return (
    <li className="kc-audit-row">
      <span className="kc-audit-avatar" aria-hidden="true">
        {entry.actorAvatarUrl ? <img src={entry.actorAvatarUrl} alt="" loading="lazy" /> : actor.slice(0, 1).toUpperCase()}
      </span>
      <div className="kc-audit-main">
        <p className="kc-audit-summary">
          <strong>{actor}</strong> {summary}
          {boardName && entry.entityType !== 'BOARD' && <span className="kc-audit-board">{t('audit.onBoardName', { board: boardName })}</span>}
        </p>
        <p className="kc-audit-meta">
          <time dateTime={entry.createdAt} title={parseServerTime(entry.createdAt).toLocaleString(formatLocale())}>
            {relativeTime(entry.createdAt)}
          </time>
          {entry.source === 'DISCORD' && (
            <span className="kc-audit-source" title={t('audit.viaDiscordHint')}>
              {t('audit.viaDiscord')}
            </span>
          )}
          {fields.length > 0 && (
            <button
              type="button"
              className="kc-audit-details-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? <FiChevronDown aria-hidden="true" /> : <FiChevronRight aria-hidden="true" />}
              {t('audit.changeCount', { count: fields.length })}
            </button>
          )}
        </p>
        {expanded && (
          <dl className="kc-audit-fields">
            {fields.map((change) => (
              <div key={change.field} className="kc-audit-field">
                <dt>{change.field}</dt>
                <dd>
                  <span className="kc-audit-from">{change.from}</span> → <span className="kc-audit-to">{change.to}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </li>
  )
}
