import { useMemo, useRef, useState, type ReactNode } from 'react'
import { SectionNav } from '../../SectionNav'
import { AddEntryModal } from '../AddEntryModal'
import { DeleteGroupModal } from '../DeleteGroupModal'
import { PermissionsSection } from '../permissions/PermissionsSection'
import { permissionRankWeight } from '../permissionRank'
import {
  boardPermissionCatalogEntries,
  boardPermissionGroups,
  cloneBoardPermissionDrafts,
  addDraftPermissions,
  removeDraftPermission,
  toggleDraftPermissionState,
} from './boardPermissionDraft'
import type { BoardEntry } from '../../../services/boardsService'
import {
  DISCORD_FLAG_NAMES,
  DISCORD_PERM_IMPORTANCE,
  KANBAN_PERM_INFO,
  type GrantedToGroup,
  type KanbanCatalogEntry,
  type PermissionEntry,
  type ServerMemberEntry,
  type ServerRoleEntry,
} from '../../../services/permissionsService'
import { FiX } from 'react-icons/fi'
import { t } from '../../../i18n'
import { Trans } from '../../../i18n/Trans'

/** The columns a new board starts with, in the reader's language. */
function defaultColumns(): string[] {
  return [t('dashboard.boardModal.defaultColumns.toDo'), t('dashboard.boardModal.defaultColumns.inProgress'), t('dashboard.boardModal.defaultColumns.done')]
}

type BoardModalProps = {
  show: boolean
  mode: 'create' | 'edit'
  board: BoardEntry | null
  initialName: string
  initialDescription: string
  initialPermissions: PermissionEntry[]
  catalogEntries: KanbanCatalogEntry[]
  serverRoles: ServerRoleEntry[]
  serverMembers: ServerMemberEntry[]
  actorRankWeight: number
  canEditDetails: boolean
  canEditPermissions: boolean
  canArchive: boolean
  canDelete: boolean
  loading: boolean
  saving: boolean
  onClose: () => void
  onSave: (payload: { name: string; description: string; permissions: PermissionEntry[]; columnNames: string[] }) => void
  onArchive: (archived: boolean) => void
  onDelete: () => void
  /** Further sections shown when editing, before the archive and delete actions. */
  children?: ReactNode
}

/**
 * Render with a `key` that changes whenever it should start over (another board, or its data finished
 * loading): the form is initialised from the props when the modal mounts.
 */
