import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiCheck, FiX } from 'react-icons/fi'
import { readableError } from '../../api/http'
import {
  CATEGORY_ORDER,
  fetchAccessCheck,
  type AccessCheck,
  type CheckedRule,
  type KeyCheck,
} from '../../services/permissionsService'
import { useServerMembers, useServerRoles } from '../server/serverQueries'

type AccessCheckPanelProps = {
  serverId: string
  /** Checks on this board only; otherwise the server, with a choice of board. */
  board?: { boardId: string; name: string }
  /** The boards to offer when checking server-wide. */
  boards?: { boardId: number | string; name: string }[]
}

type Who = { kind: 'member'; userId: string; roleIds?: string[] } | { kind: 'roles'; roleIds: string[] }

const CATEGORY_LABELS: Record<string, string> = {
  SERVER: 'Server',
  BOARD: 'Boards',
  COLUMN: 'Columns',
  TASK: 'Tasks',
  COMMENT: 'Comments',
  LABEL: 'Labels and priorities',
}

/** Discord's own names for the permissions rules mention. */
const FLAG_LABELS: Record<string, string> = {
  VIEW_CHANNEL: 'View Channels',
  MANAGE_GUILD: 'Manage Server',
  VIEW_AUDIT_LOG: 'View Audit Log',
}

function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')
}

/** Who a rule is for, in a sentence: "everyone with Send Messages", "@Artists", "Mira personally". */
function ruleSubject(rule: CheckedRule): string {
  if (rule.subjectType === 'DISCORD_PERMISSION') return `everyone with ${flagLabel(rule.subjectName)}`
  if (rule.subjectType === 'ROLE') return rule.subjectName.startsWith('@') ? rule.subjectName : `@${rule.subjectName}`
  return `${rule.subjectName} personally`
}

function ruleWhere(rule: CheckedRule): string {
  if (rule.builtIn) return 'default'
  return rule.scope === 'BOARD' ? 'this board' : 'server'
}

/** Why a key came out as it did, in a sentence. */
function explanation(result: KeyCheck, check: AccessCheck): string {
  switch (result.reason) {
    case 'ADMIN':
      return check.subject.owner
        ? 'Allowed: the server owner may do everything'
        : `Allowed: administrators may do everything${
            check.subject.administratorRule ? ` (${ruleSubject(check.subject.administratorRule)})` : ''
          }`
    case 'OPEN':
      return 'Allowed: open permissions let everyone who can talk do this'
    case 'NONE':
      return 'Denied: no rule allows it'
    default: {
      const rule = result.decidedBy
      if (!rule) return result.allowed ? 'Allowed' : 'Denied'
      const whose = rule.builtIn ? 'the default' : rule.scope === 'BOARD' ? "the board's rule" : "the server's rule"
      return `${result.allowed ? 'Allowed' : 'Denied'} by ${whose} for ${ruleSubject(rule)}`
    }
  }
}

/**
 * Checks what someone may do, and why: a member as they are, a member with other roles ("what if they
 * also had Moderator?"), or anyone with a set of roles. Every answer names the rule that decided it, and
 * the rules it outweighed. Uses the same rules as every real check.
 */
