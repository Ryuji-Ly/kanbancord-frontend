import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiCheck, FiX } from 'react-icons/fi'
import { readableError } from '../../api/http'
import { t, tOr, type MessageKey } from '../../i18n'
import {
  CATEGORY_ORDER,
  KANBAN_PERM_INFO,
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

/** Discord's own names for the permissions rules mention (access.flags), or the flag in words. */
function flagLabel(flag: string): string {
  return tOr(
    `access.flags.${flag}`,
    flag.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '),
  )
}

/** Who a rule is for, in a sentence: "everyone with Send Messages", "@Artists", "Mira personally". */
function ruleSubject(rule: CheckedRule): string {
  if (rule.subjectType === 'DISCORD_PERMISSION') return t('access.everyoneWith', { permission: flagLabel(rule.subjectName) })
  if (rule.subjectType === 'ROLE') return rule.subjectName.startsWith('@') ? rule.subjectName : `@${rule.subjectName}`
  return t('access.personally', { name: rule.subjectName })
}

function ruleWhere(rule: CheckedRule): string {
  if (rule.builtIn) return t('access.where.default')
  return rule.scope === 'BOARD' ? t('access.where.board') : t('access.where.server')
}

/** Why a key came out as it did, in a sentence. */
function explanation(result: KeyCheck, check: AccessCheck): string {
  switch (result.reason) {
    case 'ADMIN':
      if (check.subject.owner) return t('access.why.owner')
      return check.subject.administratorRule
        ? t('access.why.adminRule', { subject: ruleSubject(check.subject.administratorRule) })
        : t('access.why.admin')
    case 'OPEN':
      return t('access.why.open')
    case 'NONE':
      return t('access.why.none')
    default: {
      const rule = result.decidedBy
      if (!rule) return result.allowed ? t('access.allowed') : t('access.denied')
      const whose: MessageKey = rule.builtIn
        ? 'access.why.byDefault'
        : rule.scope === 'BOARD'
          ? 'access.why.byBoard'
          : 'access.why.byServer'
      return t(whose, { result: result.allowed ? t('access.allowed') : t('access.denied'), subject: ruleSubject(rule) })
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
      <p className="kc-muted">{t(board ? 'access.introBoard' : 'access.intro')}</p>

      <div className="kc-access-check-who">
        <div className="kc-access-check-modes" role="group" aria-label={t('access.check')}>
          <button
            type="button"
            className={`kc-btn kc-btn-small ${who?.kind !== 'roles' ? 'kc-btn-primary' : 'kc-btn-ghost'}`}
            onClick={() => setWho(null)}
          >
            {t('access.aMember')}
          </button>
          <button
            type="button"
            className={`kc-btn kc-btn-small ${who?.kind === 'roles' ? 'kc-btn-primary' : 'kc-btn-ghost'}`}
            onClick={() => setWho({ kind: 'roles', roleIds: [] })}
          >
            {t('access.rolesOnly')}
          </button>
        </div>

        {who?.kind !== 'roles' && (
          <div className="kc-access-check-search">
            <input
              type="search"
              className="kc-input"
              placeholder={t('access.searchMembers')}
              aria-label={t('access.searchMembers')}
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
            <span className="kc-field-label">{t('access.whereLabel')}</span>
            <select className="kc-input" value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="">{t('access.serverWide')}</option>
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
            {who.kind === 'roles'
              ? t('board.fields.roles')
              : data?.subject.name
                ? t('access.someonesRoles', { name: data.subject.name })
                : t('access.theirRoles')}
          </span>
          <ul>
            <li className="kc-access-check-role kc-access-check-role--fixed">@everyone</li>
            {currentRoleIds.map((roleId) => {
              const role = roles.find((entry) => entry.roleId === roleId)
              return (
                <li key={roleId} className="kc-access-check-role" style={roleColour(role?.color ?? null)}>
                  {role?.name ?? t('access.unknownRole')}
                  <button
                    type="button"
                    aria-label={t('access.without', { role: role?.name ?? t('access.thisRole') })}
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
                aria-label={t('access.addRole')}
                value=""
                onChange={(event) => event.target.value && setRoles([...currentRoleIds, event.target.value])}
              >
                <option value="">{t('access.addRoleOption')}</option>
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
              {t('access.whatIf', { name: data?.subject.name ?? t('access.them') })}{' '}
              <button type="button" className="kc-link-button" onClick={() => setWho({ kind: 'member', userId: who.userId })}>
                {t('access.realRoles')}
              </button>
            </p>
          )}
        </div>
      )}

      {!who && <p className="kc-muted">{t('access.start')}</p>}
      {check.isError && <p className="kc-banner">{readableError(check.error, t('access.failed'))}</p>}

      {data && who && (
        <>
          <ul className="kc-access-check-notes">
            {!data.boardId && !board && (
              <li>{t('access.notes.serverWide')}</li>
            )}
            {!data.customPermissions && (
              <li>{t('access.notes.customOff')}</li>
            )}
            {data.openPermissions && (
              <li>{t('access.notes.open')}</li>
            )}
            {data.subject.userId && !data.subject.member && (
              <li>{t('access.notes.notMember', { name: data.subject.name ?? t('access.thisPerson') })}</li>
            )}
            {data.subject.discordPermissions.length > 0 && (
              <li>{t('access.notes.discord', { permissions: data.subject.discordPermissions.map(flagLabel).join(', ') })}</li>
            )}
          </ul>

          <div className="kc-access-check-filter" role="group" aria-label={t('access.show')}>
            {(['all', 'allowed', 'denied'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`kc-btn kc-btn-small ${show === value ? 'kc-btn-primary' : 'kc-btn-ghost'}`}
                onClick={() => setShow(value)}
              >
                {value === 'all'
                  ? t('audit.filters.everything')
                  : t(value === 'allowed' ? 'access.allowedCount' : 'access.deniedCount', {
                      count: data.results.filter((result) => result.allowed === (value === 'allowed')).length,
                    })}
              </button>
            ))}
          </div>

          {grouped.map((group) => (
            <fieldset key={group.category} className="kc-access-check-group">
              <legend>{tOr(`access.categories.${group.category}`, group.category)}</legend>
              <ul>
                {group.results.map((result) => (
                  <li key={result.key} className={`kc-access-check-result${result.allowed ? '' : ' kc-access-check-result--denied'}`}>
                    <span className="kc-access-check-mark" aria-label={result.allowed ? t('access.allowed') : t('access.denied')}>
                      {result.allowed ? <FiCheck aria-hidden="true" /> : <FiX aria-hidden="true" />}
                    </span>
                    <div>
                      <strong>{KANBAN_PERM_INFO[result.key]?.name ?? result.name}</strong>
                      <span className="kc-access-check-why">{explanation(result, data)}</span>
                      {result.overridden.length > 0 && (
                        <span className="kc-access-check-overridden">
                          {t('access.outweighs', {
                            rules: result.overridden
                              .map((rule) =>
                                t(rule.state === 'ALLOW' ? 'access.overriddenAllow' : 'access.overriddenDeny', {
                                  subject: ruleSubject(rule),
                                  where: ruleWhere(rule),
                                }),
                              )
                              .join('; '),
                          })}
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