export function BoardModal({
  show,
  mode,
  board,
  initialName,
  initialDescription,
  initialPermissions,
  catalogEntries,
  serverRoles,
  serverMembers,
  actorRankWeight,
  canEditDetails,
  canEditPermissions,
  canArchive,
  canDelete,
  loading,
  saving,
  onClose,
  onSave,
  onArchive,
  onDelete,
  children,
}: BoardModalProps) {
  const isArchivedMode = mode === 'edit' && Boolean(board?.isArchived)
  const canEditDetailsInModal = canEditDetails && !isArchivedMode
  const canEditPermissionsInModal = canEditPermissions && !isArchivedMode

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [draftPermissions, setDraftPermissions] = useState<PermissionEntry[]>(() => cloneBoardPermissionDrafts(initialPermissions))
  const [permissionsCollapsed, setPermissionsCollapsed] = useState(false)
  const [expandedPermissionGroups, setExpandedPermissionGroups] = useState<Set<string>>(new Set())
  const [permFilter, setPermFilter] = useState('')
  const [openAddGroupKey, setOpenAddGroupKey] = useState('')
  const [newPermId, setNewPermId] = useState<number | ''>('')
  const [newPermState, setNewPermState] = useState<'ALLOW' | 'DENY'>('ALLOW')
  const [createColumnsText, setCreateColumnsText] = useState(() => defaultColumns().join('\n'))
  const [showAddEntryModal, setShowAddEntryModal] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [modalSubjectType, setModalSubjectType] = useState<string | null>(null)
  const [modalSubjectId, setModalSubjectId] = useState<string | null>(null)
  const [modalSubjectDisplay, setModalSubjectDisplay] = useState<string | null>(null)
  const [modalPermStates, setModalPermStates] = useState<Record<number, 'ALLOW' | 'DENY'>>({})
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<GrantedToGroup | null>(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const boardCatalog = useMemo(() => boardPermissionCatalogEntries(catalogEntries), [catalogEntries])
  const roleMap = useMemo(() => new Map(serverRoles.map((role) => [role.roleId, role.name])), [serverRoles])
  const memberMap = useMemo(
    () => new Map(serverMembers.map((member) => [member.userId, member.displayName ?? member.nickname ?? member.userId])),
    [serverMembers],
  )
  const usernameMap = useMemo(() => new Map(serverMembers.map((member) => [member.userId, member.username ?? ''])), [serverMembers])

  const groupedPermissions = useMemo(() => boardPermissionGroups(draftPermissions, roleMap, memberMap), [draftPermissions, roleMap, memberMap])

  const filteredGroups = useMemo(() => {
    if (!permFilter.trim()) return groupedPermissions
    const q = permFilter.toLowerCase()
    return groupedPermissions.filter(
      (group) =>
        group.subjectDisplay.toLowerCase().includes(q) ||
        String(group.subjectId).includes(q) ||
        (group.subjectType === 'USER' && (usernameMap.get(group.subjectId)?.toLowerCase().includes(q) ?? false)) ||
        group.permissions.some((permission) =>
          (KANBAN_PERM_INFO[permission.kanbanPermissionKey]?.name ?? permission.kanbanPermissionKey)
            .toLowerCase()
            .includes(q),
        ),
    )
  }, [groupedPermissions, permFilter, usernameMap])

  const existingSubjectIds = useMemo(() => {
    const map: Record<string, Set<string>> = {
      DISCORD_PERMISSION: new Set(),
      ROLE: new Set(),
      USER: new Set(),
    }
    for (const permission of draftPermissions) {
      map[permission.subjectType]?.add(permission.subjectId)
    }
    return map
  }, [draftPermissions])

  const filteredDiscordPerms = useMemo(() => {
    const q = modalSearch.toLowerCase()
    return Object.entries(DISCORD_FLAG_NAMES)
      .filter(([id]) => !existingSubjectIds.DISCORD_PERMISSION.has(id))
      .filter(([id, displayName]) => !q || displayName.toLowerCase().includes(q) || id.includes(q))
      .sort(([idA], [idB]) => (DISCORD_PERM_IMPORTANCE[idA] ?? 999) - (DISCORD_PERM_IMPORTANCE[idB] ?? 999))
      .map(([id, displayName]) => ({ id, name: displayName }))
  }, [existingSubjectIds, modalSearch])

  const filteredRoles = useMemo(() => {
    const q = modalSearch.toLowerCase()
    const available = serverRoles.filter((role) => !existingSubjectIds.ROLE.has(role.roleId))
    if (!q) return available
    return available.filter((role) => role.name.toLowerCase().includes(q) || role.roleId.includes(q))
  }, [existingSubjectIds, modalSearch, serverRoles])

  const filteredMembers = useMemo(() => {
    const q = modalSearch.toLowerCase()
    const available = serverMembers.filter((member) => !existingSubjectIds.USER.has(member.userId))
    if (!q) return available
    return available.filter((member) => {
      const displayName = member.displayName ?? member.nickname ?? t('dashboard.boardModal.userNumber', { id: member.userId })
      return (
        displayName.toLowerCase().includes(q) ||
        (member.username?.toLowerCase().includes(q) ?? false) ||
        member.userId.includes(q)
      )
    })
  }, [existingSubjectIds, modalSearch, serverMembers])

  const grantableCatalogEntries = useMemo(() => {
    if (!modalSubjectType || !modalSubjectId) return []
    const existingKeys = draftPermissions
      .filter((permission) => permission.subjectType === modalSubjectType && permission.subjectId === modalSubjectId)
      .map((permission) => permission.kanbanPermissionKey)
    return boardCatalog.filter((entry) => {
      const actorCanGrant = actorRankWeight === 1000 || actorRankWeight > permissionRankWeight(entry.key)
      return actorCanGrant && !existingKeys.includes(entry.key)
    })
  }, [actorRankWeight, boardCatalog, draftPermissions, modalSubjectId, modalSubjectType])

  function openNewEntryModal() {
    setShowAddEntryModal(true)
    setModalSearch('')
    setModalSubjectType(null)
    setModalSubjectId(null)
    setModalSubjectDisplay(null)
    setModalPermStates({})
  }

  function closeNewEntryModal() {
    setShowAddEntryModal(false)
    setModalSearch('')
    setModalSubjectType(null)
    setModalSubjectId(null)
    setModalSubjectDisplay(null)
    setModalPermStates({})
  }

  function selectModalSubject(subjectType: string, subjectId: string, display: string) {
    setModalSubjectType(subjectType)
    setModalSubjectId(subjectId)
    setModalSubjectDisplay(display)
    setModalPermStates({})
  }

  function clearModalSubject() {
    setModalSubjectType(null)
    setModalSubjectId(null)
    setModalSubjectDisplay(null)
    setModalPermStates({})
    setModalSearch('')
  }

  function cycleModalPermState(permissionId: number) {
    setModalPermStates((prev) => {
      const current = prev[permissionId] ?? null
      if (current === null) return { ...prev, [permissionId]: 'ALLOW' }
      if (current === 'ALLOW') return { ...prev, [permissionId]: 'DENY' }
      const next = { ...prev }
      delete next[permissionId]
      return next
    })
  }

  function saveNewEntryModal() {
    if (!modalSubjectType || !modalSubjectId) return
    const entries = Object.entries(modalPermStates)
    if (entries.length === 0) return

    const additions = entries
      .map(([permissionId, state]) => {
        const catalogEntry = boardCatalog.find((entry) => entry.permissionId === Number(permissionId))
        if (!catalogEntry) return null
        return {
          subjectType: modalSubjectType,
          subjectId: modalSubjectId,
          kanbanPermissionId: Number(permissionId),
          kanbanPermissionKey: catalogEntry.key,
          state,
        }
      })
      .filter(
        (entry): entry is {
          subjectType: string
          subjectId: string
          kanbanPermissionId: number
          kanbanPermissionKey: string
          state: 'ALLOW' | 'DENY'
        } => entry !== null,
      )

    setDraftPermissions((prev) => addDraftPermissions(prev, additions))
    closeNewEntryModal()
  }

  function togglePermissionGroupExpansion(groupKey: string) {
    setExpandedPermissionGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  function openAddPermission(subjectType: string, subjectId: string, existingKeys: string[]) {
    const available = boardCatalog.filter((entry) => {
      const actorCanGrant = actorRankWeight === 1000 || actorRankWeight > permissionRankWeight(entry.key)
      return actorCanGrant && !existingKeys.includes(entry.key)
    })
    if (available.length === 0) {
      return
    }
    setOpenAddGroupKey(`${subjectType}:${subjectId}`)
    setNewPermState('ALLOW')
    setNewPermId(available[0]?.permissionId ?? '')
  }

  function addPermissionToGroup(subjectType: string, subjectId: string, defaultPriority: number) {
    if (!newPermId) return
    const catalogEntry = boardCatalog.find((entry) => entry.permissionId === Number(newPermId))
    if (!catalogEntry) return

    setDraftPermissions((prev) => [
      ...prev,
      {
        id: Math.min(0, ...prev.map((permission) => permission.id)) - 1,
        scopeType: 'BOARD',
        scopeId: board?.boardId ? String(board.boardId) : '__draft_board__',
        subjectType,
        subjectId,
        kanbanPermissionId: catalogEntry.permissionId,
        kanbanPermissionKey: catalogEntry.key,
        state: newPermState,
        priority: defaultPriority,
        isImmutable: false,
      },
    ])
    setOpenAddGroupKey('')
    setNewPermId('')
    setNewPermState('ALLOW')
  }

  function parseCreateColumnNames(): string[] {
    const deduped = new Set<string>()
    const names = createColumnsText
      .split(/\r?\n|,/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .filter((part) => {
        const key = part.toLowerCase()
        if (deduped.has(key)) {
          return false
        }
        deduped.add(key)
        return true
      })

    return names.length > 0 ? names : defaultColumns()
  }

  if (!show) return null

  return (
    <>
      <div className="kc-modal-overlay" role="dialog" aria-modal="true" aria-label={mode === 'create' ? t('dashboard.boards.create') : t('dashboard.boardModal.edit')} onClick={onClose}>
        <div className="kc-modal kc-board-modal" onClick={(e) => e.stopPropagation()}>
          <div className="kc-modal-header">
            <h3 className="kc-modal-title">{mode === 'create' ? t('dashboard.boards.create') : t('dashboard.boards.configure', { name: board?.name ?? t('dashboard.boardModal.board') })}</h3>
            <button type="button" className="kc-modal-close" onClick={onClose} disabled={saving} aria-label={t('common.closeModal')}>
              <FiX aria-hidden="true" />
            </button>
          </div>

          <div className="kc-board-modal-layout">
          {mode === 'edit' && !loading && <SectionNav containerRef={bodyRef} label={t('dashboard.boardModal.sections')} />}
          <div className="kc-modal-body kc-board-modal-body" ref={bodyRef}>
            {loading ? (
              <div className="kc-loading-state" aria-live="polite" aria-busy="true">
                <span className="kc-spinner" aria-hidden="true" />
                <span className="kc-muted">{t('dashboard.boardModal.loading')}</span>
              </div>
            ) : (
              <>
                {(canEditDetailsInModal || isArchivedMode) && (
                  <section className="kc-board-modal-section">
                    <div className="kc-board-modal-section-head">
                      <h4>{t('dashboard.boardModal.details')}</h4>
                      <p className="kc-muted">
                        {isArchivedMode
                          ? t('dashboard.boardModal.detailsArchived')
                          : t('dashboard.boardModal.detailsIntro')}
                      </p>
                    </div>
                    {isArchivedMode ? (
                      <div className="kc-board-modal-static">
                        <div className="kc-field">
                          <span className="kc-field-label">{t('common.name')}</span>
                          <p className="kc-board-modal-static-value">{name || t('dashboard.boardModal.unnamed')}</p>
                        </div>
                        <div className="kc-field">
                          <span className="kc-field-label">{t('common.description')}</span>
                          <p className="kc-board-modal-static-value">{description?.trim() || t('dashboard.boards.noDescription')}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <label className="kc-field">
                          <span className="kc-field-label">{t('common.name')}</span>
                          <input
                            className="kc-input"
                            type="text"
                            maxLength={100}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('dashboard.boardModal.namePlaceholder')}
                          />
                        </label>
                        <label className="kc-field">
                          <span className="kc-field-label">{t('common.description')}</span>
                          <textarea
                            className="kc-textarea"
                            maxLength={500}
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t('dashboard.boardModal.descriptionPlaceholder')}
                          />
                        </label>
                      </>
                    )}
                  </section>
                )}

                {mode === 'create' && !isArchivedMode && (
                  <section className="kc-board-modal-section">
                    <div className="kc-board-modal-section-head">
                      <h4>{t('dashboard.boardModal.columns')}</h4>
                      <p className="kc-muted">{t('dashboard.boardModal.columnsIntro')}</p>
                    </div>
                    <label className="kc-field">
                      <span className="kc-field-label">{t('dashboard.boardModal.defaultColumnsLabel')}</span>
                      <textarea
                        className="kc-textarea"
                        value={createColumnsText}
                        onChange={(e) => setCreateColumnsText(e.target.value)}
                        rows={4}
                        placeholder={defaultColumns().join('\n')}
                      />
                    </label>
                  </section>
                )}

                {canEditPermissionsInModal && (
                  <section className="kc-board-modal-section">
                    <PermissionsSection
                      canEditPermissions={canEditPermissions}
                      helperText={
                        mode === 'create' ? t('dashboard.boardModal.adjustInherited') : undefined
                      }
                      permissionsCollapsed={permissionsCollapsed}
                      permissionsLoading={false}
                      permFilter={permFilter}
                      filteredGroups={filteredGroups}
                      expandedPermissionGroups={expandedPermissionGroups}
                      actorRankWeight={actorRankWeight}
                      openAddGroupKey={openAddGroupKey}
                      newPermId={newPermId}
                      newPermState={newPermState}
                      addSaving={false}
                      catalogEntries={boardCatalog}
                      onToggleCollapsed={() => setPermissionsCollapsed((prev) => !prev)}
                      onPermFilterChange={setPermFilter}
                      onOpenNewEntryModal={openNewEntryModal}
                      onToggleGroupExpansion={togglePermissionGroupExpansion}
                      onRequestDeleteGroup={setDeleteGroupTarget}
                      onOpenAddPermission={openAddPermission}
                      onTogglePermissionState={(permissionId, currentState) => {
                        setDraftPermissions((prev) => toggleDraftPermissionState(prev, permissionId, currentState))
                      }}
                      onDeletePermission={(permissionId) => {
                        setDraftPermissions((prev) => removeDraftPermission(prev, permissionId))
                      }}
                      onSetNewPermId={setNewPermId}
                      onSetNewPermState={setNewPermState}
                      onAddPermission={addPermissionToGroup}
                      onCancelAddPermission={() => {
                        setOpenAddGroupKey('')
                        setNewPermId('')
                        setNewPermState('ALLOW')
                      }}
                    />
                  </section>
                )}

                {isArchivedMode && (
                  <section className="kc-board-modal-section">
                    <div className="kc-board-modal-section-head">
                      <h4>{t('dashboard.boardModal.permissions')}</h4>
                      <p className="kc-muted">{t('dashboard.boardModal.permissionsLocked')}</p>
                    </div>

                    <div className="kc-perms-toolbar">
                      <input
                        className="kc-perms-filter"
                        type="text"
                        placeholder={t('permissions.searchEntries')}
                        value={permFilter}
                        onChange={(e) => setPermFilter(e.target.value)}
                        aria-label={t('dashboard.boardModal.filterEntries')}
                      />
                    </div>

                    {filteredGroups.length === 0 ? (
                      <p className="kc-muted">{t('dashboard.boardModal.noEntries')}</p>
                    ) : (
                      <div className="kc-perms-granted-to-list">
                        {filteredGroups.map((group) => {
                          const groupKey = `${group.subjectType}:${group.subjectId}`
                          const isExpanded = expandedPermissionGroups.has(groupKey)

                          return (
                            <div
                              key={groupKey}
                              className="kc-perms-granted-to-row"
                              role="button"
                              tabIndex={0}
                              onClick={() => togglePermissionGroupExpansion(groupKey)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  togglePermissionGroupExpansion(groupKey)
                                }
                              }}
                            >
                              <div className="kc-perms-granted-to-label">
                                <span className="kc-muted">{group.subjectDisplay}</span>
                              </div>
                              <div className="kc-perms-granted-to-perms">
                                <div className={`kc-perm-chip-wrap ${isExpanded ? 'kc-perm-chip-wrap--expanded' : 'kc-perm-chip-wrap--clamped'}`}>
                                  {group.permissions.map((perm) => {
                                    const permName = KANBAN_PERM_INFO[perm.kanbanPermissionKey]?.name ?? perm.kanbanPermissionKey
                                    return (
                                      <span
                                        key={perm.id}
                                        className={`kc-perm-button kc-perm-button--${perm.state.toLowerCase()} kc-perm-button--preview`}
                                        title={t('permissions.row.chip', { name: permName, state: t(`permissions.state.${perm.state}`) })}
                                      >
                                        <span className="kc-perm-button-text">{permName}</span>
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )}

                {mode === 'edit' && children}

                {mode === 'edit' && board && (canArchive || canDelete) && (
                  <section className="kc-board-modal-section">
                    <div className="kc-board-modal-section-head">
                      <h4>{t('dashboard.boardModal.actions')}</h4>
                      <p className="kc-muted">{t('dashboard.boardModal.actionsIntro')}</p>
                    </div>
                    <div className="kc-board-modal-actions">
                      {canArchive && (
                        <button
                          type="button"
                          className="kc-btn kc-btn-ghost"
                          disabled={loading || saving}
                          onClick={() => setShowArchiveConfirm(true)}
                        >
                          {board.isArchived ? t('dashboard.boardModal.restore') : t('dashboard.boardModal.archive')}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="kc-btn kc-btn-danger"
                          disabled={loading || saving}
                          onClick={() => setShowDeleteConfirm(true)}
                        >
                          {t('dashboard.boardModal.delete')}
                        </button>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
          </div>

          {/* Labels and priorities save as they change; Save is for details and permissions. */}
          {!isArchivedMode && (mode === 'create' || canEditDetailsInModal || canEditPermissionsInModal) && (
            <div className="kc-modal-footer">
              <button type="button" className="kc-btn kc-btn-ghost" onClick={onClose} disabled={saving}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="kc-btn kc-btn-primary"
                onClick={() =>
                  onSave({
                    name: name.trim(),
                    description: description.trim(),
                    permissions: draftPermissions,
                    columnNames: parseCreateColumnNames(),
                  })
                }
                disabled={loading || saving || (canEditDetailsInModal && name.trim().length === 0)}
              >
                {saving ? t('common.saving') : mode === 'create' ? t('dashboard.boards.create') : t('common.saveChanges')}
              </button>
            </div>
          )}
        </div>
      </div>

      <DeleteGroupModal
        target={deleteGroupTarget}
        deleteGroupSaving={false}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={() => {
          if (!deleteGroupTarget) return
          // Inherited entries stay (they would still apply); only board-only entries are removed.
          const ids = new Set(
            deleteGroupTarget.permissions
              .filter((permission) => permission.inheritedState === undefined)
              .map((permission) => permission.id),
          )
          setDraftPermissions((prev) => prev.filter((permission) => !ids.has(permission.id)))
          setDeleteGroupTarget(null)
        }}
      />

      <AddEntryModal
        show={showAddEntryModal}
        title={t('dashboard.boardModal.addEntry')}
        ariaLabel={t('dashboard.boardModal.addEntry')}
        loading={false}
        saving={false}
        modalSearch={modalSearch}
        subjectType={modalSubjectType}
        subjectDisplay={modalSubjectDisplay}
        modalPermStates={modalPermStates}
        filteredDiscordPerms={filteredDiscordPerms}
        filteredRoles={filteredRoles}
        filteredMembers={filteredMembers}
        grantableCatalogEntries={grantableCatalogEntries}
        onClose={closeNewEntryModal}
        onSearchChange={setModalSearch}
        onSelectSubject={selectModalSubject}
        onClearSubject={clearModalSubject}
        onCyclePermState={cycleModalPermState}
        onSave={saveNewEntryModal}
      />

      {showArchiveConfirm && board && (
        <div
          className="kc-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={board.isArchived ? t('dashboard.boardModal.confirmRestore') : t('dashboard.boardModal.confirmArchive')}
          onClick={() => {
            if (!saving) setShowArchiveConfirm(false)
          }}
        >
          <div className="kc-modal kc-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="kc-modal-header">
              <h3 className="kc-modal-title">{board.isArchived ? t('dashboard.boardModal.restore') : t('dashboard.boardModal.archive')}</h3>
              <button
                type="button"
                className="kc-modal-close"
                onClick={() => setShowArchiveConfirm(false)}
                disabled={saving}
                aria-label={t('common.close')}
              >
                <FiX aria-hidden="true" />
              </button>
            </div>
            <div className="kc-modal-body">
              <p className="kc-modal-confirm-desc">
                {board.isArchived
                  ? t('dashboard.boardModal.restoreConfirm', { name: board.name })
                  : t('dashboard.boardModal.archiveConfirm', { name: board.name })}
              </p>
            </div>
            <div className="kc-modal-footer">
              <button
                type="button"
                className="kc-btn kc-btn-ghost"
                onClick={() => setShowArchiveConfirm(false)}
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="kc-btn kc-btn-primary"
                onClick={() => onArchive(!board.isArchived)}
                disabled={saving}
              >
                {saving ? t('common.applying') : board.isArchived ? t('dashboard.boardModal.restore') : t('dashboard.boardModal.archive')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && board && (
        <div
          className="kc-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('dashboard.boardModal.confirmDelete')}
          onClick={() => {
            if (!saving) setShowDeleteConfirm(false)
          }}
        >
          <div className="kc-modal kc-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="kc-modal-header">
              <h3 className="kc-modal-title">{t('dashboard.boardModal.delete')}</h3>
              <button
                type="button"
                className="kc-modal-close"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={saving}
                aria-label={t('common.close')}
              >
                <FiX aria-hidden="true" />
              </button>
            </div>
            <div className="kc-modal-body">
              <p className="kc-modal-confirm-desc">
                <Trans k="dashboard.boardModal.deleteConfirm" values={{ name: board.name }} />
              </p>
            </div>
            <div className="kc-modal-footer">
              <button
                type="button"
                className="kc-btn kc-btn-ghost"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button type="button" className="kc-btn kc-btn-danger" onClick={onDelete} disabled={saving}>
                {saving ? t('common.deleting') : t('dashboard.boardModal.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
