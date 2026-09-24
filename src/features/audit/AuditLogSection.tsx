import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { FiChevronDown, FiChevronRight, FiRefreshCw } from 'react-icons/fi'
import { parseServerTime, readableError } from '../../api/http'
import { fetchAuditLog, type AuditEntry, type AuditFilter } from '../../services/auditLogService'
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
 * person and kind of change. Loads nothing until it is opened.
 */
export function AuditLogSection({ serverId, boards, members, roles }: AuditLogSectionProps) {
  const [open, setOpen] = useState(false)
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
    enabled: open,
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
    <section className="kc-panel kc-audit-panel">
      <div className="kc-perms-header-row">
        <h3>Audit log</h3>
        <div className="kc-audit-header-actions">
          {open && (
            <button
              type="button"
              className="kc-icon-btn"
              aria-label="Refresh audit log"
              title="Refresh"
              disabled={log.isFetching}
              onClick={() => void log.refetch()}
            >
              <FiRefreshCw aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="kc-btn kc-btn-ghost kc-perms-toggle"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      <p className="kc-muted">Every change made in KanbanCord on this server, newest first.</p>

      {open && (
        <>
          <div className="kc-audit-filters">
            <label className="kc-field">
              <span className="kc-field-label">Board</span>
              <select className="kc-input" value={boardId} onChange={(event) => setBoardId(event.target.value)}>
                <option value="">All boards</option>
                {boards.map((board) => (
                  <option key={board.boardId} value={String(board.boardId)}>
                    {board.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="kc-field">
              <span className="kc-field-label">Person</span>
              <select className="kc-input" value={actorUserId} onChange={(event) => setActorUserId(event.target.value)}>
                <option value="">Everyone</option>
                {[...lookups.members.entries()]
                  .sort(([, a], [, b]) => a.localeCompare(b))
                  .map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="kc-field">
              <span className="kc-field-label">Kind of change</span>
              <select className="kc-input" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">Everything</option>
                {AUDIT_CATEGORIES.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {log.isPending && (
            <div className="kc-loading-state" aria-live="polite" aria-busy="true">
              <span className="kc-spinner" aria-hidden="true" />
              <span className="kc-muted">Loading the audit log...</span>
            </div>
          )}
          {log.isError && <p className="kc-banner">{readableError(log.error, 'Failed to load the audit log')}</p>}
          {log.isSuccess && entries.length === 0 && <p className="kc-muted">Nothing recorded yet.</p>}

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
              {log.isFetchingNextPage ? 'Loading…' : 'Load older entries'}
            </button>
          )}
        </>
      )}
    </section>
  )
}

function AuditRow({ entry, lookups }: { entry: AuditEntry; lookups: AuditLookups }) {
  const [expanded, setExpanded] = useState(false)
  const { summary, fields } = describeAuditEntry(entry, lookups)
  const actor = entry.actorDisplayName ?? (entry.userId ? `User #${entry.userId}` : 'System')
  const boardName = entry.boardName ?? (entry.boardId ? `board #${entry.boardId}` : null)

  return (
    <li className="kc-audit-row">
      <span className="kc-audit-avatar" aria-hidden="true">
        {entry.actorAvatarUrl ? <img src={entry.actorAvatarUrl} alt="" loading="lazy" /> : actor.slice(0, 1).toUpperCase()}
      </span>
      <div className="kc-audit-main">
        <p className="kc-audit-summary">
          <strong>{actor}</strong> {summary}
          {boardName && entry.entityType !== 'BOARD' && <span className="kc-audit-board"> on {boardName}</span>}
        </p>
        <p className="kc-audit-meta">
          <time dateTime={entry.createdAt} title={parseServerTime(entry.createdAt).toLocaleString()}>
            {relativeTime(entry.createdAt)}
          </time>
          {fields.length > 0 && (
            <button
              type="button"
              className="kc-audit-details-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? <FiChevronDown aria-hidden="true" /> : <FiChevronRight aria-hidden="true" />}
              {fields.length === 1 ? '1 change' : `${fields.length} changes`}
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