export function AccessCheckPanel({ serverId, board, boards = [] }: AccessCheckPanelProps) {
  const rolesQuery = useServerRoles(serverId)
  const membersQuery = useServerMembers(serverId)
  const [who, setWho] = useState<Who | null>(null)
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState(board?.boardId ?? '')
  const [show, setShow] = useState<'all' | 'allowed' | 'denied'>('all')

  const roles = useMemo(
    () => [...(rolesQuery.data ?? [])].sort((a, b) => (b.position ?? 0) - (a.position ?? 0)),
    [rolesQuery.data],
  )
  const everyoneId = serverId
  const boardId = board?.boardId ?? (scope || undefined)

  const check = useQuery({
    queryKey: ['server', serverId, 'access-check', who, boardId ?? null],
    queryFn: () =>
      fetchAccessCheck(serverId, {
        userId: who?.kind === 'member' ? who.userId : undefined,
        roleIds: who?.kind === 'roles' ? who.roleIds : who?.roleIds,
        boardId,
      }),
    enabled: who !== null,
    placeholderData: (previous) => previous,
  })
  const data = check.data

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []
    return (membersQuery.data ?? [])
      .filter((member) =>
        [member.displayName, member.nickname, member.username].some((name) => name?.toLowerCase().includes(term)),
      )
      .slice(0, 8)
  }, [search, membersQuery.data])

  // The roles shown: those asked for, or the member's own as the check found them.
  const currentRoleIds =
    who?.kind === 'roles'
      ? who.roleIds
      : who?.roleIds ?? data?.subject.roles.filter((role) => !role.everyone).map((role) => role.roleId) ?? []

  function setRoles(roleIds: string[]) {
    if (!who) return
    setWho(who.kind === 'roles' ? { kind: 'roles', roleIds } : { ...who, roleIds })
  }

  const grouped = useMemo(() => {
    const results = (data?.results ?? []).filter(
      (result) => show === 'all' || (show === 'allowed' ? result.allowed : !result.allowed),
    )
    return CATEGORY_ORDER.map((category) => ({
      category,
      results: results.filter((result) => result.category === category),
    })).filter((group) => group.results.length > 0)
  }, [data, show])

  return (
    <section className="kc-access-check">
      <p className="kc-muted">
        See what someone may do{board ? ' on this board' : ''}, and which rule decides each thing. Pick a member to
        start from their roles, then add or remove roles to see what would change. Or check a set of roles on its own.
      </p>

      <div className="kc-access-check-who">
        <div className="kc-access-check-modes" role="group" aria-label="Check">
          <button
            type="button"
            className={`kc-btn kc-btn-small ${who?.kind !== 'roles' ? 'kc-btn-primary' : 'kc-btn-ghost'}`}
            onClick={() => setWho(null)}
          >
            A member
          </button>
          <button
            type="button"
            className={`kc-btn kc-btn-small ${who?.kind === 'roles' ? 'kc-btn-primary' : 'kc-btn-ghost'}`}
            onClick={() => setWho({ kind: 'roles', roleIds: [] })}
          >
            Roles only
          </button>
        </div>

        {who?.kind !== 'roles' && (
          <div className="kc-access-check-search">
            <input
              type="search"
              className="kc-input"
              placeholder="Search members by name"
              aria-label="Search members by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {matches.length > 0 && (
              <ul className="kc-access-check-matches">
                {matches.map((member) => (
                  <li key={member.userId}>
                    <button
                      type="button"
                      onClick={() => {
                        setWho({ kind: 'member', userId: member.userId })
                        setSearch('')
                      }}
                    >
                      <strong>{member.displayName ?? member.username ?? member.userId}</strong>
                      {member.username && <span className="kc-muted"> @{member.username}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!board && boards.length > 0 && (
          <label className="kc-access-check-scope">
            <span className="kc-field-label">Where</span>
            <select className="kc-input" value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="">Server-wide</option>
              {boards.map((entry) => (
                <option key={entry.boardId} value={String(entry.boardId)}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {who && (
        <div className="kc-access-check-roles">
          <span className="kc-field-label">
            {who.kind === 'roles' ? 'Roles' : data?.subject.name ? `${data.subject.name}’s roles` : 'Their roles'}
          </span>
          <ul>
            <li className="kc-access-check-role kc-access-check-role--fixed">@everyone</li>
            {currentRoleIds.map((roleId) => {
              const role = roles.find((entry) => entry.roleId === roleId)
              return (
                <li key={roleId} className="kc-access-check-role" style={roleColour(role?.color ?? null)}>
                  {role?.name ?? 'Unknown role'}
                  <button
                    type="button"
                    aria-label={`Without ${role?.name ?? 'this role'}`}
                    onClick={() => setRoles(currentRoleIds.filter((id) => id !== roleId))}
                  >
                    <FiX aria-hidden="true" />
                  </button>
                </li>
              )
            })}
            <li>
              <select
                className="kc-input kc-access-check-add"
                aria-label="Add a role"
                value=""
                onChange={(event) => event.target.value && setRoles([...currentRoleIds, event.target.value])}
              >
                <option value="">Add a role…</option>
                {roles
                  .filter((role) => role.roleId !== everyoneId && !currentRoleIds.includes(role.roleId))
                  .map((role) => (
                    <option key={role.roleId} value={role.roleId}>
                      {role.name}
                    </option>
                  ))}
              </select>
            </li>
          </ul>
          {who.kind === 'member' && who.roleIds && (
            <p className="kc-muted kc-access-check-whatif">
              Showing {data?.subject.name ?? 'them'} with different roles than they have.{' '}
              <button type="button" className="kc-link-button" onClick={() => setWho({ kind: 'member', userId: who.userId })}>
                Use their real roles
              </button>
            </p>
          )}
        </div>
      )}

      {!who && <p className="kc-muted">Search for a member above, or choose Roles only.</p>}
      {check.isError && <p className="kc-banner">{readableError(check.error, 'The check failed')}</p>}

      {data && who && (
        <>
          <ul className="kc-access-check-notes">
            {!data.boardId && !board && (
              <li>Server-wide: what applies on every board that has no rules of its own.</li>
            )}
            {!data.customPermissions && (
              <li>Custom permissions are off, so the defaults apply: what each Discord permission allows.</li>
            )}
            {data.openPermissions && (
              <li>Open permissions are on: everyone who can view channels and send messages may work with boards.</li>
            )}
            {data.subject.userId && !data.subject.member && (
              <li>{data.subject.name ?? 'This person'} is not in the server, so only rules for them personally count.</li>
            )}
            {data.subject.discordPermissions.length > 0 && (
              <li>
                Discord permissions that matter here: {data.subject.discordPermissions.map(flagLabel).join(', ')}.
              </li>
            )}
          </ul>

          <div className="kc-access-check-filter" role="group" aria-label="Show">
            {(['all', 'allowed', 'denied'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`kc-btn kc-btn-small ${show === value ? 'kc-btn-primary' : 'kc-btn-ghost'}`}
                onClick={() => setShow(value)}
              >
                {value === 'all'
                  ? 'Everything'
                  : `${value === 'allowed' ? 'Allowed' : 'Denied'} (${data.results.filter((result) => result.allowed === (value === 'allowed')).length})`}
              </button>
            ))}
          </div>

          {grouped.map((group) => (
            <fieldset key={group.category} className="kc-access-check-group">
              <legend>{CATEGORY_LABELS[group.category] ?? group.category}</legend>
              <ul>
                {group.results.map((result) => (
                  <li key={result.key} className={`kc-access-check-result${result.allowed ? '' : ' kc-access-check-result--denied'}`}>
                    <span className="kc-access-check-mark" aria-label={result.allowed ? 'Allowed' : 'Denied'}>
                      {result.allowed ? <FiCheck aria-hidden="true" /> : <FiX aria-hidden="true" />}
                    </span>
                    <div>
                      <strong>{result.name}</strong>
                      <span className="kc-access-check-why">{explanation(result, data)}</span>
                      {result.overridden.length > 0 && (
                        <span className="kc-access-check-overridden">
                          Outweighs:{' '}
                          {result.overridden
                            .map((rule) => `${rule.state === 'ALLOW' ? 'Allow' : 'Deny'} for ${ruleSubject(rule)} (${ruleWhere(rule)})`)
                            .join('; ')}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
        </>
      )}
    </section>
  )
}

function roleColour(color: number | null) {
  return color ? { borderColor: `#${color.toString(16).padStart(6, '0')}` } : undefined
}
